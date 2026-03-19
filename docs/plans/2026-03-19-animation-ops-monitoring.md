# Animation System — Operations Monitoring Plan
**Date:** 2026-03-19
**Owner:** Operations (Team Leader)
**Scope:** Operational support for office animation & room design token infrastructure
**Status:** Active

---

## 1. Context

Following the CEO meeting decision to integrate animation events with room spawn/delegation workflows and introduce new animation room state API endpoints, Operations is responsible for:

1. Real-time monitoring of animation API endpoint availability and performance
2. WebSocket anomaly alerting (animation trigger delays)
3. Operational support for spawn/delegation → animation event pipeline
4. Runbook maintenance for incident response

---

## 2. Endpoints Under Monitoring

| Endpoint | Method | Criticality | SLO (p95 latency) |
|---|---|---|---|
| `GET /api/ops/room-design-tokens` | Public | Medium | < 200ms |
| `PUT /api/ops/room-design-tokens` | Admin | Medium | < 300ms |
| `GET /api/ops/room-settings` | Admin/Agent | Medium | < 200ms |
| `PUT /api/ops/room-settings` | Admin | Medium | < 300ms |
| `GET /api/ops/room-settings/audit` | Admin | Low | < 500ms |

Source: `docs/openapi.json` (merged from `climpire/100d6d67`, `climpire/e9493826`)

---

## 3. Monitoring Setup

### 3.1 Health Checks

- **Interval:** 60 seconds
- **Method:** `GET /api/ops/room-design-tokens` → expect HTTP 200, body JSON
- **Tool:** Existing CI health-check infra (`ci.yml` readiness probe)
- **Alert threshold:** 2 consecutive failures → PagerDuty / Slack `#ops-alerts`

### 3.2 Latency Gate

Covered by CI workflow `.github/workflows/perf-gate.yml` (merged from `climpire/100d6d67`):
- rAF FPS sampler: assert median ≥ 30 fps
- Runs on every PR and push to `main`
- Blocking gate — PR cannot merge on failure

Additional latency assertions in `.github/workflows/animation-performance-gate.yml` (from `climpire/e9493826`):
- FPS measurement via `requestAnimationFrame` loop
- JS error absence check on office view load

### 3.3 WebSocket Animation Trigger Monitoring

Animation events are triggered by spawn and delegation events over WebSocket.
Monitoring targets:

| Signal | Threshold | Action |
|---|---|---|
| Animation trigger delay (spawn event → frame rendered) | > 500ms p95 | Warning alert |
| WS reconnection rate | > 5/min per client | Investigate WS proxy config |
| Missed animation triggers (spawn without visual event) | > 1% of events | Escalate to Development |

**Instrumentation approach:** Server-side timing headers in spawn/delegation routes + client `performance.mark()` entries logged to `/api/ops/metrics` (future endpoint, see §6).

---

## 4. Operational Runbook

### Incident: Animation API endpoint down

1. Check server logs: `pm2 logs claw-empire | grep "room-design"`
2. Verify database migration ran: check `room_settings` table existence
   (`server/modules/bootstrap/schema/task-schema-migrations.ts`)
3. Restart service: `sudo systemctl restart claw-empire@production`
4. If migration missing: trigger manual migration via deployment script

### Incident: FPS regression detected in CI

1. Review failed `perf-gate.yml` run → check which test assertion failed
2. If `median fps < 30`: notify Development team (Миша)
3. If `long tasks > 5`: check for newly merged animation library additions
4. Hold release merge until Development confirms fix

### Incident: WebSocket animation delays > 500ms

1. Check WS proxy config (`deploy/nginx/claw-empire.conf`) — ensure `proxy_read_timeout` ≥ 60s
2. Verify no new middleware added to WS upgrade path
3. Check server CPU under load — animation events are non-critical, consider rate limiting in high-load periods

---

## 5. Audit Log Operations

The `room_settings_audit` table provides a full change trail.

**Regular tasks:**
- **Weekly:** Export audit log snapshot to `docs/reports/` (automated via cron)
- **On demand:** Admin can query `GET /api/ops/room-settings/audit?scope=room_design`
- **Retention:** 90 days (align with existing audit policy)

**Access control verified (per RBAC contract test in `tests/perf/animation-fps.spec.ts`):**
- `admin` role: read + write room settings
- `agent` role: read-only
- Unauthenticated: 401

---

## 6. Future Operational Improvements (Backlog)

| Item | Priority | Notes |
|---|---|---|
| `POST /api/ops/metrics` endpoint for client-side animation telemetry | Medium | Enables real WebSocket trigger latency tracking |
| Grafana dashboard for room animation API latency percentiles | Low | Once metrics endpoint available |
| Automated audit log archival cron job | Low | Currently manual |
| Load test: 50 concurrent room design token reads | Low | Baseline before production traffic |

---

## 7. Dependencies

| Team | Dependency |
|---|---|
| Development (Миша) | Animation model, CSS tokens, `animMode` API |
| DevSecOps (Роман) | CI perf gate workflows, RBAC enforcement, audit schema |
| QA (Ира) | E2E performance benchmark specs |
| Operations (this plan) | Runtime monitoring, alerting, runbooks |
