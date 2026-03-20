import type { MutableRefObject } from "react";
import { Container, Graphics, Text, TextStyle, type Application, type Texture } from "pixi.js";
import type { Agent, Department, SubAgent, Task } from "../../types";
import { localeName } from "../../i18n";
import type { CallbackSnapshot, AnimItem, SubCloneAnimItem } from "./buildScene-types";
import {
  COLS_PER_ROW,
  DESK_W,
  ROOM_PAD,
  SLOT_H,
  SLOT_W,
  TARGET_CHAR_H,
  type AnimMode,
  type RoomRect,
  type SubCloneBurstParticle,
  type WallClockVisual,
  emitSubCloneSmokeBurst,
} from "./model";
import { DEPT_THEME, LOCALE_TEXT, type SupportedLocale, pickLocale } from "./themes-locale";
import {
  blendColor,
  contrastTextColor,
  drawAmbientGlow,
  drawBunting,
  drawCeilingLight,
  drawPictureFrame,
  drawRug,
  drawRoomAtmosphere,
  drawTiledFloor,
  drawWallClock,
  drawWindow,
} from "./drawing-core";
import { drawChair, drawDesk, drawPlant, drawWhiteboard } from "./drawing-furniture-a";
import { drawBookshelf, drawDoneTrashCan } from "./drawing-furniture-b";
import { renderDeskAgentAndSubClones } from "./buildScene-department-agent";

interface BuildDepartmentRoomsParams {
  app: Application;
  textures: Record<string, Texture>;
  departments: Department[];
  agents: Agent[];
  tasks: Task[];
  subAgents: SubAgent[];
  unread?: Set<string>;
  customThemes?: Record<string, { floor1: number; floor2: number; wall: number; accent: number }>;
  activeLocale: SupportedLocale;
  gridCols: number;
  roomStartX: number;
  roomW: number;
  roomH: number;
  roomGap: number;
  deptStartY: number;
  agentRows: number;
  spriteMap: Map<string, number>;
  cbRef: MutableRefObject<CallbackSnapshot>;
  roomRectsRef: MutableRefObject<RoomRect[]>;
  agentPosRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  animItemsRef: MutableRefObject<AnimItem[]>;
  subCloneAnimItemsRef: MutableRefObject<SubCloneAnimItem[]>;
  subCloneBurstParticlesRef: MutableRefObject<SubCloneBurstParticle[]>;
  wallClocksRef: MutableRefObject<WallClockVisual[]>;
  removedSubBurstsByParent: Map<string, Array<{ x: number; y: number }>>;
  addedWorkingSubIds: Set<string>;
  nextSubSnapshot: Map<string, { parentAgentId: string; x: number; y: number }>;
  animMode?: AnimMode;
}

export function buildDepartmentRooms({
  app,
  textures,
  departments,
  agents,
  tasks,
  subAgents,
  unread,
  customThemes,
  activeLocale,
  gridCols,
  roomStartX,
  roomW,
  roomH,
  roomGap,
  deptStartY,
  agentRows,
  spriteMap,
  cbRef,
  roomRectsRef,
  agentPosRef,
  animItemsRef,
  subCloneAnimItemsRef,
  subCloneBurstParticlesRef,
  wallClocksRef,
  removedSubBurstsByParent,
  addedWorkingSubIds,
  nextSubSnapshot,
  animMode = "game",
}: BuildDepartmentRoomsParams): void {
  departments.forEach((dept, deptIdx) => {
    const col = deptIdx % gridCols;
    const row = Math.floor(deptIdx / gridCols);
    const rx = roomStartX + col * (roomW + roomGap);
    const ry = deptStartY + row * (roomH + roomGap);
    const theme = customThemes?.[dept.id] || DEPT_THEME[dept.id] || DEPT_THEME.dev;
    const deptAgents = agents.filter((agent) => agent.department_id === dept.id);
    roomRectsRef.current.push({ dept, x: rx, y: ry, w: roomW, h: roomH });

    const room = new Container();

    const floorG = new Graphics();
    drawTiledFloor(floorG, rx, ry, roomW, roomH, theme.floor1, theme.floor2);
    room.addChild(floorG);
    drawRoomAtmosphere(room, rx, ry, roomW, roomH, theme.wall, theme.accent);

    const wallG = new Graphics();
    wallG.roundRect(rx, ry, roomW, roomH, 3).stroke({ width: 2.5, color: theme.wall });
    room.addChild(wallG);

    const doorG = new Graphics();
    doorG.rect(rx + roomW / 2 - 16, ry - 2, 32, 5).fill(0xf5f0e8);
    room.addChild(doorG);

    const signW = 102;
    const signH = 26;
    const signX = rx + roomW / 2 - signW / 2;
    const signY = ry - 8;
    const signBg = new Graphics();
    // Drop shadow
    signBg.roundRect(signX + 1.5, signY + 2, signW, signH, 5).fill({ color: 0x000000, alpha: 0.18 });
    // Main background
    signBg.roundRect(signX, signY, signW, signH, 5).fill(theme.accent);
    // Inner highlight line
    signBg.roundRect(signX + 1, signY + 1, signW - 2, signH - 2, 4).stroke({ width: 1, color: 0xffffff, alpha: 0.18 });
    signBg.eventMode = "static";
    signBg.cursor = "pointer";
    signBg.on("pointerdown", () => cbRef.current.onSelectDepartment(dept));
    room.addChild(signBg);
    // Emoji icon
    {
      const iconText = new Text({
        text: dept.icon || "🏢",
        style: new TextStyle({ fontSize: 12, fontFamily: "system-ui, sans-serif" }),
      });
      iconText.anchor.set(0, 0.5);
      iconText.position.set(signX + 6, signY + signH / 2);
      room.addChild(iconText);
    }
    // Department name
    const signTxt = new Text({
      text: localeName(activeLocale, dept),
      style: new TextStyle({
        fontSize: 10,
        fill: 0xffffff,
        fontWeight: "700",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        dropShadow: { alpha: 0.45, blur: 1.5, distance: 1, color: 0x000000 },
        letterSpacing: 0.3,
      }),
    });
    signTxt.anchor.set(0, 0.5);
    signTxt.position.set(signX + 23, signY + signH / 2);
    room.addChild(signTxt);

    const deptTasks = tasks
      .filter((t) => t.department_id === dept.id && t.status !== "cancelled" && t.status !== "done")
      .sort((a, b) => (b.priority ?? 3) - (a.priority ?? 3))
      .slice(0, 6)
      .map((t) => ({ title: t.title, status: t.status }));
    const deptDoneCount = tasks.filter(
      (t) => t.department_id === dept.id && t.status === "done",
    ).length;
    drawCeilingAndDecor(room, rx, ry, roomW, roomH, theme, deptIdx, wallClocksRef, deptDoneCount, activeLocale);

    if (deptAgents.length > 0) {
      drawRug(
        room,
        rx + roomW / 2,
        ry + 38 + (Math.min(agentRows, 2) * SLOT_H) / 2,
        roomW - 40,
        Math.min(agentRows, 2) * SLOT_H - 10,
        theme.accent,
      );
    }

    if (deptAgents.length === 0) {
      const emptyText = new Text({
        text: pickLocale(activeLocale, LOCALE_TEXT.noAssignedAgent),
        style: new TextStyle({ fontSize: 10, fill: 0x9a8a7a, fontFamily: "system-ui, sans-serif" }),
      });
      emptyText.anchor.set(0.5, 0.5);
      emptyText.position.set(rx + roomW / 2, ry + roomH / 2);
      room.addChild(emptyText);
    }

    deptAgents.forEach((agent, agentIdx) => {
      const acol = agentIdx % COLS_PER_ROW;
      const arow = Math.floor(agentIdx / COLS_PER_ROW);
      const ax = rx + ROOM_PAD + acol * SLOT_W + SLOT_W / 2;
      const ay = ry + 38 + arow * SLOT_H;
      const isWorking = agent.status === "working";
      const isOffline = agent.status === "offline";
      const isBreak = agent.status === "break";

      const nameY = ay;
      const charFeetY = nameY + 24 + TARGET_CHAR_H;
      const deskY = charFeetY - 8;

      agentPosRef.current.set(agent.id, { x: ax, y: deskY });

      renderAgentHeader(room, ax, nameY, agent, theme.accent, unread, activeLocale);
      drawChair(room, ax, charFeetY - TARGET_CHAR_H * 0.18, theme.accent);

      const removedBursts = removedSubBurstsByParent.get(agent.id);
      if (removedBursts && removedBursts.length > 0) {
        for (const burst of removedBursts) {
          emitSubCloneSmokeBurst(room, subCloneBurstParticlesRef.current, burst.x, burst.y, "despawn", animMode);
        }
        removedSubBurstsByParent.delete(agent.id);
      }

      if (isBreak) {
        drawBreakAwayTag(room, ax, deskY, charFeetY, activeLocale, theme.accent);
      } else {
        renderDeskAgentAndSubClones({
          room,
          textures,
          spriteMap,
          agent,
          tasks,
          subAgents,
          ax,
          deskY,
          charFeetY,
          isWorking,
          isOffline,
          cbRef,
          animItemsRef,
          subCloneAnimItemsRef,
          subCloneBurstParticlesRef,
          addedWorkingSubIds,
          nextSubSnapshot,
          themeAccent: theme.accent,
          animMode,
        });
      }
    });

    // Whiteboard on top of everything
    drawWhiteboard(room, rx + roomW - 122, ry + 28, deptTasks);

    app.stage.addChild(room);
  });
}

function drawCeilingAndDecor(
  room: Container,
  rx: number,
  ry: number,
  roomW: number,
  roomH: number,
  theme: { accent: number; wall: number },
  deptIdx: number,
  wallClocksRef: MutableRefObject<WallClockVisual[]>,
  doneCount: number,
  locale: SupportedLocale,
): void {
  drawCeilingLight(room, rx + roomW / 2, ry + 14, theme.accent);
  drawAmbientGlow(room, rx + roomW / 2, ry + roomH / 2, roomW * 0.4, theme.accent, 0.04);
  drawBunting(
    room,
    rx + 12,
    ry + 16,
    roomW - 24,
    blendColor(theme.accent, 0xffffff, 0.2),
    blendColor(theme.wall, 0xffffff, 0.4),
    0.52,
  );

  drawBookshelf(room, rx + 6, ry + 18);
  wallClocksRef.current.push(drawWallClock(room, rx + roomW - 16, ry + 12));
  drawWindow(room, rx + roomW / 2 - 12, ry + 16);
  if (roomW > 240) {
    drawWindow(room, rx + roomW / 2 - 40, ry + 16, 20, 16);
    drawWindow(room, rx + roomW / 2 + 20, ry + 16, 20, 16);
  }
  if (roomW > 200) {
    drawPictureFrame(room, rx + 40, ry + 20);
  }

  drawPlant(room, rx + 8, ry + roomH - 14, deptIdx);
  drawPlant(room, rx + roomW - 12, ry + roomH - 14, deptIdx + 1);
  drawDoneTrashCan(room, rx + roomW - 14, ry + roomH - 26, doneCount, locale);
}

function renderAgentHeader(
  room: Container,
  ax: number,
  nameY: number,
  agent: Agent,
  accent: number,
  unread: Set<string> | undefined,
  activeLocale: SupportedLocale,
): void {
  const nameText = new Text({
    text: localeName(activeLocale, agent),
    style: new TextStyle({
      fontSize: 8.5,
      fill: 0x1e1e2e,
      fontWeight: "700",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }),
  });
  nameText.anchor.set(0.5, 0);
  const nameTagW = nameText.width + 8;
  const nameTagBg = new Graphics();
  // Shadow
  nameTagBg.roundRect(ax - nameTagW / 2 + 1, nameY + 1, nameTagW, 13, 3).fill({ color: 0x000000, alpha: 0.1 });
  // Background
  nameTagBg.roundRect(ax - nameTagW / 2, nameY, nameTagW, 13, 3).fill({ color: 0xffffff, alpha: 0.92 });
  nameTagBg.roundRect(ax - nameTagW / 2, nameY, nameTagW, 13, 3).stroke({ width: 0.5, color: accent, alpha: 0.3 });
  room.addChild(nameTagBg);
  nameText.position.set(ax, nameY + 2);
  room.addChild(nameText);

  if (unread?.has(agent.id)) {
    const bangX = ax + nameTagW / 2 + 2;
    const bangBg = new Graphics();
    bangBg.circle(bangX, nameY + 6, 6).fill(0xff3333);
    bangBg.circle(bangX, nameY + 6, 6).stroke({ width: 1, color: 0xff0000, alpha: 0.6 });
    bangBg.eventMode = "static";
    bangBg.cursor = "pointer";
    room.addChild(bangBg);
    const bangTxt = new Text({
      text: "!",
      style: new TextStyle({ fontSize: 8, fill: 0xffffff, fontWeight: "bold", fontFamily: "monospace" }),
    });
    bangTxt.anchor.set(0.5, 0.5);
    bangTxt.position.set(bangX, nameY + 6);
    room.addChild(bangTxt);

    // Tooltip
    const tipLabel = pickLocale(activeLocale, {
      ko: "",
      en: "Unread messages",
      ja: "未読メッセージ",
      zh: "未读消息",
      ru: "Непрочитанные сообщения",
    });
    const tipTxt = new Text({
      text: tipLabel,
      style: new TextStyle({ fontSize: 9, fill: 0xffffff, fontFamily: "'Inter', system-ui, sans-serif" }),
    });
    const tipBg = new Graphics();
    const tipW = tipTxt.width + 10;
    const tipH = 16;
    const tipX = bangX - tipW / 2;
    const tipY = nameY - 20;
    tipBg.roundRect(tipX, tipY, tipW, tipH, 4).fill({ color: 0x1a1a2e, alpha: 0.92 });
    tipBg.roundRect(tipX, tipY, tipW, tipH, 4).stroke({ width: 0.5, color: 0xff3333, alpha: 0.6 });
    tipTxt.anchor.set(0.5, 0.5);
    tipTxt.position.set(bangX, tipY + tipH / 2);
    const tipContainer = new Container();
    tipContainer.addChild(tipBg);
    tipContainer.addChild(tipTxt);
    tipContainer.visible = false;
    room.addChild(tipContainer);
    bangBg.on("pointerenter", () => { tipContainer.visible = true; });
    bangBg.on("pointerleave", () => { tipContainer.visible = false; });
    bangBg.on("pointerdown", () => { cbRef.current.onSelectAgent(agent); });
  }

  const roleText = new Text({
    text: pickLocale(
      activeLocale,
      LOCALE_TEXT.role[agent.role as keyof typeof LOCALE_TEXT.role] || {
        ko: agent.role,
        en: agent.role,
        ja: agent.role,
        zh: agent.role,
      },
    ),
    style: new TextStyle({
      fontSize: 7,
      fill: contrastTextColor(accent),
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      letterSpacing: 0.2,
    }),
  });
  roleText.anchor.set(0.5, 0.5);
  const roleTagW = roleText.width + 6;
  const roleTagBg = new Graphics();
  roleTagBg.roundRect(ax - roleTagW / 2, nameY + 14, roleTagW, 10, 3).fill({ color: accent, alpha: 0.9 });
  room.addChild(roleTagBg);
  roleText.position.set(ax, nameY + 19);
  room.addChild(roleText);
}

function drawBreakAwayTag(
  room: Container,
  ax: number,
  deskY: number,
  charFeetY: number,
  activeLocale: SupportedLocale,
  accent: number,
): void {
  drawDesk(room, ax - DESK_W / 2, deskY, false);
  const awayTagY = charFeetY - TARGET_CHAR_H / 2;
  const awayTagBgColor = blendColor(accent, 0x101826, 0.78);
  const awayTag = new Text({
    text: pickLocale(activeLocale, LOCALE_TEXT.breakRoom),
    style: new TextStyle({
      fontSize: 8,
      fill: contrastTextColor(awayTagBgColor),
      fontWeight: "bold",
      fontFamily: "system-ui, sans-serif",
    }),
  });
  awayTag.anchor.set(0.5, 0.5);
  const awayTagW = awayTag.width + 10;
  const awayTagH = awayTag.height + 4;
  const awayTagBg = new Graphics();
  awayTagBg
    .roundRect(ax - awayTagW / 2, awayTagY - awayTagH / 2, awayTagW, awayTagH, 3)
    .fill({ color: awayTagBgColor, alpha: 0.9 });
  awayTagBg
    .roundRect(ax - awayTagW / 2, awayTagY - awayTagH / 2, awayTagW, awayTagH, 3)
    .stroke({ width: 1, color: blendColor(accent, 0xffffff, 0.2), alpha: 0.85 });
  room.addChild(awayTagBg);
  awayTag.position.set(ax, awayTagY + 0.5);
  room.addChild(awayTag);
}
