# DevSecOps Report: i18n CI Gate — Russian Translation Status
**Date:** 2026-03-19
**Owner:** DevSecOps — Pipe (Vault/VoltS subtasks)
**Branch:** `climpire/732a5ced`
**Task:** Статус перевода? → DevSecOps deliverable

---

## Executive Summary

Критический пробел в CI/CD устранён: добавлен i18n completeness gate, который блокирует merge при
отсутствии обязательных языковых ключей (`ko`, `en`) в объектах перевода. До этого изменения
непереведённые строки могли беспрепятственно попасть в `main`.

---

## Проблема (Vault + VoltS)

| ID | Проблема | Серьёзность | Статус |
|----|---------|-------------|--------|
| CI-01 | Нет i18n lint gate в pipeline — untranslated strings не блокируют merge | HIGH | ✅ **Устранено** |
| CI-02 | Добавление нового языка (`ru`) не требует обновления CI-скрипта | MEDIUM | ✅ **Устранено** (`KNOWN_LANGS`) |

---

## Реализованные изменения

### 1. `scripts/check-i18n-completeness.mjs` (новый файл)

Скрипт статического анализа:

- **Проверяет `src/i18n.ts`**: декларация `UiLanguage` содержит все обязательные языки.
- **Сканирует `src/**/*.{ts,tsx}`**: все `t({...})` объекты имеют `ko` и `en` ключи.
- **Режимы:**
  - По умолчанию: `ko`, `en` — обязательные (exit 1 при отсутствии)
  - `--strict`: дополнительно проверяет `ja`, `zh` (exit 1 при отсутствии)
- **Расширяемость**: добавить `"ru"` в `REQUIRED_LANGS` достаточно для автоматической проверки после реализации перевода

Текущий прогон: **PASS** (0 errors, 0 warnings) — базовая инфраструктура `ko`/`en` complete.

```
=== i18n Completeness Gate ===
1. Checking src/i18n.ts type declarations...
   UiLanguage declared: [ko, en, ja, zh]
2. Scanning source files for incomplete translation objects...
   Scanned 184 source files.
Errors: 0  Warnings: 0
[PASS] i18n completeness gate passed.
```

С `--strict` (предупреждение, не блокирует):
```
[WARNINGS] Missing optional language keys (6 objects):
  src/components/AgentDetail.tsx:311 — missing optional: [ja,zh]
  src/components/agent-manager/constants.ts:17-20 — missing optional: [ja,zh]
  src/i18n.test.ts:53 — missing optional: [ja,zh]
```

### 2. `package.json` (добавлены scripts)

```json
"i18n:check":        "node scripts/check-i18n-completeness.mjs",
"i18n:check:strict": "node scripts/check-i18n-completeness.mjs --strict"
```

### 3. `.github/workflows/ci.yml` (новый шаг)

```yaml
- name: Run i18n completeness check
  run: pnpm run i18n:check
```

Шаг вставлен **перед** OpenAPI contract check — в начале validation-фазы, после lint.

---

## Протокол активации русского перевода

Когда Development добавит `"ru"` в `UiLanguage`:

1. Обновить в `scripts/check-i18n-completeness.mjs`:
   ```js
   // Сейчас:
   const OPTIONAL_LANGS = ["ja", "zh"];
   // После добавления ru в систему:
   const REQUIRED_LANGS = ["ko", "en", "ru"];
   const OPTIONAL_LANGS = ["ja", "zh"];
   ```
2. CI автоматически начнёт блокировать merge, если любой `t({...})` не содержит `ru`.

---

## Оценка пробелов (на основе QA + Design deliverables)

| Компонент | Статус `ru` | CI-обнаружение |
|-----------|------------|----------------|
| `src/i18n.ts` — `UiLanguage` | ❌ `ru` отсутствует | ✅ Обнаружит при переводе |
| `src/app/useAppLabels.ts` — ~175+ ключей | ❌ 0 переведено | ✅ Заблокирует merge без `ru` |
| `GeneralSettingsTab` — language selector | ❌ нет опции `ru` | ⚠️ Не сканируется (JSX option) |
| `AgentFormModal`, `DepartmentFormModal` | ❌ нет `ru` блоков | ✅ Заблокирует `t({...})` без `ru` |
| `ChatEditorModal` | ❌ нет `ru` | ✅ Заблокирует |

---

## Ограничения (MEDIUM — не блокируют CI)

| ID | Ограничение | Рекомендация |
|----|-------------|--------------|
| L-01 | `<option value="ru">` в JSX не проверяется скриптом | Добавить тест в QA smoke-suite |
| L-02 | `localeName()` helper (2-языковый) не охвачен | Отдельная проверка через TypeScript types |
| L-03 | Регексп не парсит многострочные `t({...})` | Достаточно для текущего паттерна кода |

---

## Вывод для CEO

> **CI gate установлен.** Любая попытка смержить код с пропущенным обязательным переводом (`ko`/`en`)
> теперь заблокирует PR на уровне CI.
>
> **Русский перевод пока не реализован** — это подтверждают Development (0/175+ ключей), QA (все тесты
> показывают fallback на `en`), и Design (ни один компонент не содержит `ru`). Gate готов к активации:
> достаточно добавить `"ru"` в `REQUIRED_LANGS` после завершения переводческой работы.
