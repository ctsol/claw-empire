import { randomUUID } from "node:crypto";
import type { RuntimeContext } from "../../../types/runtime-context.ts";

type CeoMeetingMode = "reporting" | "planning";
type CeoMeetingState = "idle" | "running" | "waiting_ceo" | "ready" | "done";

interface CeoMeetingMessage {
  id: string;
  role: "ceo" | "agent" | "system";
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
  content: string;
  options?: string[];
  timestamp: number;
}

interface CeoMeetingParticipant {
  id: string;
  name: string;
  emoji: string;
  role: string;
  departmentId: string;
  departmentName: string;
}

interface CeoMeetingSession {
  id: string;
  mode: CeoMeetingMode;
  topic: string;
  lang: string;
  projectId: string | null;
  projectPath: string | null;
  participants: CeoMeetingParticipant[];
  messages: CeoMeetingMessage[];
  state: CeoMeetingState;
  round: number;
  tasksCreated: boolean;
  createdAt: number;
}

function extractOptions(text: string): string[] {
  // Look for patterns like [Option A], [Вариант 1], [Yes], [No], etc.
  // Allow up to 150 chars to support Russian long phrases
  const bracketMatches = text.match(/\[([^\]]{2,150})\]/g);
  if (bracketMatches && bracketMatches.length >= 2) {
    return bracketMatches.map((m) => m.slice(1, -1).trim()).filter(Boolean).slice(0, 6);
  }
  // Look for numbered/lettered lists: "1. Foo\n2. Bar" or "А) Foo\nБ) Bar"
  const listMatches = text.match(/^[\s]*(?:[А-Яа-я]\)|[A-Za-z]\)|[1-9][\).])\s+.+/gm);
  if (listMatches && listMatches.length >= 2) {
    return listMatches.map((m) => m.replace(/^[\s]*(?:[А-Яа-я]\)|[A-Za-z]\)|[1-9][\).])\s+/, "").trim()).slice(0, 6);
  }
  return [];
}

function buildReportingPrompt(participant: CeoMeetingParticipant, lang: string): string {
  const langInstruction =
    lang === "ko"
      ? "."
      : lang === "ja"
        ? "日本語で答えてください。"
        : lang === "zh"
          ? "请用中文回答。"
          : lang === "ru"
            ? "Отвечайте на русском языке."
            : "Reply in English.";

  return [
    `[CEO Staff Meeting — Status Report]`,
    `You are the ${participant.role} of the ${participant.departmentName} department.`,
    `Provide a brief status report (3-5 sentences) covering:`,
    `1. Current work in progress`,
    `2. Any blockers or risks`,
    `3. Near-term priorities`,
    ``,
    `${langInstruction}`,
    `Output rules:`,
    `- Plain text only, no markdown headers.`,
    `- Be concise and professional.`,
    `- Speak as yourself (${participant.role} of ${participant.departmentName}).`,
  ].join("\n");
}

function buildPlanningRound1Prompt(
  participant: CeoMeetingParticipant,
  topic: string,
  lang: string,
  previousMessages: CeoMeetingMessage[],
): string {
  const langInstruction =
    lang === "ru"
      ? "Отвечайте на русском языке."
      : lang === "ko"
        ? "."
        : lang === "ja"
          ? "日本語で答えてください。"
          : lang === "zh"
            ? "请用中文回答。"
            : "Reply in English.";

  const prevContext =
    previousMessages.length > 0
      ? previousMessages
          .filter((m) => m.role !== "system")
          .slice(-6)
          .map((m) => `${m.role === "ceo" ? "CEO" : m.agentName ?? "Agent"}: ${m.content}`)
          .join("\n")
      : "";

  return [
    `[CEO Strategic Planning Meeting — Round 1: Clarification]`,
    `You are the ${participant.role} of the ${participant.departmentName} department.`,
    ``,
    `CEO's planning topic: "${topic}"`,
    prevContext ? `\n[Discussion so far]\n${prevContext}\n` : "",
    `Your task:`,
    `Ask 1-2 focused clarifying questions relevant to your department's role in this plan.`,
    `After each question, provide 2-4 concrete answer options in square brackets.`,
    `Example format:`,
    `What priority should ${participant.departmentName} assign to this? [High priority] [Medium priority] [Low priority]`,
    ``,
    `${langInstruction}`,
    `Output rules:`,
    `- 1-2 questions max, each with answer options in [square brackets].`,
    `- Be direct and practical.`,
    `- No preamble, just the questions.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPlanningRound2Prompt(
  participant: CeoMeetingParticipant,
  topic: string,
  lang: string,
  allMessages: CeoMeetingMessage[],
): string {
  const langInstruction =
    lang === "ru"
      ? "Отвечайте на русском языке."
      : lang === "ko"
        ? "."
        : lang === "ja"
          ? "日本語で答えてください。"
          : lang === "zh"
            ? "请用中文回答。"
            : "Reply in English.";

  const context = allMessages
    .filter((m) => m.role !== "system")
    .slice(-10)
    .map((m) => `${m.role === "ceo" ? "CEO" : m.agentName ?? "Agent"}: ${m.content}`)
    .join("\n");

  return [
    `[CEO Strategic Planning Meeting — Round 2: Implementation Readiness]`,
    `You are the ${participant.role} of the ${participant.departmentName} department.`,
    ``,
    `Planning topic: "${topic}"`,
    ``,
    `[Full discussion so far]`,
    context,
    ``,
    `Based on all the information gathered above, briefly describe:`,
    `1. What ${participant.departmentName} will do as part of this plan (2-3 specific action items).`,
    `2. End your response with exactly: ✅ Ready to proceed`,
    ``,
    `${langInstruction}`,
    `Output rules:`,
    `- Keep it to 3-5 sentences.`,
    `- Be specific and actionable.`,
    `- Always end with ✅ Ready to proceed`,
  ].join("\n");
}

export function registerCeoMeetingRoutes(ctx: RuntimeContext): void {
  const { app, db, broadcast, runAgentOneShot, chooseSafeReply, startTaskExecutionForAgent, getDeptName } = ctx;

  // In-memory session store
  const sessions = new Map<string, CeoMeetingSession>();

  function findTeamLeaders(): CeoMeetingParticipant[] {
    const rows = db
      .prepare(
        `
      SELECT a.id, a.name, a.name_ko, a.avatar_emoji, a.role,
             COALESCE(d.name, '') as dept_name,
             COALESCE(a.department_id, '') as dept_id
      FROM agents a
      LEFT JOIN departments d ON d.id = a.department_id
      WHERE a.role = 'team_leader'
        AND (a.workflow_pack_key IS NULL OR a.workflow_pack_key = 'development')
      ORDER BY d.sort_order ASC, a.created_at ASC
      LIMIT 8
    `,
      )
      .all() as Array<{
      id: string;
      name: string;
      name_ko: string | null;
      avatar_emoji: string | null;
      role: string;
      dept_name: string;
      dept_id: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.avatar_emoji ?? "👤",
      role: r.role,
      departmentId: r.dept_id,
      departmentName: r.dept_name || r.dept_id,
    }));
  }

  function getAgentRow(agentId: string): any {
    return db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) ?? null;
  }

  function broadcastMeetingEvent(session: CeoMeetingSession, type: string, extra?: Record<string, unknown>) {
    broadcast("ceo_advanced_meeting", { type, sessionId: session.id, ...extra });
  }

  function addMessage(session: CeoMeetingSession, msg: Omit<CeoMeetingMessage, "id" | "timestamp">): CeoMeetingMessage {
    const full: CeoMeetingMessage = { id: randomUUID(), timestamp: Date.now(), ...msg };
    session.messages.push(full);
    broadcastMeetingEvent(session, "message", { message: full });
    return full;
  }

  async function runReportingRound(session: CeoMeetingSession): Promise<void> {
    session.state = "running";
    broadcastMeetingEvent(session, "state", { state: session.state });

    const lang = session.lang;
    for (const participant of session.participants) {
      const agentRow = getAgentRow(participant.id);
      if (!agentRow) continue;

      const prompt = buildReportingPrompt(participant, lang);
      try {
        const run = await runAgentOneShot(agentRow, prompt, { noTools: true, timeoutMs: 45_000 });
        const reply = chooseSafeReply(run, lang, "direct", agentRow);
        addMessage(session, {
          role: "agent",
          agentId: participant.id,
          agentName: participant.name,
          agentEmoji: participant.emoji,
          content: reply,
        });
      } catch {
        addMessage(session, {
          role: "agent",
          agentId: participant.id,
          agentName: participant.name,
          agentEmoji: participant.emoji,
          content: lang === "ru" ? "Нет данных для отчёта." : "No report data available.",
        });
      }

      // Small delay between agents for natural feel
      await new Promise((r) => setTimeout(r, 800));
    }

    // After reporting, go to "ready" so CEO can create tasks
    session.state = "ready";
    broadcastMeetingEvent(session, "state", { state: session.state });
  }

  async function runPlanningRound1(session: CeoMeetingSession): Promise<void> {
    session.state = "running";
    session.round = 1;
    broadcastMeetingEvent(session, "state", { state: session.state });

    const lang = session.lang;
    for (const participant of session.participants) {
      const agentRow = getAgentRow(participant.id);
      if (!agentRow) continue;

      const prompt = buildPlanningRound1Prompt(participant, session.topic, lang, session.messages);
      try {
        const run = await runAgentOneShot(agentRow, prompt, { noTools: true, timeoutMs: 45_000 });
        const reply = chooseSafeReply(run, lang, "direct", agentRow);
        const options = extractOptions(reply);
        addMessage(session, {
          role: "agent",
          agentId: participant.id,
          agentName: participant.name,
          agentEmoji: participant.emoji,
          content: reply,
          options: options.length >= 2 ? options : undefined,
        });
      } catch {
        addMessage(session, {
          role: "agent",
          agentId: participant.id,
          agentName: participant.name,
          agentEmoji: participant.emoji,
          content: lang === "ru" ? "Готов к обсуждению." : "Ready to discuss.",
        });
      }

      await new Promise((r) => setTimeout(r, 600));
    }

    session.state = "waiting_ceo";
    broadcastMeetingEvent(session, "state", { state: session.state });
  }

  async function runPlanningRound2(session: CeoMeetingSession): Promise<void> {
    session.state = "running";
    session.round = 2;
    broadcastMeetingEvent(session, "state", { state: session.state });

    const lang = session.lang;
    for (const participant of session.participants) {
      const agentRow = getAgentRow(participant.id);
      if (!agentRow) continue;

      const prompt = buildPlanningRound2Prompt(participant, session.topic, lang, session.messages);
      try {
        const run = await runAgentOneShot(agentRow, prompt, { noTools: true, timeoutMs: 45_000 });
        const reply = chooseSafeReply(run, lang, "direct", agentRow);
        addMessage(session, {
          role: "agent",
          agentId: participant.id,
          agentName: participant.name,
          agentEmoji: participant.emoji,
          content: reply,
        });
      } catch {
        addMessage(session, {
          role: "agent",
          agentId: participant.id,
          agentName: participant.name,
          agentEmoji: participant.emoji,
          content: lang === "ru" ? "✅ Готов к работе." : "✅ Ready to proceed.",
        });
      }

      await new Promise((r) => setTimeout(r, 600));
    }

    session.state = "ready";
    broadcastMeetingEvent(session, "state", { state: session.state });
  }

  // POST /api/ceo-meeting/start
  app.post("/api/ceo-meeting/start", async (req, res) => {
    try {
      const mode: CeoMeetingMode = req.body?.mode === "reporting" ? "reporting" : "planning";
      const topic = String(req.body?.topic ?? "").trim();
      const projectId = String(req.body?.projectId ?? "").trim() || null;
      const lang = String(
        req.body?.lang ?? (db.prepare("SELECT value FROM settings WHERE key = 'language'").get() as any)?.value ?? "en",
      ).slice(0, 2);

      if (mode === "planning" && !topic) {
        return res.status(400).json({ error: "topic_required", message: "Planning mode requires a topic." });
      }

      // Resolve project path if projectId provided
      let projectPath: string | null = null;
      if (projectId) {
        const proj = db.prepare("SELECT project_path FROM projects WHERE id = ?").get(projectId) as { project_path?: string } | undefined;
        projectPath = proj?.project_path ?? null;
      }

      const participants = findTeamLeaders();
      if (participants.length === 0) {
        return res.status(400).json({ error: "no_leaders", message: "No team leaders found." });
      }

      const sessionId = randomUUID();
      const session: CeoMeetingSession = {
        id: sessionId,
        mode,
        topic: topic || (lang === "ru" ? "Общее совещание" : "General Meeting"),
        lang,
        projectId,
        projectPath,
        participants,
        messages: [],
        state: "idle",
        round: 0,
        tasksCreated: false,
        createdAt: Date.now(),
      };
      sessions.set(sessionId, session);

      // System intro
      const projectNote = projectId && projectPath
        ? (lang === "ru" ? ` Проект: ${projectPath}.` : ` Project: ${projectPath}.`)
        : "";
      addMessage(session, {
        role: "system",
        content:
          lang === "ru"
            ? mode === "reporting"
              ? `Совещание начато. Режим: Отчётность.${projectNote} Участники (${participants.length}): ${participants.map((p) => p.name).join(", ")}.`
              : `Совещание начато. Режим: Планирование. Тема: "${session.topic}".${projectNote} Участники (${participants.length}): ${participants.map((p) => p.name).join(", ")}.`
            : mode === "reporting"
              ? `Meeting started. Mode: Reporting.${projectNote} Participants (${participants.length}): ${participants.map((p) => p.name).join(", ")}.`
              : `Meeting started. Mode: Planning. Topic: "${session.topic}".${projectNote} Participants (${participants.length}): ${participants.map((p) => p.name).join(", ")}.`,
      });

      broadcastMeetingEvent(session, "started", { participants, mode, topic: session.topic, projectId, projectPath });

      res.json({ sessionId, participants, mode, topic: session.topic, projectId, projectPath });

      // Run agents in background
      if (mode === "reporting") {
        void runReportingRound(session);
      } else {
        void runPlanningRound1(session);
      }
    } catch (err) {
      console.error("[ceo-meeting] start error:", err);
      res.status(500).json({ error: "internal_error", message: String(err) });
    }
  });

  // POST /api/ceo-meeting/:sessionId/reply
  app.post("/api/ceo-meeting/:sessionId/reply", async (req, res) => {
    try {
      const session = sessions.get(req.params.sessionId);
      if (!session) return res.status(404).json({ error: "session_not_found" });
      if (session.state === "done" || session.state === "idle") {
        return res.status(400).json({ error: "meeting_ended", message: "Meeting has ended." });
      }

      const message = String(req.body?.message ?? "").trim();
      if (!message) return res.status(400).json({ error: "message_required" });

      // Add CEO message
      addMessage(session, { role: "ceo", content: message });

      res.json({ ok: true });

      // If session is waiting for CEO or ready, trigger next planning round
      if (session.mode === "planning" && session.state !== "running") {
        void runPlanningRound2(session);
      }
      // If session is running, the CEO message will be included in context when current round finishes
    } catch (err) {
      res.status(500).json({ error: "internal_error", message: String(err) });
    }
  });

  // GET /api/ceo-meeting/:sessionId
  app.get("/api/ceo-meeting/:sessionId", (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "session_not_found" });
    res.json({
      id: session.id,
      mode: session.mode,
      topic: session.topic,
      lang: session.lang,
      state: session.state,
      round: session.round,
      tasksCreated: session.tasksCreated,
      participants: session.participants,
      messages: session.messages,
    });
  });

  // POST /api/ceo-meeting/:sessionId/create-tasks
  app.post("/api/ceo-meeting/:sessionId/create-tasks", async (req, res) => {
    try {
      const session = sessions.get(req.params.sessionId);
      if (!session) return res.status(404).json({ error: "session_not_found" });
      if (session.state === "idle") {
        return res.status(400).json({ error: "invalid_state", message: "Meeting has not started yet." });
      }
      if (session.tasksCreated) {
        return res.status(400).json({ error: "already_created", message: "Tasks were already created for this meeting." });
      }

      const now = Date.now();
      const topicTitle = session.topic;
      const lang = session.lang;
      const createdTaskIds: string[] = [];

      // Collect all CEO decisions (messages from CEO)
      const ceoDecisions = session.messages
        .filter((m) => m.role === "ceo")
        .map((m) => m.content)
        .join("\n");

      for (const participant of session.participants) {
        // For planning: use the agent's round-2 summary (last message) as the task description
        // For reporting: use the agent's status report
        const agentMsgs = session.messages
          .filter((m) => m.role === "agent" && m.agentId === participant.id)
          .map((m) => m.content);

        // Use the LAST message as the main content (round 2 summary or report)
        const mainContent = agentMsgs[agentMsgs.length - 1] ?? "";

        const taskId = randomUUID();
        const prefix = lang === "ru" ? "Совещание" : "Meeting";
        const taskTitle = `[${prefix}] ${topicTitle} — ${participant.departmentName}`;
        const taskDesc = [
          lang === "ru"
            ? `Задача из совещания CEO.\nТема: ${topicTitle}`
            : `Task from CEO Meeting.\nTopic: ${topicTitle}`,
          ceoDecisions
            ? (lang === "ru" ? `\n[Решения CEO]\n${ceoDecisions}` : `\n[CEO Decisions]\n${ceoDecisions}`)
            : "",
          mainContent
            ? (lang === "ru" ? `\n[План отдела]\n${mainContent}` : `\n[Department Plan]\n${mainContent}`)
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        db.prepare(
          `INSERT INTO tasks (id, title, description, department_id, assigned_agent_id, project_id, project_path, status, priority, task_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'planned', 2, 'general', ?, ?)`,
        ).run(taskId, taskTitle, taskDesc, participant.departmentId, participant.id, session.projectId, session.projectPath, now, now);

        const taskRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
        broadcast("task_update", taskRow);
        createdTaskIds.push(taskId);
      }

      session.tasksCreated = true;
      session.state = "done";
      broadcastMeetingEvent(session, "tasks_created", { taskIds: createdTaskIds });
      addMessage(session, {
        role: "system",
        content:
          lang === "ru"
            ? `✅ Создано ${createdTaskIds.length} задач по итогам совещания. Команды приступают к работе.`
            : `✅ Created ${createdTaskIds.length} tasks from the meeting. Teams are starting work.`,
      });

      res.json({ ok: true, taskIds: createdTaskIds });

      // Auto-start tasks immediately — don't wait for decision inbox
      for (const [idx, participant] of session.participants.entries()) {
        const taskId = createdTaskIds[idx];
        if (!taskId) continue;
        const agentRow = db.prepare("SELECT * FROM agents WHERE id = ?").get(participant.id) as any;
        if (!agentRow) continue;
        const deptId = participant.departmentId || "dev";
        const deptName = getDeptName(deptId);
        // Stagger starts slightly so agents don't all pile up at once
        setTimeout(() => {
          const current = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as { status?: string } | undefined;
          if (current?.status === "planned") {
            startTaskExecutionForAgent(taskId, agentRow, deptId, deptName);
          }
        }, idx * 1500);
      }
    } catch (err) {
      console.error("[ceo-meeting] create-tasks error:", err);
      res.status(500).json({ error: "internal_error", message: String(err) });
    }
  });
}
