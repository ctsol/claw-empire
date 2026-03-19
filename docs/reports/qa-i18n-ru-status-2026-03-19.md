# QA Report: Russian Locale (ru) Support Status
**Date:** 2026-03-19
**Owner:** QA/QC — DORO
**Scope:** Статус перевода? (Russian translation status inquiry)
**Branch:** `climpire/2913d46c`

---

## Executive Summary

**Вердикт: Русский перевод НЕ реализован.** В codebase нет ни одного `ru`-ключа, `ru` не является валидным значением `UiLanguage`, и ни один компонент не предлагает русский язык в UI.

---

## Smoke Test Checklist — Static Code Analysis

### 1. i18n type system (`src/i18n.ts`)

| Check | Result |
|-------|--------|
| `UiLanguage` содержит `"ru"` | ❌ Только `"ko" \| "en" \| "ja" \| "zh"` |
| `LangText` содержит поле `ru` | ❌ Только `ko`, `en`, `ja?`, `zh?` |
| `parseLanguage()` обрабатывает `ru-*` | ❌ Возвращает `null` → fallback `"en"` |
| `localeFromLanguage("ru")` | ❌ Попадает в `default` → `"en-US"` |
| `pickLang("ru", ...)` | ❌ Попадает в `default` → возвращает `text.en` |
| `normalizeLanguage("ru-RU")` | ❌ Возвращает `"en"` |

### 2. Language selector UI (`src/components/settings/GeneralSettingsTab.tsx`)

| Check | Result |
|-------|--------|
| Опция `<option value="ru">` | ❌ Отсутствует |
| Доступные опции | ✅ ko, en, ja, zh (только 4 языка) |
| Метка "Language" переведена на 4 языка | ✅ `{ ko, en, ja, zh }` |

### 3. Translation keys (`src/app/useAppLabels.ts`)

| Check | Result |
|-------|--------|
| Количество `LangText` объектов | ~100 ключей |
| Любой из них содержит `ru:` | ❌ 0 вхождений |
| Все объекты покрывают `ja` и `zh` | ⚠️ Частично (многие без `ja?`/`zh?`) |

### 4. Settings tab components

| Компонент | Статус i18n | Hardcoded English |
|-----------|-------------|-------------------|
| `GeneralSettingsTab.tsx` | ✅ Использует `t({...})` | ⚠️ 3 строки без `ja`/`zh` |
| `ApiSettingsTab.tsx` | ✅ Использует `t({...})` | ⚠️ 5 строк без `ja`/`zh` |
| `OAuthSettingsTab.tsx` | ✅ Использует `t({...})` | Нет |
| `GatewaySettingsTab.tsx` | ✅ Использует `t({...})` | Нет |
| `CliSettingsTab.tsx` | ✅ Использует `t({...})` | Нет |

### 5. Regression Test Execution

```
npx vitest run src/i18n.test.ts src/i18n.ru-status.test.ts
```

| Тест | Результат |
|------|-----------|
| `[QA] normalizeLanguage falls back to 'en' for 'ru'` | ✅ PASS |
| `[QA] localeFromLanguage returns 'en-US' for unsupported 'ru'` | ✅ PASS |
| `[QA] pickLang falls back to English for unsupported 'ru'` | ✅ PASS |
| `[QA] detectBrowserLanguage ignores ru-RU and falls back to next candidate` | ✅ PASS |
| `[QA] all supported languages are ko/en/ja/zh — 'ru' is absent` | ✅ PASS |
| Оригинальные тесты (4 шт.) | ✅ PASS |

**Итого: 8/8 тестов прошли.**

---

## Findings Severity

| ID | Тип | Серьёзность | Описание |
|----|-----|-------------|----------|
| F-01 | Feature Gap | **HIGH** | `"ru"` отсутствует в `UiLanguage` — без этого перевод невозможен |
| F-02 | Feature Gap | **HIGH** | `LangText` не имеет поля `ru` — все строки UI без русского |
| F-03 | Feature Gap | **HIGH** | `GeneralSettingsTab` не предлагает выбор Russian в language selector |
| F-04 | Feature Gap | **HIGH** | `useAppLabels.ts`: 0/~100 ключей переведены на русский |
| F-05 | Warning | **MEDIUM** | ~8 строк в settings tabs без `ja?`/`zh?` — аналогичная проблема |
| F-06 | CI Gap | **MEDIUM** | Нет i18n lint gate в CI — untranslated strings не блокируют merge |

---

## Pre-conditions for Russian Translation (Implementation Roadmap from QA)

Следующие шаги необходимы для начала работ — QA будет проверять каждый:

1. `UiLanguage = "ko" | "en" | "ja" | "zh" | "ru"` — добавить `"ru"`
2. `LangText` — добавить `ru?: string`
3. `parseLanguage()` — добавить `if (code === "ru" || code.startsWith("ru-")) return "ru";`
4. `localeFromLanguage("ru")` — добавить `case "ru": return "ru-RU";`
5. `pickLang("ru", ...)` — добавить `case "ru": return text.ru ?? text.en;`
6. `GeneralSettingsTab` — добавить `<option value="ru">Русский</option>`
7. `useAppLabels.ts` — перевести ~100+ ключей (`ru: "..."`)
8. Все компоненты settings, modals, AgentDetail — добавить `ru:` строки

**Оценка объёма (от Development):** ~400–500 строк изменений.

---

## Test Artifacts Committed

- `src/i18n.test.ts` — +4 `[QA]`-тегированных теста в существующий suite
- `src/i18n.ru-status.test.ts` — новый standalone файл, 4 теста (без React)

Commit: `018a8e5` — `test(i18n): add QA characterization tests for Russian locale absence`
