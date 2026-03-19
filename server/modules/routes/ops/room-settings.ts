import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Express, Request, Response } from "express";

type DbLike = Pick<DatabaseSync, "prepare" | "exec">;

type RoomSettingsDeps = {
  app: Express;
  db: DbLike;
  nowMs: () => number;
};

const MAX_SETTINGS_JSON_SIZE = 32_768;

function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  return trimmed.length > 0 && trimmed.length <= 64 ? trimmed : null;
}

function resolveActorRole(req: Request): string {
  const header = req.get("x-actor-role");
  if (typeof header === "string") {
    const normalized = header.trim().toLowerCase();
    if (normalized === "agent" || normalized === "system") return normalized;
  }
  return "admin";
}

function resolveActorId(req: Request): string | null {
  const header = req.get("x-actor-id");
  if (typeof header === "string") {
    const trimmed = header.trim();
    if (trimmed.length > 0 && trimmed.length <= 128) return trimmed;
  }
  return null;
}

export function registerRoomSettingsRoutes(deps: RoomSettingsDeps): void {
  const { app, db, nowMs } = deps;

  // Ensure tables exist (idempotent migration)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS room_settings (
        room_id TEXT PRIMARY KEY,
        settings_json TEXT NOT NULL DEFAULT '{}',
        updated_by TEXT NOT NULL DEFAULT 'admin',
        updated_at INTEGER DEFAULT (unixepoch()*1000),
        created_at INTEGER DEFAULT (unixepoch()*1000)
      )
    `);
  } catch {
    /* already exists */
  }
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS room_settings_audit (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        actor_id TEXT,
        change_json TEXT NOT NULL,
        prev_json TEXT,
        created_at INTEGER DEFAULT (unixepoch()*1000)
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_room_settings_audit_room ON room_settings_audit(room_id, created_at DESC)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_room_settings_audit_created ON room_settings_audit(created_at DESC)");
  } catch {
    /* already exists */
  }

  // GET /api/room-settings — list all room settings
  app.get("/api/room-settings", (_req: Request, res: Response) => {
    try {
      const rows = db
        .prepare(
          "SELECT room_id, settings_json, updated_by, updated_at, created_at FROM room_settings ORDER BY room_id ASC",
        )
        .all() as Array<{
        room_id: string;
        settings_json: string;
        updated_by: string;
        updated_at: number;
        created_at: number;
      }>;

      const rooms = rows.map((row) => {
        let settings: unknown = {};
        try {
          settings = JSON.parse(row.settings_json);
        } catch {
          settings = {};
        }
        return {
          room_id: row.room_id,
          settings,
          updated_by: row.updated_by,
          updated_at: row.updated_at,
          created_at: row.created_at,
        };
      });

      res.json({ ok: true, rooms });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: "room_settings_read_failed", detail: String(err) });
    }
  });

  // GET /api/room-settings/:roomId — get settings for one room
  app.get("/api/room-settings/:roomId", (req: Request, res: Response) => {
    const roomId = normalizeRoomId(req.params.roomId);
    if (!roomId) {
      return res.status(400).json({ ok: false, error: "invalid_room_id" });
    }

    try {
      const row = db
        .prepare(
          "SELECT room_id, settings_json, updated_by, updated_at, created_at FROM room_settings WHERE room_id = ?",
        )
        .get(roomId) as
        | { room_id: string; settings_json: string; updated_by: string; updated_at: number; created_at: number }
        | undefined;

      if (!row) {
        return res.json({ ok: true, room_id: roomId, settings: {}, updated_by: null, updated_at: null });
      }

      let settings: unknown = {};
      try {
        settings = JSON.parse(row.settings_json);
      } catch {
        settings = {};
      }

      res.json({
        ok: true,
        room_id: row.room_id,
        settings,
        updated_by: row.updated_by,
        updated_at: row.updated_at,
        created_at: row.created_at,
      });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: "room_settings_read_failed", detail: String(err) });
    }
  });

  // PUT /api/room-settings/:roomId — update room settings (admin-only)
  app.put("/api/room-settings/:roomId", (req: Request, res: Response) => {
    const actorRole = resolveActorRole(req);

    // RBAC: only admin may write room settings
    if (actorRole !== "admin") {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
        detail: "Only administrators may update room settings",
      });
    }

    const roomId = normalizeRoomId(req.params.roomId);
    if (!roomId) {
      return res.status(400).json({ ok: false, error: "invalid_room_id" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const incomingSettings = body.settings;
    if (incomingSettings === undefined || incomingSettings === null) {
      return res.status(400).json({ ok: false, error: "settings_required" });
    }
    if (typeof incomingSettings !== "object" || Array.isArray(incomingSettings)) {
      return res.status(400).json({ ok: false, error: "settings_must_be_object" });
    }

    let settingsJson: string;
    try {
      settingsJson = JSON.stringify(incomingSettings);
    } catch {
      return res.status(400).json({ ok: false, error: "settings_not_serializable" });
    }
    if (settingsJson.length > MAX_SETTINGS_JSON_SIZE) {
      return res.status(400).json({ ok: false, error: "settings_too_large", max_bytes: MAX_SETTINGS_JSON_SIZE });
    }

    const actorId = resolveActorId(req);
    const now = nowMs();

    try {
      // Read previous value for audit
      const prevRow = db.prepare("SELECT settings_json FROM room_settings WHERE room_id = ?").get(roomId) as
        | { settings_json: string }
        | undefined;
      const prevJson = prevRow?.settings_json ?? null;

      // Upsert room settings
      db.prepare(
        `
        INSERT INTO room_settings (room_id, settings_json, updated_by, updated_at, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(room_id) DO UPDATE SET
          settings_json = excluded.settings_json,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
      `,
      ).run(roomId, settingsJson, actorRole, now, now);

      // Write audit record
      db.prepare(
        `
        INSERT INTO room_settings_audit (id, room_id, actor_role, actor_id, change_json, prev_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(randomUUID(), roomId, actorRole, actorId, settingsJson, prevJson, now);

      res.json({ ok: true, room_id: roomId });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: "room_settings_write_failed", detail: String(err) });
    }
  });

  // GET /api/room-settings-audit — admin audit log for room settings changes
  app.get("/api/room-settings-audit", (req: Request, res: Response) => {
    const actorRole = resolveActorRole(req);
    if (actorRole !== "admin") {
      return res.status(403).json({
        ok: false,
        error: "forbidden",
        detail: "Only administrators may view room settings audit log",
      });
    }

    const roomIdParam = req.query.room_id;
    const limitParam = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;

    try {
      let rows: unknown[];
      if (typeof roomIdParam === "string" && roomIdParam.trim()) {
        const roomId = normalizeRoomId(roomIdParam);
        if (!roomId) {
          return res.status(400).json({ ok: false, error: "invalid_room_id" });
        }
        rows = db
          .prepare(
            "SELECT id, room_id, actor_role, actor_id, change_json, prev_json, created_at FROM room_settings_audit WHERE room_id = ? ORDER BY created_at DESC LIMIT ?",
          )
          .all(roomId, limit);
      } else {
        rows = db
          .prepare(
            "SELECT id, room_id, actor_role, actor_id, change_json, prev_json, created_at FROM room_settings_audit ORDER BY created_at DESC LIMIT ?",
          )
          .all(limit);
      }

      const entries = (
        rows as Array<{
          id: string;
          room_id: string;
          actor_role: string;
          actor_id: string | null;
          change_json: string;
          prev_json: string | null;
          created_at: number;
        }>
      ).map((row) => {
        let change: unknown = {};
        let prev: unknown = null;
        try {
          change = JSON.parse(row.change_json);
        } catch {
          change = {};
        }
        if (row.prev_json) {
          try {
            prev = JSON.parse(row.prev_json);
          } catch {
            prev = null;
          }
        }
        return {
          id: row.id,
          room_id: row.room_id,
          actor_role: row.actor_role,
          actor_id: row.actor_id,
          change,
          prev,
          created_at: row.created_at,
        };
      });

      res.json({ ok: true, entries });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: "room_settings_audit_read_failed", detail: String(err) });
    }
  });
}
