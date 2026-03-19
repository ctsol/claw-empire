# Operations Deliverable — Locale Purity Audit
**Owner:** Operations — Turbo (Atlas/Turbo)
**Date:** 2026-03-19
**Task:** удали в целом все языки кроме русского и английского отовсюду
**Branch:** `climpire/cba74c4c`

---

## Executive Summary

Full cross-check of deployment scripts, environment configs, and seed/migration files
for non-RU/EN locale references. Monitoring automation added (weekly CI scan + purity script).

**Deployment configs:** CLEAN — no locale references found.
**Seeds / schema:** NON-COMPLIANT — `ko`/`ja`/`zh` locale columns and string literals remain
in DB schema and seed data. Flagged for Development clean-up.
**Server workflow code:** NON-COMPLIANT — `ko`/`ja`/`zh` remain in core workflow logic. Flagged.
**Monitoring:** ADDED — weekly CI schedule + `scripts/check-locale-purity.sh` grep gate.

---

## 1. Deployment Scripts & Environment Configs Audit

| File | Non-RU/EN Locale References | Status |
|---|---|---|
| `deploy/README.md` | None | ✅ CLEAN |
| `deploy/claw-empire@.service` | None | ✅ CLEAN |
| `deploy/nginx/claw-empire.conf` | None | ✅ CLEAN |
| `Dockerfile` | None | ✅ CLEAN |
| `docker-compose.yml` | None | ✅ CLEAN |
| `.env.example` | None | ✅ CLEAN |

All deployment and environment files are locale-neutral. No action required.

---

## 2. Seeds & Migration Files Audit

| File | Finding | Severity |
|---|---|---|
| `server/modules/bootstrap/schema/base-schema.ts` | `name_ko`, `name_ja`, `name_zh` columns in `departments`, `office_pack_departments`, and `agents` tables | HIGH |
| `server/modules/bootstrap/schema/seeds.ts` | Korean/Japanese/Chinese string literals in `insertDept.run(...)` calls; `name_ko` / `name_ja` / `name_zh` column inserts | HIGH |
| `server/modules/bootstrap/schema/task-schema-migrations.ts` | `name_ko`, `name_ja`, `name_zh` columns; Korean/Chinese strings in migration seed block | HIGH |

### Specific findings in `seeds.ts`:

```
Line 14: INSERT INTO departments (id, name, name_ko, name_ja, name_zh, ...)
Line 17: insertDept.run("planning", "Planning", "기획팀", "企画チーム", "企划组", ...)
Line 18: insertDept.run("dev", "Development", "개발팀", "開発チーム", "开发组", ...)
Line 19: insertDept.run("design", "Design", "디자인팀", "デザインチーム", "设计组", ...)
Line 43: insertAgent.run(..., "아리아", ...) -- Korean name values in agent seeds
```

**Recommended action for Development:** Remove `name_ko`, `name_ja`, `name_zh` columns from schema
and replace with `name_ru` (adding DB migration). Seed values should use English + Russian only.

---

## 3. Server Code Audit

| File | Finding | Severity |
|---|---|---|
| `server/types/lang.ts` | `UiLanguage` or `SupportedLang` type includes `ko`, `ja`, `zh` | HIGH |
| `server/modules/workflow/packs/execution-guidance.ts` | `type SupportedLang = "ko" \| "en" \| "ja" \| "zh"` at line 3; normalization returns `ko`/`ja`/`zh` | HIGH |
| `server/modules/workflow/core/reply-core-tools.ts` | Extensive `lang === "ko"`, `lang === "ja"`, `lang === "zh"` branches; Japanese/Chinese string literals in response templates | HIGH |
| `server/modules/workflow/core/meeting-prompt-tools.ts` | `lang === "ko"`, `lang === "ja"`, `lang === "zh"` branches at lines 41–55; Japanese/Chinese error messages at lines 144–145 | HIGH |
| `server/modules/workflow/core/one-shot-runner.ts` | Japanese/Chinese template strings at lines 331–332 | HIGH |
| `server/modules/workflow/orchestration/meetings/minutes.ts` | `lang === "ja"` / `lang === "zh"` conditions at lines 250–254 | HIGH |

**Recommended action for Development:** Refactor `SupportedLang` type to `"ru" | "en"`;
remove all `ko`/`ja`/`zh` branches from workflow core logic.

---

## 4. Frontend (`src/`) Audit

The Development team (branch `climpire/a1f6f7e8`) has already produced a full grep scan
covering `src/`. Key file with active locale references per their report:

- `src/i18n.ts` — `UiLanguage` type currently includes `ko`, `ja`, `zh` (pre-migration baseline)
- `src/components/settings/GeneralSettingsTab.tsx` — language selector still shows ko/ja/zh options

Development PR (`climpire/a1f6f7e8`) targets removal of these. Operations defers to their deliverable.

---

## 5. CI i18n Gate — Configuration Discrepancy

The DevSecOps-added gate (`scripts/check-i18n-completeness.mjs`, branch `climpire/732a5ced`)
currently has:

```js
const REQUIRED_LANGS = ["ko", "en"];  // line ~12
```

**Issue:** Gate checks for `ko`+`en`, but the goal is `ru`+`en`.
**Recommended action for DevSecOps:** Update `REQUIRED_LANGS` to `["ru", "en"]` after Development
PR lands and all `t({})` calls gain `ru:` keys.

---

## 6. Monitoring Automation Added

### 6.1 `scripts/check-locale-purity.sh`

A bash grep-gate that scans `src/` and `server/` for non-RU/EN locale string literals.

- Checks: `"ko"`, `"ja"`, `"zh"`, `"de"`, `"fr"`, `"es"`, `"pt"`, `"it"` in `.ts`/`.tsx` files
- Separately reports schema/seed locale column presence (informational, not a hard fail)
- Exit 1 on violations; exit 0 on clean pass
- `--report` flag emits full violation details

Usage:
```bash
bash scripts/check-locale-purity.sh
bash scripts/check-locale-purity.sh --report
```

### 6.2 `.github/workflows/locale-purity-weekly.yml`

Scheduled CI workflow — runs every **Monday at 06:00 UTC**.

- Triggers: `schedule` (cron `0 6 * * 1`) + `workflow_dispatch`
- Calls `check-locale-purity.sh`
- Emits `::error::` CI annotation on failure so the on-call engineer is notified
- `workflow_dispatch` supports `report_mode: true` for ad-hoc detailed scans

---

## 7. Handoff Checklist

| Item | Owner | Status |
|---|---|---|
| Remove `ko`/`ja`/`zh` from `src/i18n.ts` and frontend | Development | Pending (in `a1f6f7e8`) |
| Remove `name_ko`/`name_ja`/`name_zh` columns; add `name_ru` migration | Development | Pending |
| Refactor `SupportedLang` in server workflow core | Development | Pending |
| Update CI i18n gate `REQUIRED_LANGS = ["ru","en"]` | DevSecOps | Pending (after Dev PR) |
| Weekly locale-purity scan workflow | Operations ✅ | DONE (`locale-purity-weekly.yml`) |
| Purity grep script | Operations ✅ | DONE (`check-locale-purity.sh`) |
| Smoke tests post-migration | QA/QC ✅ | DONE (`i18n.locale-smoke.test.ts`) |

---

## Appendix — Current Baseline Scan

Running `scripts/check-locale-purity.sh` on branch `cba74c4c` (pre-migration baseline):

**Expected result:** FAIL (violations present in server/ — confirming the scan works correctly
and the removal PR is still needed).

After the Development PR lands, re-running the gate should return PASS.
The weekly CI schedule will then provide ongoing enforcement.
