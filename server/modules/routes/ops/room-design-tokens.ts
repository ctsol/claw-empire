import type { DatabaseSync } from "node:sqlite";
import type { Express } from "express";
import { isAuthenticated } from "../../../security/auth.ts";

export type RoomDesignTokensDeps = {
  app: Express;
  db: DatabaseSync;
  nowMs: () => number;
};

const DEFAULT_SCOPE = "global";

const ALLOWED_SCOPES = new Set([
  "global",
  "office",
  "break_room",
  "meeting_room",
  "ceo_zone",
  "hallway",
]);

function isValidScope(scope: unknown): scope is string {
  return typeof scope === "string" && ALLOWED_SCOPES.has(scope.trim());
}

function normalizeScope(input: unknown): string {
  if (Array.isArray(input)) input = input[0];
  const raw = String(input ?? "").trim();
  return ALLOWED_SCOPES.has(raw) ? raw : DEFAULT_SCOPE;
}

export function registerRoomDesignTokenRoutes(deps: RoomDesignTokensDeps): void {
  const { app, db, nowMs } = deps;

  // GET /api/room-design/tokens?scope=global
  // Public — returns current design tokens for the requested scope.
  app.get("/api/room-design/tokens", (req, res) => {
    try {
      const scope = normalizeScope(req.query.scope);
      const row = db
        .prepare("SELECT scope, tokens_json, updated_by, updated_at FROM room_design_tokens WHERE scope = ?")
        .get(scope) as { scope: string; tokens_json: string; updated_by: string; updated_at: number } | undefined;

      let tokens: unknown = {};
      if (row) {
        try {
          tokens = JSON.parse(row.tokens_json);
        } catch {
          tokens = {};
        }
      }

      return res.json({
        ok: true,
        scope,
        tokens,
        updated_by: row?.updated_by ?? null,
        updated_at: row?.updated_at ?? null,
      });
    } catch (err: unknown) {
      return res.status(500).json({ ok: false, error: (err as Error)?.message ?? String(err) });
    }
  });

  // GET /api/room-design/tokens/all
  // Public — returns all scopes with their tokens.
  app.get("/api/room-design/tokens/all", (_req, res) => {
    try {
      const rows = db
        .prepare("SELECT scope, tokens_json, updated_by, updated_at FROM room_design_tokens ORDER BY scope ASC")
        .all() as Array<{ scope: string; tokens_json: string; updated_by: string; updated_at: number }>;

      const result: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          result[row.scope] = {
            tokens: JSON.parse(row.tokens_json),
            updated_by: row.updated_by,
            updated_at: row.updated_at,
          };
        } catch {
          result[row.scope] = { tokens: {}, updated_by: row.updated_by, updated_at: row.updated_at };
        }
      }

      return res.json({ ok: true, scopes: result });
    } catch (err: unknown) {
      return res.status(500).json({ ok: false, error: (err as Error)?.message ?? String(err) });
    }
  });

  // PUT /api/room-design/tokens
  // Admin-only — updates design tokens for a scope and writes audit entry.
  // Body: { scope?: string, tokens: Record<string, unknown> }
  app.put("/api/room-design/tokens", (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    try {
      const body = (req.body ?? {}) as { scope?: unknown; tokens?: unknown };
      const rawScope = body.scope;

      if (rawScope !== undefined && !isValidScope(rawScope)) {
        return res.status(400).json({ ok: false, error: "invalid_scope" });
      }

      const scope = rawScope !== undefined ? String(rawScope).trim() : DEFAULT_SCOPE;

      if (body.tokens === null || typeof body.tokens !== "object" || Array.isArray(body.tokens)) {
        return res.status(400).json({ ok: false, error: "tokens_must_be_object" });
      }

      const tokensJson = JSON.stringify(body.tokens ?? {});
      const now = nowMs();

      db.prepare(`
        INSERT INTO room_design_tokens (scope, tokens_json, updated_by, updated_at)
        VALUES (?, ?, 'admin', ?)
        ON CONFLICT(scope) DO UPDATE SET
          tokens_json = excluded.tokens_json,
          updated_by = 'admin',
          updated_at = excluded.updated_at
      `).run(scope, tokensJson, now);

      db.prepare(`
        INSERT INTO room_design_tokens_audit (scope, tokens_json, changed_by, actor_role, created_at)
        VALUES (?, ?, 'admin', 'admin', ?)
      `).run(scope, tokensJson, now);

      return res.json({ ok: true, scope, updated_at: now });
    } catch (err: unknown) {
      return res.status(500).json({ ok: false, error: (err as Error)?.message ?? String(err) });
    }
  });

  // GET /api/room-design/audit?scope=global&limit=50
  // Admin-only — returns audit log for design token changes.
  app.get("/api/room-design/audit", (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    try {
      const scopeParam = req.query.scope;
      const limitParam = req.query.limit;
      const limit = Math.min(
        Math.max(1, parseInt(Array.isArray(limitParam) ? String(limitParam[0]) : String(limitParam ?? "50"), 10) || 50),
        200,
      );

      let rows: Array<{
        id: number;
        scope: string;
        changed_by: string;
        actor_role: string;
        created_at: number;
      }>;

      if (scopeParam && isValidScope(scopeParam)) {
        rows = db
          .prepare(
            "SELECT id, scope, changed_by, actor_role, created_at FROM room_design_tokens_audit WHERE scope = ? ORDER BY created_at DESC LIMIT ?",
          )
          .all(String(scopeParam), limit) as typeof rows;
      } else {
        rows = db
          .prepare(
            "SELECT id, scope, changed_by, actor_role, created_at FROM room_design_tokens_audit ORDER BY created_at DESC LIMIT ?",
          )
          .all(limit) as typeof rows;
      }

      return res.json({ ok: true, entries: rows });
    } catch (err: unknown) {
      return res.status(500).json({ ok: false, error: (err as Error)?.message ?? String(err) });
    }
  });
}
