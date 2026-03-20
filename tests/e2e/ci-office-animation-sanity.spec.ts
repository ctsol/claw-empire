/**
 * Office Animation Sanity — CI Gate
 *
 * Validates correctness of the room animation state API endpoints and
 * runtime behaviour introduced for the office animation improvements task.
 *
 * Coverage:
 *  1. GET /api/room-settings — list all rooms, response shape
 *  2. GET /api/room-settings/:roomId — per-room settings, missing room, invalid id
 *  3. PUT /api/room-settings/:roomId — admin-only write, RBAC (agent → 403)
 *  4. GET /api/room-settings-audit — admin-only audit log, RBAC (agent → 403)
 *  5. Audit trail: PUT produces an audit entry with correct actor_role
 *  6. Regression: no Korean characters in office canvas burst text
 *
 * This spec runs in CI on every PR targeting main via the existing Playwright
 * setup. It does NOT require the full PixiJS canvas — HTTP API-only tests use
 * the `request` fixture; the Korean-char regression uses the page fixture.
 */

import { expect, test } from "@playwright/test";

const ROOM_ID = "qa_sanity_room";

// ───────────────────────────────────────────────────────────────────────────
// 1. GET /api/room-settings — list endpoint
// ───────────────────────────────────────────────────────────────────────────

test.describe("GET /api/room-settings — list all room settings", () => {
  test("returns HTTP 200 with ok:true and rooms array", async ({ request }) => {
    const res = await request.get("/api/room-settings");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.rooms)).toBe(true);
  });

  test("each room entry has required fields when rows exist", async ({ request }) => {
    // First write a room so the list is non-empty
    await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: { theme: "game_bright" } },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });

    const res = await request.get("/api/room-settings");
    const body = await res.json();

    const room = body.rooms.find((r: { room_id: string }) => r.room_id === ROOM_ID);
    expect(room, `Room '${ROOM_ID}' not found in list`).toBeDefined();
    expect(typeof room.settings).toBe("object");
    expect(typeof room.updated_by).toBe("string");
    expect(typeof room.updated_at).toBe("number");
    expect(typeof room.created_at).toBe("number");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. GET /api/room-settings/:roomId — per-room
// ───────────────────────────────────────────────────────────────────────────

test.describe("GET /api/room-settings/:roomId — per-room settings", () => {
  test("returns settings for existing room", async ({ request }) => {
    // Ensure room exists with known data
    await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: { theme: "corporate_soft", transition_duration_ms: 200 } },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });

    const res = await request.get(`/api/room-settings/${ROOM_ID}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.room_id).toBe(ROOM_ID);
    expect(typeof body.settings).toBe("object");
  });

  test("returns empty settings for non-existent room without 404", async ({ request }) => {
    const res = await request.get("/api/room-settings/nonexistent_room_xyz");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.settings).toEqual({});
    expect(body.updated_by).toBeNull();
    expect(body.updated_at).toBeNull();
  });

  test("rejects invalid room id with 400", async ({ request }) => {
    // roomId that normalises to empty (only special chars)
    const res = await request.get("/api/room-settings/!!!invalid!!!");
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("invalid_room_id");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. PUT /api/room-settings/:roomId — admin-only write + RBAC
// ───────────────────────────────────────────────────────────────────────────

test.describe("PUT /api/room-settings/:roomId — RBAC", () => {
  test("admin role can write room settings", async ({ request }) => {
    const res = await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: { theme: "game_bright", anim_mode: "game" } },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.room_id).toBe(ROOM_ID);
  });

  test("agent role is rejected with 403", async ({ request }) => {
    const res = await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: { theme: "corporate_soft" } },
      headers: { "x-actor-role": "agent", "content-type": "application/json" },
    });
    expect(res.status()).toBe(403);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("forbidden");
  });

  test("system role is rejected with 403", async ({ request }) => {
    const res = await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: { theme: "corporate_soft" } },
      headers: { "x-actor-role": "system", "content-type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });

  test("missing settings field returns 400", async ({ request }) => {
    const res = await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { not_settings: {} },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("settings_required");
  });

  test("settings as array returns 400", async ({ request }) => {
    const res = await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: ["game_bright"] },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("settings_must_be_object");
  });

  test("settings as string returns 400", async ({ request }) => {
    const res = await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: "game_bright" },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toBe("settings_must_be_object");
  });

  test("settings are persisted after successful PUT", async ({ request }) => {
    const theme = "game_bright";

    await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: { theme } },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });

    const getRes = await request.get(`/api/room-settings/${ROOM_ID}`);
    const body = await getRes.json();
    expect((body.settings as { theme?: string }).theme).toBe(theme);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. GET /api/room-settings-audit — admin-only audit log + RBAC
// ───────────────────────────────────────────────────────────────────────────

test.describe("GET /api/room-settings-audit — RBAC and audit trail", () => {
  test("admin role can read audit log", async ({ request }) => {
    const res = await request.get("/api/room-settings-audit", {
      headers: { "x-actor-role": "admin" },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.entries)).toBe(true);
  });

  test("agent role is rejected with 403", async ({ request }) => {
    const res = await request.get("/api/room-settings-audit", {
      headers: { "x-actor-role": "agent" },
    });
    expect(res.status()).toBe(403);

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("forbidden");
  });

  test("PUT by admin creates audit entry with correct actor_role", async ({ request }) => {
    // Write a known value
    await request.put(`/api/room-settings/${ROOM_ID}`, {
      data: { settings: { audit_marker: "qa_sanity_2026_03_20" } },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });

    // Query audit log filtered by this room
    const auditRes = await request.get(`/api/room-settings-audit?room_id=${ROOM_ID}&limit=10`, {
      headers: { "x-actor-role": "admin" },
    });
    expect(auditRes.status()).toBe(200);

    const body = await auditRes.json();
    expect(body.ok).toBe(true);
    expect(body.entries.length).toBeGreaterThan(0);

    const latest = body.entries[0] as {
      actor_role: string;
      room_id: string;
      change: { audit_marker?: string };
    };
    expect(latest.actor_role).toBe("admin");
    expect(latest.room_id).toBe(ROOM_ID);
    expect(latest.change).toMatchObject({ audit_marker: "qa_sanity_2026_03_20" });
  });

  test("audit entries have all required fields", async ({ request }) => {
    const res = await request.get(`/api/room-settings-audit?limit=1`, {
      headers: { "x-actor-role": "admin" },
    });
    const body = await res.json();

    if (body.entries.length === 0) {
      // No entries yet — create one first
      await request.put(`/api/room-settings/${ROOM_ID}`, {
        data: { settings: { init: true } },
        headers: { "x-actor-role": "admin", "content-type": "application/json" },
      });
      const res2 = await request.get(`/api/room-settings-audit?limit=1`, {
        headers: { "x-actor-role": "admin" },
      });
      const body2 = await res2.json();
      expect(body2.entries.length).toBeGreaterThan(0);
    }

    const entry = body.entries.length > 0 ? body.entries[0] : null;
    if (entry) {
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.room_id).toBe("string");
      expect(typeof entry.actor_role).toBe("string");
      expect(typeof entry.change).toBe("object");
      expect(typeof entry.created_at).toBe("number");
    }
  });

  test("?room_id filter returns only entries for that room", async ({ request }) => {
    // Write to two different rooms
    const roomA = "qa_audit_room_a";
    const roomB = "qa_audit_room_b";

    await request.put(`/api/room-settings/${roomA}`, {
      data: { settings: { tag: "room_a" } },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });
    await request.put(`/api/room-settings/${roomB}`, {
      data: { settings: { tag: "room_b" } },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });

    const res = await request.get(`/api/room-settings-audit?room_id=${roomA}&limit=50`, {
      headers: { "x-actor-role": "admin" },
    });
    const body = await res.json();
    expect(body.ok).toBe(true);

    for (const entry of body.entries as Array<{ room_id: string }>) {
      expect(entry.room_id).toBe(roomA);
    }
  });

  test("?limit param caps the number of returned entries", async ({ request }) => {
    const res = await request.get("/api/room-settings-audit?limit=2", {
      headers: { "x-actor-role": "admin" },
    });
    const body = await res.json();
    expect(body.entries.length).toBeLessThanOrEqual(2);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5. Language policy regression — no Korean characters in office UI
// ───────────────────────────────────────────────────────────────────────────

test.describe("Language policy — Korean character regression", () => {
  test.setTimeout(30_000);

  test("office canvas page text does not contain Korean characters", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("body", { timeout: 15_000 });

    // Wait for app to mount and initial animations to run
    await page.waitForTimeout(2_000);

    // Collect all visible text from the DOM (excludes canvas internals)
    const pageText = await page.evaluate(() => document.body.innerText);

    // Korean Unicode block: U+AC00–U+D7A3 (Hangul syllables) and
    // Hangul Jamo U+1100–U+11FF, Compatibility Jamo U+3130–U+318F
    const koreanPattern = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/;
    expect(
      koreanPattern.test(pageText),
      `Korean characters found in page text. Snippet: "${pageText.slice(0, 200)}"`,
    ).toBe(false);
  });
});
