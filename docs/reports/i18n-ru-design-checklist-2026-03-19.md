# Отчёт Design: Статус перевода UI на русский язык
**Дата:** 2026-03-19
**Автор:** Luna (Design)
**Задача:** Визуальный чеклист компонентов — наличие hardcoded English строк и отсутствие поддержки `ru`

---

## Резюме

Русский язык **не поддерживается** в текущей кодовой базе. Тип `UiLanguage = "ko" | "en" | "ja" | "zh"` не включает `"ru"`. Ни один UI-компонент не отображает русский текст.

---

## 1. Инфраструктура i18n (`src/i18n.ts`)

| Элемент | Статус | Описание |
|---|---|---|
| `UiLanguage` тип | ❌ Нет `ru` | `"ko" \| "en" \| "ja" \| "zh"` — русский отсутствует |
| `LangText` тип | ❌ Нет `ru?` | Поля: `ko, en, ja?, zh?` — поле `ru?` не определено |
| `parseLanguage()` | ❌ Нет `ru` | Обрабатывает ko/en/ja/zh, для `ru-RU` вернёт `null` |
| `localeFromLanguage()` | ❌ Нет `ru-RU` | Возвращает `en-US` для неизвестных языков |
| `pickLang()` | ❌ Нет case `"ru"` | При `lang="ru"` вернёт fallback `en` |

---

## 2. GeneralSettingsTab — Language Selector

**Файл:** `src/components/settings/GeneralSettingsTab.tsx:180–184`

| Опция в `<select>` | Отображается | Проблема |
|---|---|---|
| `value="ko"` — Korean | ✅ | — |
| `value="en"` — English | ✅ | — |
| `value="ja"` — Japanese | ✅ | — |
| `value="zh"` — Chinese | ✅ | — |
| `value="ru"` — Russian | ❌ **Отсутствует** | Опция не добавлена |

> **Design-замечание:** Пользователь не может выбрать русский язык через UI — вход в `ru`-локаль заблокирован на уровне selector.

---

## 3. AgentFormModal (`src/components/agent-manager/AgentFormModal.tsx`)

| UI-элемент | Метод локализации | Статус `ru` |
|---|---|---|
| Заголовок (Edit/Hire) | `tr(ko, en)` — 2 языка | ❌ Нет `ru` |
| Секция "Basic Info" | `tr(ko, en)` | ❌ Нет `ru` |
| Label "Name" | `tr(ko, en)` | ❌ Нет `ru` |
| Label "Emoji" / "Department" | `tr(ko, en)` | ❌ Нет `ru` |
| Placeholder personality textarea | `tr(ko, en)` | ❌ Нет `ru` |
| Locale-поле "Japanese Name" | `t({ko, en, ja, zh})` | ❌ Нет `ru` |
| Locale-поле "Chinese Name" | `t({ko, en, ja, zh})` | ❌ Нет `ru` |
| Locale-блок для `ru` | — | ❌ **Отсутствует** — нет `locale.startsWith("ru")` |
| Кнопки Save/Cancel | `tr(ko, en)` | ❌ Нет `ru` |
| Sprite upload labels | `tr(ko, en)` + `t({ko,en,ja,zh})` | ❌ Нет `ru` |
| **Hardcoded placeholder** `"DORO"` | нет локализации | ⚠️ Технический пример, не UI-текст |

---

## 4. DepartmentFormModal (`src/components/agent-manager/DepartmentFormModal.tsx`)

| UI-элемент | Метод локализации | Статус `ru` |
|---|---|---|
| Заголовок (Edit/Add) | `tr(ko, en)` | ❌ Нет `ru` |
| Label "Name" | `tr(ko, en)` | ❌ Нет `ru` |
| Locale-поле "Japanese Name" | `t({ko, en, ja, zh})` | ❌ Нет `ru` |
| Locale-поле "Chinese Name" | `t({ko, en, ja, zh})` | ❌ Нет `ru` |
| Locale-блок для `ru` | — | ❌ **Отсутствует** — нет `locale.startsWith("ru")` |
| Placeholder "Description" | `tr(ko, en)` | ❌ Нет `ru` |
| Placeholder "Prompt" | `tr(ko, en)` | ❌ Нет `ru` |
| Alert-сообщения об ошибках | `tr(ko, en)` | ❌ Нет `ru` |
| Кнопки Save/Delete/Cancel | `tr(ko, en)` | ❌ Нет `ru` |
| **Hardcoded placeholder** `"Development"` | нет локализации | ⚠️ Пример-значение |

---

## 5. ApiAssignModal (`src/components/settings/ApiAssignModal.tsx`)

| UI-элемент | Метод локализации | Статус `ru` |
|---|---|---|
| `ROLE_LABELS` (team_leader, senior…) | `t({ko, en, ja, zh})` | ❌ Нет `ru` |
| `localName()` helper | только `ko \| en` | ❌ Нет поддержки `ja`, `zh`, `ru` |
| Заголовок модала | не проверен в snippet | ⚠️ Требует доп. проверки |

> **Design-замечание:** `localName()` в строке 19 — упрощённая 2-языковая реализация, не использует LangText.

---

## 6. ChatEditorModal (`src/components/settings/gateway-settings/ChatEditorModal.tsx`)

| UI-элемент | Метод локализации | Статус `ru` |
|---|---|---|
| Заголовок "Add Chat / Edit Chat" | `t({ko, en, ja, zh})` | ❌ Нет `ru` |
| Кнопка "Close" | `t({ko, en, ja, zh})` | ❌ Нет `ru` |
| Label "Messenger" | `t({ko, en, ja, zh})` | ❌ Нет `ru` |
| Прочие поля | `t({ko, en, ja, zh})` | ❌ Нет `ru` |

---

## 7. Сводная таблица компонентов

| Компонент | Использует `t()` | Поддерживает `ru` | Есть locale-блок `ru` | Hardcoded EN |
|---|:---:|:---:|:---:|:---:|
| `i18n.ts` — система | ✅ | ❌ | — | — |
| `GeneralSettingsTab` | ✅ | ❌ | ❌ (нет опции) | — |
| `AgentFormModal` | ✅ | ❌ | ❌ | ⚠️ `"DORO"` |
| `DepartmentFormModal` | ✅ | ❌ | ❌ | ⚠️ `"Development"` |
| `ApiAssignModal` | ✅ | ❌ | — | — |
| `ChatEditorModal` | ✅ | ❌ | — | — |

---

## 8. Приоритизированный список изменений для Design

### Критические (блокируют функцию):
1. **`src/i18n.ts`** — добавить `"ru"` в `UiLanguage`, `ru?: string` в `LangText`, case в `parseLanguage()`, `localeFromLanguage()`, `pickLang()`
2. **`GeneralSettingsTab:180–184`** — добавить `<option value="ru">` в language selector

### Высокоприоритетные (UI недоступен на ru):
3. **`AgentFormModal`** — добавить `locale.startsWith("ru")` блок для поля "Русское имя"; обновить все `tr(ko, en)` → `t({ko, en, ru})`
4. **`DepartmentFormModal`** — аналогично AgentFormModal

### Средние (качество UX):
5. **`ApiAssignModal`** — `localName()` расширить до 4 языков + ru; добавить `ru` в `ROLE_LABELS`
6. **`ChatEditorModal`** — добавить `ru` во все `t({ko, en, ja, zh})` объекты
7. **`useAppLabels.ts`** — перевести все 175+ ключей на русский (по данным Development)

---

## Вывод для CEO

> Русский перевод **отсутствует полностью**. В UI нет ни одной строки на русском языке.
> Системно это работа в 3 слоя: (1) инфраструктура `i18n.ts`, (2) языковой selector в настройках, (3) текстовые ключи в 175+ строках `useAppLabels.ts` и всех компонентах.
> Оценка объёма Design-части: ~2 экрана (AgentFormModal + DepartmentFormModal) требуют locale-блоков; остальные компоненты — замена строк без изменения структуры.
