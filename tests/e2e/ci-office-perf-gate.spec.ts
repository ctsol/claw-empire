/**
 * Animation Performance Gate
 *
 * Verifies the office view renders at or above the 30 fps target defined
 * in the animation design system spec (docs/design/2026-03-19-animation-design-system.md).
 *
 * Strategy:
 *  1. Load the application root.
 *  2. Inject a lightweight rAF-based FPS sampler into the page.
 *  3. Wait 2 seconds to collect a representative sample.
 *  4. Assert median FPS >= 30.
 *
 * Note: Chromium in headless CI renders at an uncapped rate when no GPU
 * throttle is applied, so passing 30 fps here is a low-risk gate.
 * A real device test (separate job) would enforce harder limits.
 */

import { test, expect } from "@playwright/test";

const MIN_FPS_THRESHOLD = 30;
const SAMPLE_DURATION_MS = 2000;

test.describe("Office animation performance gate", () => {
  test.setTimeout(60_000);

  test(`median frame rate is at least ${MIN_FPS_THRESHOLD} fps`, async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body").first()).toBeVisible();

    // Inject a rAF-based FPS sampler before animations start.
    const medianFps: number = await page.evaluate(
      ({ durationMs }: { durationMs: number }) => {
        return new Promise<number>((resolve) => {
          const frameTimes: number[] = [];
          let lastTs: number | null = null;
          let rafId: number;

          const tick = (ts: number) => {
            if (lastTs !== null) {
              frameTimes.push(ts - lastTs);
            }
            lastTs = ts;
            rafId = requestAnimationFrame(tick);
          };

          rafId = requestAnimationFrame(tick);

          setTimeout(() => {
            cancelAnimationFrame(rafId);
            if (frameTimes.length < 2) {
              resolve(0);
              return;
            }
            const sorted = [...frameTimes].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const medianFrameMs = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
            resolve(medianFrameMs > 0 ? 1000 / medianFrameMs : 0);
          }, durationMs);
        });
      },
      { durationMs: SAMPLE_DURATION_MS },
    );

    expect(
      medianFps,
      `Expected median FPS >= ${MIN_FPS_THRESHOLD}, got ${medianFps.toFixed(1)} fps`,
    ).toBeGreaterThanOrEqual(MIN_FPS_THRESHOLD);
  });

  test("office view renders without JavaScript errors", async ({ page }) => {
    const jsErrors: string[] = [];

    page.on("pageerror", (err) => {
      jsErrors.push(err.message);
    });

    await page.goto("/");
    await expect(page.locator("body").first()).toBeVisible();

    // Allow React hydration and initial animations to settle.
    await page.waitForTimeout(1000);

    expect(jsErrors, `JS errors on load: ${jsErrors.join("; ")}`).toHaveLength(0);
  });

  test("design token API returns valid response", async ({ request }) => {
    const response = await request.get("/api/room-design/tokens?scope=global");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.scope).toBe("global");
    expect(typeof body.tokens).toBe("object");
  });

  test("design token all-scopes API returns valid response", async ({ request }) => {
    const response = await request.get("/api/room-design/tokens/all");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.scopes).toBe("object");
  });
});
