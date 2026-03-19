# Animation Design System — Office Space
**Date:** 2026-03-19
**Status:** Draft
**Author:** Design Department
**Task:** [Совещание] Улучшение интерфейса офисного пространства, анимации

---

## 1. Summary

Дизайн-система анимаций для офисного пространства Claw Empire. Покрывает все интерактивные и фоновые анимации: переходы между комнатами, состояния агентов, события спавна/делегирования, визуальные эффекты в PixiJS-канвасе.

Реализуется в двух режимах:
- **Режим A — «Игровой и яркий»** (Game & Bright): выразительные цвета, упругая физика, живые эффекты
- **Режим B — «Корпоративный»** (Corporate Soft): сдержанные переходы, мягкие акценты, деловой тон

Режим выбирается через настройки темы интерфейса (уже реализован переключатель light/dark в `themes-locale.ts`). Анимационный режим расширяет существующую схему без замены архитектуры.

---

## 2. User Flow

```
Пользователь открывает Office View
  → Офис отрисовывается (PixiJS canvas)
  → Агенты появляются на рабочих местах (spawn burst)
  → CEO движется между комнатами
  → Задачи делегируются (delivery arc animation)
  → Sub-clones плавают и пускают фейерверки
  → Совещание начинается → badge анимируется
  → Агент получает сообщение → envelope bounce
  → Тема переключается → плавный fade всех цветов
```

---

## 3. Layout Structure

```
Office Canvas (PixiJS)
├── CEO Zone (верхний блок, CEO_ZONE_H=110px)
│   ├── CEO Avatar (движение, interaction highlight)
│   └── Collab Table (meeting badge animation)
├── Hallway (HALLWAY_H=32px)
│   └── Delivery arc trajectories
├── Department Rooms (SLOT_W=100px, SLOT_H=120px)
│   ├── Agent Desks (spawn/despawn, status glow)
│   ├── Sub-clone Floats (wave + fireworks)
│   └── Room Background (theme transitions)
└── Break Room (BREAK_ROOM_H=110px)
    ├── Agent Chat Bubbles (pop-in, fade-out)
    └── Coffee Machine (idle animation)

React Overlay (HTML/CSS)
├── RecentTasksPanel (envelope animation — уже реализовано)
├── CliUsagePanel (progress bar transition)
└── VirtualPadOverlay (press feedback)
```

---

## 4. UI Components & Animation Specifications

### 4.1 Sub-clone Smoke Burst (`emitSubCloneSmokeBurst`)

**Текущее состояние:** реализовано в `model.ts:168`
**Проблема:** текст `"펑"` (model.ts:211) — корейский символ, не соответствует языковой политике ru/en.
**Действие:** Development-команде заменить на нейтральный символ `"✦"` или пустую вспышку.

| Параметр | Режим A (Game) | Режим B (Corporate) |
|----------|---------------|---------------------|
| puffCount spawn | 9 | 5 |
| puffCount despawn | 7 | 4 |
| burst text | `"✦"` (нейтральный) | убрать совсем |
| flash alpha spawn | 0.52 | 0.30 |
| maxLife spawn | 20–32 frames | 14–22 frames |
| base color spawn | `0xc7d4ec` | `0xd8e0f0` |

### 4.2 Sub-clone Firework Burst (`emitSubCloneFireworkBurst`)

**Текущее состояние:** реализовано в `model.ts:234`

| Параметр | Режим A (Game) | Режим B (Corporate) |
|----------|---------------|---------------------|
| sparkCount | 10 | 6 |
| colors | `[0xff6b6b, 0xffc75f, 0x7ce7ff, 0x8cff9f, 0xd7a6ff]` | `[0x60a5fa, 0x34d399, 0xa78bfa]` |
| speed range | 0.9–1.75 | 0.5–1.0 |
| maxLife range | 16–24 frames | 12–18 frames |
| spark radius | 0.85–1.45 | 0.7–1.1 |

### 4.3 Delivery Arc Animation

**Текущее состояние:** `DELIVERY_SPEED = 0.012`, arc trajectory в `officeTickerRoomAndDelivery.ts`

| Параметр | Режим A (Game) | Режим B (Corporate) |
|----------|---------------|---------------------|
| arcHeight | высокая (задаётся в Delivery.arcHeight) | умеренная |
| speed | 0.014 | 0.010 |
| envelope sprite scale | 1.1 | 0.9 |
| bounce on arrival | да (scale 1.2 → 1.0, 6 frames) | нет |

### 4.4 Agent Spawn/Despawn

| Состояние | Анимация | Длительность |
|-----------|---------|--------------|
| spawn | fade-in opacity 0→1 + scale 0.6→1.0, easing: spring | 18 frames |
| despawn | fade-out opacity 1→0 + scale 1.0→0.8, easing: ease-out | 12 frames |
| idle (working) | лёгкое покачивание Y ±2px, period: 180 frames | loop |
| sleeping/offline | reduced opacity 0.5, no movement | static |

### 4.5 Room Theme Transition (dark/light toggle)

CSS-переход для overlay-элементов; PixiJS-цвета применяются через `applyOfficeThemeMode()`.

```css
/* Токены для CSS overlay (React-компоненты) */
--anim-theme-duration: 300ms;          /* Режим B: 200ms */
--anim-theme-easing: ease-in-out;
```

PixiJS: при смене темы через `applyOfficeThemeMode(isDark)` → `buildScene()` вызывается целиком. Плавность достигается через alpha-fade canvas:
- fade out: 300ms (opacity 1→0)
- apply theme + rebuild
- fade in: 300ms (opacity 0→1)

### 4.6 Meeting Badge States

Текущие цвета в `getMeetingBadgeStyle()` (`themes-locale.ts:403`):

| State | Fill | Stroke | Animation |
|-------|------|--------|-----------|
| kickoff | `0xf59e0b` | `0x111111` | pulse scale 1.0→1.05→1.0, period 120f |
| reviewing | `0x60a5fa` | `0x1e3a8a` | shimmer alpha 0.9→1.0, period 90f |
| approved | `0x34d399` | `0x14532d` | bounce once: scale 1.0→1.15→1.0, 24f |
| hold | `0xf97316` | `0x7c2d12` | flash: alpha 1.0→0.6→1.0, period 60f |

### 4.7 Sub-clone Float Wave

**Текущие константы** (`model.ts:143–147`):
```
SUB_CLONE_WAVE_SPEED = 0.04
SUB_CLONE_MOVE_X_AMPLITUDE = 0.16
SUB_CLONE_MOVE_Y_AMPLITUDE = 0.34
SUB_CLONE_FLOAT_DRIFT = 0.08
SUB_CLONE_FIREWORK_INTERVAL = 210
```

| Параметр | Режим A (Game) | Режим B (Corporate) |
|----------|---------------|---------------------|
| WAVE_SPEED | 0.04 | 0.025 |
| MOVE_Y_AMPLITUDE | 0.34 | 0.20 |
| FLOAT_DRIFT | 0.08 | 0.04 |
| FIREWORK_INTERVAL | 210 frames | 420 frames (вдвое реже) |

### 4.8 CEO Movement

**Текущая скорость:** `CEO_SPEED = 7`

| Параметр | Режим A | Режим B |
|----------|---------|---------|
| speed | 7 | 5 |
| step dust particle | да | нет |
| room-enter flash | brief white flash, 8 frames | нет |

---

## 5. Interaction Logic

### 5.1 Клик по агенту
1. Ripple: круговая волна от точки клика, radius 0→24px, alpha 0.4→0, 20 frames
2. Агент «подпрыгивает»: Y -4px → 0 (easing: spring), 12 frames
3. Открывается панель (React transition, см. ниже)

### 5.2 Клик по комнате
1. Room highlight: border glow (accent color, alpha 0.6→0), 30 frames
2. React panel открывается из правого края (translateX: 100%→0)

### 5.3 Spawn-событие агента (делегирование задачи)
1. Delivery arc летит к комнате
2. При arrival: envelope bounce
3. В агентском слоте: smoke burst (spawn mode)
4. Sub-clone добавляется: firework burst через SUB_CLONE_FIREWORK_INTERVAL

---

## 6. States

| Состояние | Визуализация |
|-----------|-------------|
| Loading (инициализация) | Canvas: shimmer skeleton, opacity 0.4 |
| Empty dept (0 агентов) | Тёмные пустые столы, opacity 0.5 |
| Agent offline | Серая иконка, no wave animation |
| Meeting active | Badge pulse, collab table glow |
| Theme switching | Canvas fade 300ms |
| Error / timeout | No specific animation (не animated error) |

---

## 7. Design System Tokens (Animation)

### CSS-токены для React-оверлеев

```css
:root {
  /* Durations */
  --anim-micro: 120ms;      /* hover, press feedback */
  --anim-fast: 200ms;       /* badge появление, tooltip */
  --anim-base: 300ms;       /* panel open/close, theme switch */
  --anim-slow: 500ms;       /* envelope fall, первый рендер */

  /* Easing */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);   /* bounce/spring */
  --ease-soft: cubic-bezier(0.4, 0, 0.2, 1);           /* material standard */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);              /* exit transitions */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);               /* enter transitions */

  /* Scales */
  --anim-scale-hover: 1.04;
  --anim-scale-press: 0.96;
  --anim-scale-spawn: 0.6;   /* начальный scale при spawn */
}

/* Режим B: переопределение токенов */
[data-anim-mode="corporate"] {
  --anim-micro: 80ms;
  --anim-fast: 150ms;
  --anim-base: 250ms;
  --anim-slow: 400ms;
  --ease-spring: cubic-bezier(0.4, 0, 0.2, 1); /* без bounce */
}
```

### PixiJS-константы (два режима)

Управляется через `AnimMode` enum (новый тип для Development):

```ts
// Предлагаемая структура для Development
type AnimMode = "game" | "corporate";

interface AnimProfile {
  subCloneWaveSpeed: number;
  subCloneMoveYAmp: number;
  subCloneFireworkInterval: number;
  deliverySpeed: number;
  burstPuffCount: number;
  fireworkSparkCount: number;
}

const ANIM_PROFILES: Record<AnimMode, AnimProfile> = {
  game: {
    subCloneWaveSpeed: 0.04,
    subCloneMoveYAmp: 0.34,
    subCloneFireworkInterval: 210,
    deliverySpeed: 0.014,
    burstPuffCount: 9,
    fireworkSparkCount: 10,
  },
  corporate: {
    subCloneWaveSpeed: 0.025,
    subCloneMoveYAmp: 0.20,
    subCloneFireworkInterval: 420,
    deliverySpeed: 0.010,
    burstPuffCount: 5,
    fireworkSparkCount: 6,
  },
};
```

---

## 8. Implementation Notes

### 8.1 Приоритет задач для Development

| Приоритет | Задача | Файл |
|-----------|--------|------|
| HIGH | Заменить `"펑"` (model.ts:211) на `"✦"` или убрать | `model.ts` |
| HIGH | Добавить `AnimMode` enum и `ANIM_PROFILES` константы | `model.ts` |
| HIGH | Передавать `animMode` в `OfficeViewProps` | `model.ts`, `useOfficePixiRuntime.ts` |
| MEDIUM | Реализовать meeting badge pulse animation в ticker | `officeTicker.ts` |
| MEDIUM | Canvas fade при смене темы (opacity transition) | `useOfficePixiRuntime.ts` |
| MEDIUM | Ripple + agent bounce при клике | `officeTicker.ts` |
| LOW | CSS-токены `--anim-*` в tailwind config или globals.css | `src/index.css` |
| LOW | Bounce on delivery arrival | `officeTickerRoomAndDelivery.ts` |

### 8.2 Архитектурные ограничения

- **Без Framer Motion в PixiJS-слое** — PixiJS использует собственный тикер (`Application.ticker`). Framer Motion применим только к React-оверлеям (RecentTasksPanel, VirtualPadOverlay и т.п.).
- **buildScene() полная перерисовка** — при смене темы. Canvas fade нужно делать через React `style={{ opacity }}` над `<canvas>`, а не внутри PixiJS.
- **AnimMode через props** — не через глобальный стейт, т.к. PixiJS-рантайм не имеет доступа к React context.
- **Performance**: SUB_CLONE_FLOAT_DRIFT и WAVE_SPEED напрямую влияют на CPU в ticker. В режиме corporate снижены вдвое.

### 8.3 RecentTasksPanel (уже реализовано)

Компонент `src/components/office-view/RecentTasksPanel.tsx` уже содержит envelope animation. Токены CSS можно применить для унификации с остальными анимациями без изменения логики.

### 8.4 Smoke burst text fix

```ts
// Текущий код (model.ts:210–211) — NEEDS FIX by Development:
const burstTxt = new Text({
  text: "펑",   // ← корейский символ, нарушает языковую политику

// Предлагаемый вариант:
  text: "✦",   // нейтральный, поддерживается system-ui
```

### 8.5 Интеграция с API событий

Согласно решению CEO, нужны новые API-эндпоинты для состояния анимаций (spawn/delegation events). Это задача для Development + Operations:
- `POST /api/office/animation-events` — push spawn/delegation event
- `GET /api/office/animation-state` — текущее состояние для SSR/reconnect

Design не блокирует реализацию — все визуальные спецификации выше применимы к любому механизму доставки событий.

---

## 9. Smoke Test Checklist (Manual QA)

- [ ] Агент появляется → smoke burst виден
- [ ] Delivery arc летит от CEO до комнаты по дуге
- [ ] Meeting badge показывает правильный цвет (kickoff/review/approved/hold)
- [ ] Sub-clone плавает с волновым движением
- [ ] Firework burst раз в ~3-7 секунд (игровой режим)
- [ ] Смена темы light→dark: canvas плавно переходит
- [ ] RecentTasksPanel: envelope анимация видна
- [ ] Нет корейских символов в burst text (после фикса)

---

*Дизайн-спек подготовлен отделом Design. Для Production-ready реализации требуется участие Development-отдела.*
