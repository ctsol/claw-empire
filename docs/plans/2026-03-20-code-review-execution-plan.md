# Code Review Execution Plan — 2026-03-20

**Статус:** Planning deliverable
**Автор:** Риша (Planning)
**Контекст:** CEO запросил проверку кода. DevSecOps (Зеленай) завершил security-аудит.

---

## 1. Текущее состояние кодовой базы

| Метрика | Значение |
|---------|----------|
| Файлы src/ | 190 |
| Файлы server/ | 225 |
| Тестовые файлы | 82 |
| Merge conflicts | 0 (чисто) |
| @ts-ignore / @ts-nocheck | 0 |
| TODO/FIXME/HACK | 0 |
| console.log (server) | 47 в 14 файлах (тегированный operational logging) |
| console.log (src) | 0 |
| Sensitive files в git | 0 (`.gitignore` корректен) |

## 2. Приоритизированный чеклист проверки

### P0 — CRITICAL (блокеры, немедленное исправление)

- [x] **Merge conflict resolution** — конфликт после climpire/6aa904c6 **разрешён**, маркеры `<<<<<<<` отсутствуют
- [x] **Security: SQLite DB в .gitignore** — `*.db` добавлен (коммит 467ee81)
- [x] **Security: .env files** — `.env.example` есть, реальные `.env` не закоммичены

### P1 — HIGH (баги, найденные при аудите)

- [ ] **Telegram report sender — баг pickL()** (`server/modules/workflow/orchestration/telegram-report-sender.ts`, строки 738–742): русская локаль передаётся вне `l()` как 2-й аргумент `pickL()` вместо `lang`. Вызывает `TypeError` при ошибке без тела.
  **Владелец:** Development
  **Артефакт-источник:** `docs/plans/2026-03-20-telegram-report-diagnostic.md`

- [ ] **i18n: ~36 случаев перемешанных ko/ja/zh символов** в полях переводов (`AgentDetail.tsx`, `TaskCard.tsx`, `Sections.tsx`, `ChatEditorModal.tsx` и др.). Тесты уже адаптированы (коммит climpire/04fd023e), но сами данные не вычищены.
  **Владелец:** Development
  **Требование:** Отдельная задача на аудит всех i18n-ключей

### P2 — MEDIUM (tech debt, warning only)

- [ ] **console.log в server/** — 47 вызовов в 14 файлах. Все тегированы (`[Claw-Empire]`, `[telegram-report]`, `[lifecycle]` и т.д.), используются как operational logging. **Рекомендация:** мигрировать на структурированный logger (winston/pino) отдельной задачей.

- [ ] **3 параллельные ветки затрагивают i18n** — риск конфликтов при мерже. **Рекомендация:** определить одну основную ветку для i18n-изменений, остальные ребейзнуть после.

- [ ] **`skipLibCheck: true` в tsconfig** — маскирует потенциальные проблемы в `.d.ts`. Приемлемо для текущего этапа, но стоит пересмотреть при стабилизации.

### P3 — LOW (улучшения)

- [ ] **`noUnusedLocals: false` / `noUnusedParameters: false`** — ослабляет strict mode. Рекомендуется включить при следующем рефакторинг-спринте.
- [ ] **Документация releases/** — последний релиз v1.1.6, но активная разработка ушла далеко вперёд. Нужен release notes catchup.

## 3. Рекомендованный порядок исполнения (для Development)

```
1. Telegram pickL() баг-фикс (P1, ~15 мин)
2. Прогон полного test suite: test:ci (валидация после фикса)
3. i18n аудит — вычистка ko/ja/zh артефактов (P1, отдельная задача)
4. Мерж-стратегия для 3-х i18n-веток (P2, координация)
5. Logger migration plan (P2, backlog)
```

## 4. Что проверено и в порядке

- **TypeScript** — strict mode, 0 подавлений типов, компиляция чистая
- **Тесты** — 82 файла, нет `.skip` / `.only` / `.todo`
- **Security** — `.gitignore` покрывает DB, ключи, сертификаты, env-файлы
- **Frontend** — 0 console.log, чистый код
- **Merge conflicts** — все разрешены
- **Animations pipeline** — новый `animMode` prop корректно пробрасывается + prefers-reduced-motion

## 5. Зависимости между подзадачами

```
[Telegram fix] ──► [Test suite] ──► [i18n cleanup]
                                         │
                                         ▼
                                  [i18n branch merge strategy]
                                         │
                                         ▼
                                  [Logger migration] (backlog)
```

---

*Данный план основан на аудите кодовой базы от 2026-03-20 и артефактах DevSecOps.*
