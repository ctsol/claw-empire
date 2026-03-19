# Spec: Remove All Locales Except Russian and English

**Owner:** Planning (Clio)
**Date:** 2026-03-19
**Status:** Ready for Engineering
**Reviewers:** Engineering (Aria/Bolt), QA (DORO/Speaky), DevSecOps (Raven/Pipe)

---

## Summary

Remove `ko`, `ja`, `zh` locale support everywhere in the codebase. Add `ru` (Russian) as a first-class supported locale alongside `en` (English). The target state is: **`"ru" | "en"` only**, with no traces of Korean, Japanese, or Chinese remaining.

Current state: `ko | en | ja | zh`
Target state: `ru | en`

---

## Scope

116 files in `src/`, 63 files in `server/` contain locale references. Changes are grouped by **execution tier** — lower tiers must complete before higher tiers can compile.

---

## Tier 1 — Core Type Definitions (blockers for all other tiers)

### 1. `src/i18n.ts`

**Change `UiLanguage` union type:**
```ts
// BEFORE
export type UiLanguage = "ko" | "en" | "ja" | "zh";

// AFTER
export type UiLanguage = "ru" | "en";
```

**Change `LangText`:**
```ts
// BEFORE
export type LangText = { ko: string; en: string; ja?: string; zh?: string };

// AFTER
export type LangText = { ru: string; en: string };
```

**Update `parseLanguage`:** Remove `ko`, `ja`, `zh` branches. Add `ru` branch:
- `if (code === "ru" || code.startsWith("ru-")) return "ru";`

**Update `normalizeLanguage`:** Fallback remains `"en"`.

**Update `localeName`:** Remove `ko`, `ja`, `zh` branches. Add `ru`:
- `if (lang === "ru") return obj.name_ru || obj.name;`
- Signature: replace `name_ko`/`name_ja`/`name_zh` with `name_ru`

**Update `localeFromLanguage`:**
```ts
case "ru": return "ru-RU";
case "en": return "en-US";
default:   return "en-US";
```

**Update `pickLang`:**
```ts
case "ru": return text.ru;
case "en": return text.en;
default:   return text.en;
```

**Update `detectBrowserLanguage`:** The existing logic in `parseLanguage` handles detection; no direct change needed beyond the above.

---

### 2. `server/types/lang.ts`

```ts
// BEFORE
export type Lang = "ko" | "en" | "ja" | "zh";
export const SUPPORTED_LANGS: readonly Lang[] = ["ko", "en", "ja", "zh"] as const;

// AFTER
export type Lang = "ru" | "en";
export const SUPPORTED_LANGS: readonly Lang[] = ["ru", "en"] as const;
```

---

## Tier 2 — Database Schema

### 3. `server/modules/bootstrap/schema/base-schema.ts`

In the `departments`, `agents`, and any other table that has `name_ko / name_ja / name_zh` columns:

- Rename `name_ko` → `name_ru`
- Remove `name_ja` and `name_zh` columns entirely

**Example (departments table):**
```sql
-- BEFORE
name_ko TEXT NOT NULL,
name_ja TEXT NOT NULL DEFAULT '',
name_zh TEXT NOT NULL DEFAULT '',

-- AFTER
name_ru TEXT NOT NULL DEFAULT '',
```

Same for `agents` table.

### 4. `server/modules/bootstrap/schema/task-schema-migrations.ts`

Add a migration step that:
1. Adds `name_ru TEXT NOT NULL DEFAULT ''` to `departments` and `agents`
2. Drops `name_ko`, `name_ja`, `name_zh` columns (SQLite: recreate table via copy strategy)

### 5. `server/modules/bootstrap/schema/seeds.ts`

Update all `INSERT` statements:
- Replace `name_ko` column with `name_ru`
- Remove `name_ja`, `name_zh` columns and their values
- Provide Russian translations for seeded department/agent names

---

## Tier 3 — Server Backend Logic

### 6. `server/modules/routes/collab/language-policy.ts` (HIGH COMPLEXITY)

This file contains the most locale-specific logic. Required changes:

**`ROLE_LABEL_L10N`:** Remove `ko`, `ja`, `zh` keys. Add `ru`:
```ts
{ team_leader: { ru: "Тимлид", en: "Team Lead" }, ... }
```

**`l()` helper function:** Signature `l(ko, en, ja?, zh?)` → `l(ru, en)`, returns `L10n` with only `ru` and `en` keys.

**`getFlairs()`:** Replace all 4-lang objects with 2-lang `{ ru: [...], en: [...] }` per agent.

**`detectLang()`:** Remove Korean/Japanese/Chinese Unicode range checks. Add Russian (Cyrillic) detection:
```ts
const ru = text.match(/[\u0400-\u04FF]/g)?.length ?? 0;
if (ru / total > 0.15) return "ru";
return "en";
```

**`classifyIntent()`:** Remove `ja`/`zh` regex patterns from every intent category. Keep `en` patterns. Add `ru` patterns (Cyrillic-based).

**`langIdx` mapping:** `{ ru: 0, en: 1 }` (remove ko/ja/zh).

**`resolveLang()` / `getPreferredLanguage()`:** No structural change, but `isLang()` now only accepts `"ru" | "en"`.

**`detectTargetDepartments()`:** DB query `SELECT id, name, name_ru FROM departments` — remove `name_ko`, `name_ja`, `name_zh` from SELECT and alias collection.

**`DEPT_KEYWORDS`:** Replace Korean keyword strings with Russian equivalents:
```ts
dev: ["разработка", "код", "фронтенд", "бэкенд", "API", "сервер", "баг", "приложение", "веб"],
design: ["дизайн", "UI", "UX", "макет", "иконка", "логотип", "баннер", "лейаут"],
planning: ["планирование", "стратегия", "анализ", "исследование", "отчёт", "рынок"],
operations: ["операции", "деплой", "инфраструктура", "мониторинг", "CI", "CD", "DevOps"],
qa: ["QA", "QC", "качество", "тест", "регрессия", "автотест", "производительность"],
devsecops: ["безопасность", "уязвимость", "аутентификация", "SSL", "файрвол", "контейнер", "докер", "шифрование"],
```

**`analyzeDirectivePolicy()`:** Remove Japanese/Chinese strings from `isNoTask` and `hasLightweightSignal` arrays. Keep Korean → replace with Russian equivalents (e.g., `"без задачи"`, `"без делегирования"`, `"тест ответа"`).

### 7–54. Other server files (54 files total)

All files referencing `name_ko`, `name_ja`, `name_zh` in SQL queries, TypeScript types, or runtime logic must:
- Replace `name_ko` → `name_ru`
- Remove `name_ja`, `name_zh` from SELECT/INSERT/type definitions

**Key server files needing updates (not exhaustive):**
- `server/modules/routes/core/departments.ts`
- `server/modules/routes/core/projects.ts`
- `server/modules/routes/core/agents/crud.ts`
- `server/modules/routes/core/agents/process-inspector.ts`
- `server/modules/routes/core/tasks/execution-run.ts`
- `server/modules/routes/core/tasks/execution-run-auto-assign.ts`
- `server/modules/routes/collab/task-delegation.ts`
- `server/modules/routes/collab/announcement-response.ts`
- `server/modules/routes/collab/chat-response.ts`
- `server/modules/routes/collab/coordination.ts`
- `server/modules/routes/collab/coordination/cross-dept-cooperation.ts`
- `server/modules/routes/collab/coordination/types.ts`
- `server/modules/routes/collab/direct-chat-progress-summary.ts`
- `server/modules/routes/collab/direct-chat-types.ts`
- `server/modules/routes/collab/office-pack-agent-hydration.ts`
- `server/modules/routes/collab/subtask-delegation.ts`
- `server/modules/routes/collab/subtask-delegation-prompt.ts`
- `server/modules/routes/ops/task-reports/helpers.ts`
- `server/modules/routes/ops/messages/decision-inbox/types.ts`
- `server/modules/routes/ops/messages/decision-inbox/messenger-notice-format.ts`
- `server/modules/routes/ops/messages/decision-inbox/project-review-planning.ts`
- `server/modules/routes/ops/messages/decision-inbox/project-timeout-items.ts`
- `server/modules/routes/ops/messages/decision-inbox/review-round-items.ts`
- `server/modules/workflow/orchestration.ts`
- `server/modules/workflow/orchestration/meetings/leader-selection.ts`
- `server/modules/workflow/orchestration/meetings/minutes.ts`
- `server/modules/workflow/orchestration/meetings/presence.ts`
- `server/modules/workflow/core/reply-core-tools.ts`
- `server/modules/workflow/core/conversation-types.ts`
- `server/modules/workflow/core/meeting-prompt-tools.ts`
- `server/modules/workflow/agents/subtask-routing.ts`
- `server/modules/workflow/packs/department-scope.ts`
- `server/modules/workflow/packs/execution-guidance.ts`
- `server/modules/routes/shared/types.ts`
- `server/modules/routes/collab.ts`
- `server/modules/lifecycle.ts`

**Pattern to apply across all:** Any `{ ko: ..., en: ..., ja: ..., zh: ... }` object → `{ ru: ..., en: ... }`.

---

## Tier 4 — Frontend Components (116 files in `src/`)

### Translation object pattern replacement

Every `t({ ko: "...", en: "...", ja: "...", zh: "..." })` call must become `t({ ru: "...", en: "..." })`.

The Russian string must be a proper translation of the English string (not a copy).

**Strategy for Engineering:** A mechanical find-replace followed by manual Russian string fill-in is acceptable. The `LangText` type change in Tier 1 will cause TypeScript compile errors for every remaining 3-4 key object — use `tsc --noEmit` as a sweep to find all remaining call sites.

### 8. `src/components/settings/GeneralSettingsTab.tsx`

Update the language selector `<select>`:
```tsx
// BEFORE
<option value="ko">{t({ ko: "한국어", en: "Korean", ja: "韓国語", zh: "韩语" })}</option>
<option value="en">{t({ ko: "영어", en: "English", ja: "英語", zh: "英语" })}</option>
<option value="ja">{t({ ko: "일본어", en: "Japanese", ja: "日本語", zh: "日语" })}</option>
<option value="zh">{t({ ko: "중국어", en: "Chinese", ja: "中国語", zh: "中文" })}</option>

// AFTER
<option value="ru">{t({ ru: "Русский", en: "Russian" })}</option>
<option value="en">{t({ ru: "Английский", en: "English" })}</option>
```

Also update all translation objects in this file (Company, CEO Name, Auto Assign, YOLO Mode, etc.).

### Other high-traffic frontend files needing updates:
- `src/components/agent-manager/AgentFormModal.tsx`
- `src/components/agent-manager/DepartmentFormModal.tsx`
- `src/components/agent-manager/AgentCard.tsx`
- `src/components/agent-manager/EmojiPicker.tsx`
- `src/components/chat-panel/ChatComposer.tsx`
- `src/components/chat-panel/ChatPanelHeader.tsx`
- `src/components/skills-library/SkillsHeader.tsx`
- `src/components/skills-library/SkillsGrid.tsx`
- `src/components/dashboard/HeroSections.tsx`
- `src/components/taskboard/FilterBar.tsx`
- All files in `src/components/settings/`

---

## Tier 5 — Tests

### 9. `src/i18n.ru-status.test.ts`

This file currently documents that Russian is **NOT** supported. After the change, it should be **replaced** with a test that:
- Confirms `normalizeLanguage("ru")` returns `"ru"` (not `"en"`)
- Confirms `localeFromLanguage("ru")` returns `"ru-RU"`
- Confirms `pickLang("ru", { ru: "привет", en: "hello" })` returns `"привет"`
- Confirms `SUPPORTED_LANGS` equals `["ru", "en"]`
- Confirms `normalizeLanguage("ko")`, `normalizeLanguage("ja")`, `normalizeLanguage("zh")` all fall back to `"en"`

### 10. Server test files

All server test files that use `name_ko`, `name_ja`, `name_zh` in mock/fixture data must be updated to use `name_ru` only. Key tests:
- `server/modules/routes/collab/language-policy.test.ts`
- `server/modules/routes/collab/office-pack-agent-hydration.test.ts`
- `server/modules/routes/core/agents/crud.seed-filter.test.ts`
- `server/modules/routes/ops/settings-stats.seed-init.test.ts`
- `server/modules/routes/ops/task-reports/helpers.test.ts`
- `server/modules/routes/collab/coordination/cross-dept-cooperation.test.ts`
- `server/modules/workflow/core/meeting-prompt-tools.test.ts`
- `server/modules/workflow/orchestration/meetings/leader-selection.test.ts`
- `src/i18n.test.ts` — update any `ko/ja/zh` assertions

---

## Execution Order for Engineering

```
Tier 1 (types)  →  Tier 2 (DB schema)  →  Tier 3 (server logic)  →  Tier 4 (frontend)  →  Tier 5 (tests)
```

**Recommended approach:**
1. Change `src/i18n.ts` and `server/types/lang.ts` first — TypeScript will surface every remaining call site as a compile error.
2. Run `tsc --noEmit` to get full error list across `src/`.
3. Fix DB schema + migrations.
4. Fix server files (use `grep -r "name_ko\|name_ja\|name_zh" server/` to enumerate).
5. Fix frontend files — the `LangText` type errors from step 2 guide this.
6. Update tests last.

---

## Russian Translations Reference (for common UI strings)

| English | Russian |
|---------|---------|
| Company | Компания |
| Company Name | Название компании |
| CEO Name | Имя CEO |
| Auto Assign | Авто-назначение |
| YOLO Mode | YOLO режим |
| Auto Update (Global) | Автообновление (глобально) |
| OAuth Auto Swap | Авто-переключение OAuth |
| Default CLI Provider | CLI провайдер по умолчанию |
| Language | Язык |
| Russian | Русский |
| English | Английский |
| Save | Сохранить |
| Saved | Сохранено |
| Settings | Настройки |
| Team Lead | Тимлид |
| Senior | Старший |
| Junior | Младший |
| Intern | Стажёр |

---

## CI Gate (DevSecOps deliverable)

After this PR lands, the CI gate (owned by Raven) must grep for any reintroduction of `ko`/`ja`/`zh` locale keys:

```bash
# Fails pipeline if any non-RU/EN locale code appears in source files
grep -r '"ko"\|"ja"\|"zh"\|name_ko\|name_ja\|name_zh\|: "ja"\|: "zh"\|: "ko"' src/ server/ \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=".climpire-worktrees" \
  && echo "FAIL: non-RU/EN locale code found" && exit 1 \
  || echo "PASS: no non-RU/EN locale code found"
```

---

## QA Merge Gate Checklist (Speaky's deliverable)

Before the deletion PR is approved:
- [ ] `normalizeLanguage("ru")` → `"ru"`
- [ ] `normalizeLanguage("ko")` → `"en"` (fallback)
- [ ] Language selector UI shows only Russian and English
- [ ] All UI strings render in Russian when language = "ru"
- [ ] All UI strings render in English when language = "en"
- [ ] No console errors / missing-key warnings in either locale
- [ ] Server API responses include `name_ru` and `name` fields; no `name_ko`/`name_ja`/`name_zh`
- [ ] `tsc --noEmit` passes with zero errors
- [ ] All existing tests pass
- [ ] CI grep gate passes (no ko/ja/zh tokens)
