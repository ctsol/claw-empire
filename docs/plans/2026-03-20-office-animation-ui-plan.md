# Улучшение интерфейса офисного пространства — Plan

**Дата:** 2026-03-20
**Статус:** Approved
**Автор:** Отдел планирования
**Задача:** [Совещание] Улучшение интерфейса офисного пространства, анимации. — Planning
**Связанные документы:**
- `docs/design/2026-03-19-animation-design-system.md` — дизайн-система анимаций
- `docs/plans/2026-03-19-ui-animation-improvements-roadmap.md` — implementation roadmap
- `docs/plans/2026-03-19-room-design-improvement-spec.md` — спецификация дизайна комнат

---

## 1. Резюме совещания CEO

На совещании зафиксированы следующие решения:

| Тема | Решение CEO |
|------|-------------|
| Анимации переходов | Реализовать переходы между комнатами |
| Рабочие места агентов | Визуальное оформление с индивидуальными элементами |
| Интерактивность | Интерактивные элементы интерфейса |
| Производительность | Только CSS-переходы для лёгких эффектов; Framer Motion / PixiJS для детализированных |
| Дизайн-система | Создать; два режима: **Игровой и яркий** + **Корпоративный с мягкими акцентами** |
| Тестирование | Только ручное smoke-тестирование |
| Интеграция с событиями | Полная: spawn/delegation запускают анимации |
| API | Добавить эндпоинты для состояния анимаций комнат |
| CI/CD | Текущий пайплайн без изменений |

---

## 2. Области изменений

### 2.1 Анимационная дизайн-система

Создать унифицированную систему токенов анимации в `src/components/office-view/themes-locale.ts`:

**Режим A — Game & Bright (Игровой)**
- Выразительные переходы: `duration: 300ms`, `easing: cubic-bezier(0.34, 1.56, 0.64, 1)` (spring)
- Яркие вспышки при spawn/despawn агентов
- Bounce-эффекты на кликабельных элементах
- Частицы и fireworks-эффекты при ключевых событиях

**Режим B — Corporate Soft (Корпоративный)**
- Сдержанные переходы: `duration: 200ms`, `easing: cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out)
- Мягкие fade для spawn/despawn
- Hover-glow без резкого bounce
- Минималистичные частицы (5 вместо 9)

### 2.2 Переходы между комнатами

CSS-классы для React Overlay + PixiJS alpha-fade для канваса:

```
room-enter:  opacity 0 → 1, translateY 8px → 0, duration 250ms
room-exit:   opacity 1 → 0, scale 1 → 0.98, duration 200ms
```

### 2.3 Визуальное оформление рабочих мест агентов

- Цветовые аватары по статусу (`busy` / `idle` / `in_meeting`)
- Glow-эффект вокруг активного агента
- Иконки типа комнаты через `ROOM_TYPE_ICONS` (спецификация в room-design-improvement-spec)
- Status badge с анимированным pulse для `in_progress`

### 2.4 Новые API-эндпоинты состояния анимаций комнат

#### `GET /api/office/rooms/animation-state`
Возвращает текущее состояние анимации для всех комнат.

```typescript
Response: {
  rooms: Array<{
    roomId: string;
    animationMode: "game" | "corporate";
    activeAgents: string[];
    pendingEvents: Array<{ type: "spawn" | "despawn" | "delegation"; agentId: string }>;
  }>;
  globalMode: "game" | "corporate";
}
```

#### `POST /api/office/rooms/:roomId/animation-event`
Регистрирует событие для запуска анимации.

```typescript
Body: {
  type: "spawn" | "despawn" | "delegation" | "meeting_start" | "meeting_end";
  agentId: string;
  targetRoomId?: string;  // для delegation
}
Response: { ok: true; eventId: string }
```

**Авторизация:** требуется `Authorization` header; только внутренние сервисные вызовы.
**RBAC:** минимум роль `operator` для регистрации событий; `GET` — любой авторизованный.

### 2.5 Интеграция событий spawn/delegation

Точки интеграции в существующем коде:

| Событие | Файл | Действие |
|---------|------|---------|
| Agent spawn | `server/modules/routes/core/agents/crud.ts` | POST `/animation-event` type=`spawn` |
| Task delegation | `server/modules/workflow/agents/subtask-routing.ts` | POST `/animation-event` type=`delegation` |
| Meeting start | `server/modules/orchestration/meetings/presence.ts` | POST `/animation-event` type=`meeting_start` |
| Agent despawn | `server/modules/routes/core/agents/crud.ts` | POST `/animation-event` type=`despawn` |

---

## 3. Итерационный план

### Итерация 1 — Дизайн-система и токены (приоритет: HIGH)

**Цель:** Зафиксировать все значения анимационных токенов.
**Команда:** Development
**Файлы:**
- `src/components/office-view/themes-locale.ts` — добавить `ROOM_ANIMATION`, `ROOM_TYPE_ICONS`
- `src/components/office-view/model.ts` — заменить `"펑"` на `"✦"` (язык. политика)

**Приёмочные критерии:**
- [ ] Константы `ROOM_ANIMATION` экспортированы и используются во всех анимациях
- [ ] `ROOM_TYPE_ICONS` применён во всех room-labels
- [ ] Корейский символ удалён из кодовой базы

### Итерация 2 — Переходы между комнатами (приоритет: HIGH)

**Цель:** Плавные CSS-переходы при навигации между офисными зонами.
**Команда:** Development
**Файлы:**
- `src/components/office-view/` — добавить CSS-классы `room-enter`/`room-exit`
- PixiJS alpha-fade в `buildScene-departments.ts`

**Приёмочные критерии:**
- [ ] Transition при смене активной комнаты — видна анимация, ≥ 30 fps
- [ ] Smoke-тест: клик по комнате → плавный переход без артефактов

### Итерация 3 — Анимации агентских событий (приоритет: MEDIUM)

**Цель:** Визуальная реакция на spawn/delegation.
**Команда:** Development
**Файлы:**
- `src/components/office-view/model.ts` — обновить `emitSubCloneSmokeBurst` и `emitSubCloneFireworkBurst`

**Приёмочные критерии:**
- [ ] Spawn агента: burst animation соответствует режиму (A или B)
- [ ] Delegation: arc-trajectory от источника к цели
- [ ] Оба режима переключаются через настройки темы без перезагрузки

### Итерация 4 — API эндпоинты состояния анимаций (приоритет: MEDIUM)

**Цель:** Серверные эндпоинты для событий анимаций.
**Команда:** Development
**Файлы:**
- `server/modules/routes/` — новый файл `office-animation.ts`
- `server/modules/bootstrap/schema/` — миграция для таблицы `room_animation_events`

**Приёмочные критерии:**
- [ ] `GET /api/office/rooms/animation-state` возвращает корректный JSON
- [ ] `POST /api/office/rooms/:roomId/animation-event` принимает событие, возвращает `eventId`
- [ ] RBAC: неавторизованный запрос → 401; роль `viewer` → 403 на POST

### Итерация 5 — Персонализация рабочих мест (приоритет: LOW)

**Цель:** Визуальный редактор для настройки вида комнаты пользователем.
**Команда:** Development
**Файлы:**
- `src/components/` — новый компонент `RoomCustomizationPanel`

**Приёмочные критерии:**
- [ ] Пользователь может сменить иконку и акцентный цвет своей комнаты
- [ ] Настройки сохраняются на сервере в БД (без шифрования)
- [ ] Администратор может менять настройки общих пространств с подтверждением

---

## 4. Стратегия тестирования

По решению CEO: **только ручное smoke-тестирование**. CI-пайплайн без изменений.

### Smoke-чеклист (Game & Bright)

| # | Сценарий | Ожидаемый результат |
|---|----------|-------------------|
| 1 | Открыть Office View | Загрузка без артефактов, ≥ 30 fps |
| 2 | Клик по комнате | Плавный room-enter transition (~300ms) |
| 3 | Запустить задачу → агент спавнится | Burst animation с "✦", яркие частицы |
| 4 | Делегировать задачу | Arc-trajectory от источника к цели |
| 5 | Начало совещания | Meeting badge pulse animation |
| 6 | Сменить тему → Game & Bright | Все анимации переключаются мгновенно |

### Smoke-чеклист (Corporate Soft)

| # | Сценарий | Ожидаемый результат |
|---|----------|-------------------|
| 1 | Открыть Office View | Загрузка без артефактов, ≥ 30 fps |
| 2 | Клик по комнате | Плавный fade-transition (~200ms), без bounce |
| 3 | Агент спавнится | Мягкий fade-in, 5 частиц без burst text |
| 4 | Делегировать задачу | Тонкая arc-line, без яркого следа |
| 5 | Сменить тему → Corporate | Все анимации переключаются мгновенно |

### API Smoke-тесты

| # | Запрос | Ожидаемый результат |
|---|--------|-------------------|
| A1 | `GET /api/office/rooms/animation-state` (auth) | 200 + JSON |
| A2 | `GET /api/office/rooms/animation-state` (no auth) | 401 |
| A3 | `POST .../animation-event` (operator) | 200 + eventId |
| A4 | `POST .../animation-event` (viewer) | 403 |
| A5 | `POST .../animation-event` body: invalid type | 400 |

---

## 5. Критерии успеха

| Метрика | Цель |
|---------|------|
| FPS в Office View | ≥ 30 fps на Chrome + Firefox |
| Время перехода между комнатами | 200–350ms (без артефактов) |
| Корейские символы в кодовой базе | 0 (удалены все) |
| Smoke-чеклист пройден | 100% сценариев без критических ошибок |
| API эндпоинты задокументированы | openapi.json обновлён |

---

## 6. Зависимости и риски

### Зависимости
- `themes-locale.ts` должен быть обновлён до начала итерации 2 и 3
- Миграция БД для `room_animation_events` нужна до итерации 4
- Worktree climpire/06dde237-1 затрагивает `buildScene-departments.ts` и `themes-locale.ts` — необходима координация

### Риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Конфликты в `themes-locale.ts` | Высокая | Слить все изменения перед итерацией 1 |
| Деградация FPS при сложных анимациях | Средняя | Ограничить puffCount в Corporate режиме |
| Сложность персонализации (итерация 5) | Высокая | Упростить до 3 настроек: иконка + 2 цвета |

---

## 7. Координация команд

| Команда | Ответственность |
|---------|----------------|
| **Planning** | Данный документ; координация итераций; контроль scope |
| **Development** | Итерации 1–5; обновление openapi.json |
| **QA/QC** | Ручное smoke-тестирование по чеклисту из раздела 4 |
| **DevSecOps** | CI-пайплайн без изменений; проверка RBAC на API |
| **Design** | Валидация визуального результата итераций 2–3 |
