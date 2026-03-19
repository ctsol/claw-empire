/**
 * Animation Performance Gate
 *
 * Measures rendering frame rate of the office view canvas animations.
 * Fails the CI gate if sustained FPS drops below PW_ANIMATION_FPS_MIN (default 30).
 *
 * How it works:
 *   1. Navigate to the app and wait for the office canvas to render.
 *   2. Inject a rAF-based frame counter that runs for MEASURE_DURATION_MS.
 *   3. Assert the observed FPS meets the minimum threshold.
 */

import { expect, test } from "@playwright/test";

const FPS_MIN = Number(process.env.PW_ANIMATION_FPS_MIN ?? "30");
const MEASURE_DURATION_MS = 3_000;
const WARMUP_MS = 1_000;

test.describe("Animation FPS gate", () => {
  test.setTimeout(60_000);

  test(`office view canvas sustains ≥${FPS_MIN} fps`, async ({ page }) => {
    const baseUrl = process.env.PW_BASE_URL ?? "http://127.0.0.1:8810";

    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait for the app to mount (React root renders within 10 s in dev mode)
    await page.waitForSelector("#root, [data-testid='office-canvas'], canvas", { timeout: 15_000 });

    // Short warmup so initial JS compilation doesn't skew the measurement
    await page.waitForTimeout(WARMUP_MS);

    // Inject rAF-based FPS counter via page.evaluate
    const measuredFps: number = await page.evaluate(
      ({ durationMs }: { durationMs: number }) => {
        return new Promise<number>((resolve) => {
          let frameCount = 0;
          const startTime = performance.now();

          function tick() {
            frameCount += 1;
            const elapsed = performance.now() - startTime;
            if (elapsed < durationMs) {
              requestAnimationFrame(tick);
            } else {
              const fps = (frameCount / elapsed) * 1_000;
              resolve(fps);
            }
          }

          requestAnimationFrame(tick);
        });
      },
      { durationMs: MEASURE_DURATION_MS },
    );

    console.log(`[AnimationFPS] Measured FPS: ${measuredFps.toFixed(1)} (min: ${FPS_MIN})`);

    expect(
      measuredFps,
      `Animation FPS ${measuredFps.toFixed(1)} is below the required minimum of ${FPS_MIN} fps. ` +
        `This violates the 30+ fps performance gate. ` +
        `Review heavy animations, unoptimized canvas draws, or layout thrashing in the office view.`,
    ).toBeGreaterThanOrEqual(FPS_MIN);
  });

  test("room settings API enforces admin-only writes", async ({ request }) => {
    // Verify RBAC on PUT /api/room-settings/:roomId
    const adminRes = await request.put("/api/room-settings/ceo_zone", {
      data: { settings: { theme: "game_bright", transition_duration_ms: 300 } },
      headers: { "x-actor-role": "admin", "content-type": "application/json" },
    });
    const adminBody = await adminRes.json();
    expect(adminRes.status(), `Admin PUT should succeed: ${JSON.stringify(adminBody)}`).toBe(200);
    expect(adminBody.ok).toBe(true);

    // Agent role must be rejected with 403
    const agentRes = await request.put("/api/room-settings/ceo_zone", {
      data: { settings: { theme: "corporate_soft" } },
      headers: { "x-actor-role": "agent", "content-type": "application/json" },
    });
    expect(agentRes.status(), "Agent PUT must return 403").toBe(403);

    // Verify audit log entry was recorded
    const auditRes = await request.get("/api/room-settings-audit?room_id=ceo_zone&limit=5", {
      headers: { "x-actor-role": "admin" },
    });
    const auditBody = await auditRes.json();
    expect(auditRes.status()).toBe(200);
    expect(auditBody.ok).toBe(true);
    expect(Array.isArray(auditBody.entries)).toBe(true);
    expect(auditBody.entries.length).toBeGreaterThan(0);
    expect(auditBody.entries[0].actor_role).toBe("admin");

    // Audit log is also admin-gated
    const agentAuditRes = await request.get("/api/room-settings-audit", {
      headers: { "x-actor-role": "agent" },
    });
    expect(agentAuditRes.status()).toBe(403);
  });
});
