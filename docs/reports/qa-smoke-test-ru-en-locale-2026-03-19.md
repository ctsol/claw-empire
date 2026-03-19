# QA Smoke Test Report — RU/EN Locale Migration

**Owner:** QA/QC (Speaky / Саша)
**Date:** 2026-03-19
**Related PR:** Development branch `climpire/a1f6f7e8` (ko/ja/zh removal + RU promotion)
**Test file:** `src/i18n.locale-smoke.test.ts`
**Status:** READY FOR POST-MERGE EXECUTION

---

## Purpose

Validates that after the locale-removal PR lands, both RU and EN locales:
- Render without console errors or warnings
- Produce no missing-key scenarios (both fields are now required in `LangText`)
- Correctly replace all previously supported locales (ko, ja, zh)

---

## Scope of Changes Tested

| Change | Development Branch (`a1f6f7e8`) | Test Coverage |
|---|---|---|
| `UiLanguage` reduced to `"ru" \| "en"` | `src/i18n.ts:4` | Suite 1, 2 |
| `LangText` — `ru` now required (not optional) | `src/i18n.ts:8-11` | Suite 3 |
| `parseLanguage` — ko/ja/zh removed from switch | `src/i18n.ts:15-19` | Suite 1 |
| `localeFromLanguage` — ko/ja/zh cases removed | `src/i18n.ts:60-69` | Suite 2 |
| `pickLang` — ko/ja/zh cases removed | `src/i18n.ts:71-80` | Suite 3 |
| `localeName` — simplified to ru/en only | `src/i18n.ts:27-34` | Suite 4 |
| Language selector — only `ru` / `en` options | `GeneralSettingsTab.tsx:170-171` | Suite 7 (via Provider) |
| `useAppLabels.ts` — all keys have `ru:` field | `src/app/useAppLabels.ts` | Suite 7 |

---

## Test Suites

### Suite 1 — `normalizeLanguage`
Verifies RU/EN recognized, ko/ja/zh degrade to `"en"`, unknown codes degrade to `"en"`.
**Pass criteria:** All assertions green, no exceptions thrown.

### Suite 2 — `localeFromLanguage`
Verifies `ru → "ru-RU"`, `en → "en-US"`, unknown runtime value → `"en-US"`.
**Pass criteria:** Exact IETF locale string returned.

### Suite 3 — `pickLang` (no missing-key warnings)
Verifies correct text selection for RU/EN, no `console.warn` emitted.
Covers the removed-locale runtime edge case (old stored code like `"ko"`).
**Pass criteria:** `console.warn` spy records zero calls.

### Suite 4 — `localeName`
Verifies entity name localisation for RU/EN; empty `name_ru` falls back to `name`.
Removed locales (ko, ja, zh) fall back to `name`.
**Pass criteria:** No crash, correct string returned.

### Suite 5 — `detectBrowserLanguage`
Verifies browser locale detection for RU and EN.
Verifies ko/ja/zh browser locales degrade to `"en"`.
Verifies correct priority ordering when list contains mixed locales.
**Pass criteria:** Returns `"ru"` or `"en"` in all cases.

### Suite 6 — localStorage persistence
Verifies that reading a stored `"ru"` or `"en"` value round-trips correctly.
Verifies that stale ko/ja/zh stored values degrade to `"en"` without crash.
**Pass criteria:** No exception on stale value, `normalizeLanguage` returns `"en"`.

### Suite 7 — React integration (`I18nProvider` + `useI18n`)
Verifies no `console.error` or `console.warn` during React render with RU or EN.
Verifies `t()` returns correct translated string for both locales.
Verifies `useI18n` override works in both directions (RU override in EN provider, EN override in RU provider).
Verifies a stale locale in Provider props gracefully falls back to EN.
**Pass criteria:** Both error and warn spies record zero calls; rendered values correct.

---

## How to Run

```bash
# Run smoke tests only
pnpm run test:web -- --reporter=verbose src/i18n.locale-smoke.test.ts

# Run full web test suite (includes smoke)
pnpm run test:web
```

---

## Known Edge Cases Covered

| Scenario | Expected Behaviour | Suite |
|---|---|---|
| User has `"ko"` stored in localStorage from before migration | Falls back to EN without crash | 6 |
| Browser sends `ko-KR` as navigator.language | Detected as EN | 5 |
| Provider receives stale `"ja"` from DB settings record | Falls back to EN | 7 |
| `pickLang` called with old `"zh"` type-cast value | Returns EN text | 3 |
| `localeName` called with `"ko"` locale | Returns `name` (English) | 4 |

---

## Out of Scope (Follow-up)

- E2E / Playwright tests for full UI render (no Playwright setup available)
- Snapshot tests for rendered component output in each locale
- Server-side locale validation (Operations scope)
