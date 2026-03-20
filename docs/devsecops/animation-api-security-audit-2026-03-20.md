# Security Audit: Animation Office API Endpoints
**Date:** 2026-03-20
**Scope:** New endpoints introduced for the animation/room-design task
**Auditor:** DevSecOps
**Classification:** Internal

---

## Endpoints Audited

| Route | File | Auth Gate |
|---|---|---|
| `GET /api/room-settings` | `server/modules/routes/ops/room-settings.ts` | Global session middleware |
| `GET /api/room-settings/:roomId` | same | Global session middleware |
| `PUT /api/room-settings/:roomId` | same | Global session middleware + header-RBAC |
| `GET /api/room-settings-audit` | same | Global session middleware + header-RBAC |
| `GET /api/room-design/tokens` | `server/modules/routes/ops/room-design-tokens.ts` | **Public** (by design) |
| `GET /api/room-design/tokens/all` | same | **Public** (by design) |
| `PUT /api/room-design/tokens` | same | `isAuthenticated()` |
| `GET /api/room-design/audit` | same | `isAuthenticated()` |

---

## Summary

**CRITICAL:** 0
**HIGH:** 0
**MEDIUM:** 3
**LOW:** 3

All session authentication is enforced by the global middleware in `installSecurityMiddleware` (`server/security/auth.ts:212-220`). WebSocket upgrade is gated by `isIncomingMessageAuthenticated` + `isIncomingMessageOriginTrusted` (`server/modules/lifecycle.ts:655`). No injection vectors identified — all DB access uses parameterized queries; room ID is normalized via allowlist regex.

---

## Findings

### MEDIUM-1: `x-actor-role` / `x-actor-id` missing from CORS `allowedHeaders`

**Location:** `server/security/auth.ts:187`
**Description:**
`installSecurityMiddleware` lists CORS allowed request headers as:
```
["content-type", "authorization", "x-inbox-secret", "x-csrf-token", "x-task-interrupt-token"]
```
`x-actor-role` and `x-actor-id` are absent. For cross-origin requests from browser contexts (e.g., internal agent UIs on a different port), the CORS preflight will not include these headers, and the browser will strip them. As a result:
- Agent processes calling `PUT /api/room-settings/:roomId` from a browser cross-origin context will always receive the default `"admin"` role, bypassing role restriction.
- Audit records will lack `actor_id` for cross-origin agent calls.

**Risk:** An agent UI component could inadvertently write room settings with elevated role because the header was silently dropped.
**Recommendation:** Add `"x-actor-role"` and `"x-actor-id"` to the `allowedHeaders` list in `installSecurityMiddleware`.

---

### MEDIUM-2: Internal error detail leaked in 500 responses

**Location:** `server/modules/routes/ops/room-settings.ts` — all four handlers
**Description:**
All `catch` blocks return the raw error as a string in the HTTP response body:
```ts
res.status(500).json({ ok: false, error: "…", detail: String(err) });
```
SQLite error messages can expose table names, column names, file system paths (e.g., the `.db` file path), and constraint names to any authenticated user.
**Risk:** Information disclosure to authenticated users; aids enumeration of the internal DB schema.
**Recommendation:** Log the full error server-side; return only a generic error code in the response. Note: `room-design-tokens.ts` has the same pattern and should be updated together.

---

### MEDIUM-3: Spoofable `actor_id` in audit trail

**Location:** `server/modules/routes/ops/room-settings.ts:33-40`, `219`
**Description:**
`resolveActorId` reads the `x-actor-id` header verbatim and stores it in `room_settings_audit.actor_id`. Any authenticated user can set this header to any value (up to 128 chars), creating false audit entries attributing changes to arbitrary identities.
**Risk:** Audit trail integrity is not guaranteed; forensic value is reduced.
**Recommendation:** Derive `actor_id` from the verified session token (e.g., hash of `SESSION_AUTH_TOKEN`) rather than a client-supplied header, or mark the field as "claimed identity" in documentation and tooling.

---

### LOW-1: No WebSocket connection count limit

**Location:** `server/modules/lifecycle.ts:652-682`
**Description:**
The WebSocket server accepts any number of authenticated connections. There is no upper bound on `wsClients.size`. For a single-admin local tool this is acceptable, but worth documenting.
**Risk:** A script using the valid session token could open many connections and exhaust file descriptors.
**Recommendation:** Add a soft cap (e.g., 20 connections) with a warning log; enforce hard cap at OS-reasonable limit if deployed remotely.

---

### LOW-2: Public read on `/api/room-design/tokens`

**Location:** `server/modules/routes/ops/room-design-tokens.ts:37,67`
**Description:**
`GET /api/room-design/tokens` and `/api/room-design/tokens/all` are intentionally unauthenticated ("Public" comment in source). Design tokens include visual configuration (colors, animation parameters). No sensitive data is stored here currently.
**Risk:** Expands the unauthenticated attack surface. If future tokens include feature flags or configuration that leaks deployment information, this becomes a higher-severity issue.
**Recommendation:** Document the public-access decision in the route file comment. Add a schema validation step to ensure tokens stored here can only contain visual/CSS values.

---

### LOW-3: No rate limiting on `PUT /api/room-settings/:roomId`

**Location:** `server/modules/routes/ops/room-settings.ts:155`
**Description:**
There is no rate limit on the write endpoint. An authenticated user can write room settings in a tight loop, producing unbounded audit log growth and SQLite I/O load.
**Risk:** Negligible for a single-admin tool; relevant if the session token is ever shared or the app is exposed to a network.
**Recommendation:** Add Express rate-limit middleware (e.g., `express-rate-limit`) to the `/api/room-settings` write path, capped at ~30 req/min per IP.

---

## WebSocket Monitoring Checklist

The existing WebSocket hub (`server/ws/hub.ts`) and lifecycle code (`server/modules/lifecycle.ts`) provide adequate baseline observability. The following should be monitored in production/staging to ensure animation events do not cause connection leaks or overload:

| Metric | How to observe | Alert threshold |
|---|---|---|
| Active WS connections | `wsClients.size` logged on connect/disconnect | > 10 simultaneous |
| Batch queue depth | `batches.get(type).queue.length` in hub | > 50 items (current cap: 60) |
| Unauthenticated upgrade attempts | Count of `ws.close(1008)` calls in lifecycle:656 | > 5/min |
| Uncaught errors in `sendRaw` | The flush loop in hub.ts:58-62 silently swallows send errors | Add counter + periodic log |
| New animation event types (`room_update`, `spawn_anim`, `delegate_anim`) | Verify they are routed through `broadcast()`, not raw `sendRaw()` | N/A — design review |

> **Note on new spawn/delegation events:** Per the CEO directive, spawn and delegation events should trigger office animations. When these events are wired to WS broadcasts, confirm they use the existing `broadcast()` function (which has back-pressure via batching + MAX_BATCH_QUEUE) and not a direct `ws.send()` loop. Bypassing the hub would eliminate the shed-oldest protection and risk OOM under burst conditions.

---

## CI/CD Impact Assessment

| Check | Status | Notes |
|---|---|---|
| New E2E spec (`ci-office-animation-sanity.spec.ts`) | Included in `pnpm run test:ci` | No CI workflow changes needed |
| CORS header gap (MEDIUM-1) | Not caught by existing tests | QA spec sends `x-actor-role` directly; cross-origin CORS scenario not covered |
| Error detail leakage (MEDIUM-2) | Not caught by existing tests | Tests assert `ok: false` on errors but do not assert absence of `detail` field |
| Spoofable actor_id (MEDIUM-3) | Not caught by existing tests | Audit integrity tests would need server-side session binding |

No changes to `.github/workflows/ci.yml` are required. The existing pipeline (format → lint → type-check → build → Playwright `test:ci`) will run the new sanity spec automatically.

---

## Sign-off

All CRITICAL and HIGH findings: **none**.
MEDIUM/LOW findings are documented above as warnings per the MVP Code Review Policy.
No code changes produced in this audit run (policy: MEDIUM/LOW → report only).
