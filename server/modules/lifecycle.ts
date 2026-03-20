import type { RuntimeContext } from "../types/runtime-context.ts";
import type { IncomingMessage } from "node:http";
import type { WebSocket as WsSocket } from "ws";
import fs from "node:fs";
import path from "path";
import { HOST, PKG_VERSION, PORT } from "../config/runtime.ts";
import { notifyTaskStatus } from "../gateway/client.ts";
import { startDiscordReceiver } from "../messenger/discord-receiver.ts";
import { startTelegramReceiver } from "../messenger/telegram-receiver.ts";
import { registerGracefulShutdownHandlers } from "./lifecycle/register-graceful-shutdown.ts";

export function startLifecycle(ctx: RuntimeContext): void {
  const {
    IN_PROGRESS_ORPHAN_GRACE_MS,
    IN_PROGRESS_ORPHAN_SWEEP_MS,
    SUBTASK_DELEGATION_SWEEP_MS,
    WebSocket,
    WebSocketServer,
    activeProcesses,
    app,
    appendTaskLog,
    broadcast,
    clearTaskWorkflowState,
    db,
    dbPath,
    detectAllCli,
    distDir,
    endTaskExecutionSession,
    express,
    finishReview,
    getDecryptedOAuthToken,
    handleTaskRunComplete,
    isAgentInMeeting,
    isIncomingMessageAuthenticated,
    isIncomingMessageOriginTrusted,
    isPidAlive,
    isProduction,
    killPidTree,
    notifyCeo,
    nowMs,
    processSubtaskDelegations,
    reconcileCrossDeptSubtasks,
    refreshGoogleToken,
    resolveLang,
    rollbackTaskWorktree,
    runInTransaction,
    stopProgressTimer,
    stopRequestedTasks,
    startTaskExecutionForAgent,
    getDeptName,
    wsClients,
    logsDir,
  } = ctx as any;

  // ---------------------------------------------------------------------------
  // Production: serve React UI from dist/
  // ---------------------------------------------------------------------------
  if (isProduction) {
    app.use(express.static(distDir));
    // SPA fallback: serve index.html for non-API routes (Express 5 named wildcard)
    app.get(
      "/{*splat}",
      (
        req: { path: string },
        res: {
          status(code: number): { json(payload: unknown): unknown };
          sendFile(filePath: string): unknown;
        },
      ) => {
        if (req.path.startsWith("/api/") || req.path === "/health" || req.path === "/healthz") {
          return res.status(404).json({ error: "not_found" });
        }
        res.sendFile(path.join(distDir, "index.html"));
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Auto break rotation: idle ↔ break every 60s
  // ---------------------------------------------------------------------------
  function rotateBreaks(): void {
    // Rule: max 1 agent per department on break at a time
    const allAgents = db
      .prepare("SELECT id, department_id, status FROM agents WHERE status IN ('idle','break')")
      .all() as { id: string; department_id: string; status: string }[];

    if (allAgents.length === 0) return;

    // Meeting/CEO-office summoned agents should stay in office, not break room.
    for (const a of allAgents) {
      if (a.status === "break" && isAgentInMeeting(a.id)) {
        db.prepare("UPDATE agents SET status = 'idle' WHERE id = ?").run(a.id);
        broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(a.id));
      }
    }

    const candidates = allAgents.filter((a) => !isAgentInMeeting(a.id));
    if (candidates.length === 0) return;

    // Group by department
    const byDept = new Map<string, typeof candidates>();
    for (const a of candidates) {
      const list = byDept.get(a.department_id) || [];
      list.push(a);
      byDept.set(a.department_id, list);
    }

    for (const [, members] of byDept) {
      const onBreak = members.filter((a) => a.status === "break");
      const idle = members.filter((a) => a.status === "idle");

      if (onBreak.length > 1) {
        // Too many on break from same dept — return extras to idle
        const extras = onBreak.slice(1);
        for (const a of extras) {
          db.prepare("UPDATE agents SET status = 'idle' WHERE id = ?").run(a.id);
          broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(a.id));
        }
      } else if (onBreak.length === 1) {
        // 40% chance to return from break (avg ~2.5 min break)
        if (Math.random() < 0.4) {
          db.prepare("UPDATE agents SET status = 'idle' WHERE id = ?").run(onBreak[0].id);
          broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(onBreak[0].id));
        }
      } else if (onBreak.length === 0 && idle.length > 0) {
        // 50% chance to send one idle agent on break
        if (Math.random() < 0.5) {
          const pick = idle[Math.floor(Math.random() * idle.length)];
          db.prepare("UPDATE agents SET status = 'break' WHERE id = ?").run(pick.id);
          broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(pick.id));
        }
      }
    }
  }

  function pruneDuplicateReviewMeetings(): void {
    const rows = db
      .prepare(
        `
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY task_id, round, status
          ORDER BY started_at DESC, created_at DESC, id DESC
        ) AS rn
      FROM meeting_minutes
      WHERE meeting_type = 'review'
        AND status IN ('in_progress', 'failed')
    )
    SELECT id
    FROM ranked
    WHERE rn > 1
  `,
      )
      .all() as Array<{ id: string }>;
    if (rows.length === 0) return;

    const delEntries = db.prepare("DELETE FROM meeting_minute_entries WHERE meeting_id = ?");
    const delMeetings = db.prepare("DELETE FROM meeting_minutes WHERE id = ?");
    runInTransaction(() => {
      for (const id of rows.map((r) => r.id)) {
        delEntries.run(id);
        delMeetings.run(id);
      }
    });
  }

  type InProgressRecoveryReason = "startup" | "interval";
  const ORPHAN_RECENT_ACTIVITY_WINDOW_MS = Math.max(120_000, IN_PROGRESS_ORPHAN_GRACE_MS);

  function recoverOrphanWorkingAgents(reason: InProgressRecoveryReason): void {
    const workingAgents = db
      .prepare(
        `
    SELECT
      a.id AS agent_id,
      a.name AS agent_name,
      a.current_task_id,
      t.id AS task_id,
      t.status AS task_status
    FROM agents a
    LEFT JOIN tasks t ON t.id = a.current_task_id
    WHERE a.status = 'working'
      AND a.current_task_id IS NOT NULL
      AND TRIM(a.current_task_id) != ''
    ORDER BY a.name ASC
  `,
      )
      .all() as Array<{
      agent_id: string;
      agent_name: string | null;
      current_task_id: string;
      task_id: string | null;
      task_status: string | null;
    }>;

    for (const row of workingAgents) {
      const normalizedTaskStatus = String(row.task_status ?? "")
        .trim()
        .toLowerCase();
      if (row.task_id && normalizedTaskStatus === "in_progress") continue;

      const staleReason = row.task_id ? `task_status_${normalizedTaskStatus || "unknown"}` : "task_missing";
      const cleared = db
        .prepare("UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ? AND current_task_id = ?")
        .run(row.agent_id, row.current_task_id) as { changes?: number };
      if ((cleared.changes ?? 0) === 0) continue;

      broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(row.agent_id));
      console.warn(
        `[Claw-Empire] Recovery (${reason}): cleared stale working agent ${row.agent_id} (${row.agent_name || "unknown"}) -> ${row.current_task_id} (${staleReason})`,
      );
    }
  }

  function recoverOrphanInProgressTasks(reason: InProgressRecoveryReason): void {
    const inProgressTasks = db
      .prepare(
        `
    SELECT id, title, assigned_agent_id, created_at, started_at, updated_at
    FROM tasks
    WHERE status = 'in_progress'
    ORDER BY updated_at ASC
  `,
      )
      .all() as Array<{
      id: string;
      title: string;
      assigned_agent_id: string | null;
      created_at: number | null;
      started_at: number | null;
      updated_at: number | null;
    }>;

    const now = nowMs();
    for (const task of inProgressTasks) {
      const active = activeProcesses.get(task.id);
      if (active) {
        const pid = typeof active.pid === "number" ? active.pid : null;
        if (pid !== null && pid > 0 && !isPidAlive(pid)) {
          activeProcesses.delete(task.id);
          appendTaskLog(task.id, "system", `Recovery (${reason}): removed stale process handle (pid=${pid})`);
        } else {
          continue;
        }
      }

      const lastTouchedAt = Math.max(task.updated_at ?? 0, task.started_at ?? 0, task.created_at ?? 0);
      const ageMs = lastTouchedAt > 0 ? Math.max(0, now - lastTouchedAt) : IN_PROGRESS_ORPHAN_GRACE_MS + 1;
      if (ageMs < IN_PROGRESS_ORPHAN_GRACE_MS) continue;

      // 추가 안전장치 1: task_logs 활동이 최근 윈도우 내에 있으면 아직 활성 상태로 간주
      const recentLog = db
        .prepare(
          `
      SELECT created_at FROM task_logs
      WHERE task_id = ? AND created_at > ?
      ORDER BY created_at DESC LIMIT 1
    `,
        )
        .get(task.id, now - ORPHAN_RECENT_ACTIVITY_WINDOW_MS) as { created_at: number } | undefined;
      if (recentLog) {
        continue;
      }

      // 추가 안전장치 2: 터미널 로그 파일이 최근까지 갱신됐다면 여전히 출력이 진행 중인 것으로 간주
      // (예: 서버 리로드/재시작으로 in-memory process handle만 유실된 경우)
      try {
        const logPath = path.join(logsDir, `${task.id}.log`);
        const stat = fs.statSync(logPath);
        const logIdleMs = Math.max(0, now - Math.floor(stat.mtimeMs || 0));
        if (logIdleMs <= ORPHAN_RECENT_ACTIVITY_WINDOW_MS) {
          continue;
        }
      } catch {
        // 로그 파일이 없거나 접근 불가하면 기존 복구 로직 진행
      }

      const latestRunLog = db
        .prepare(
          `
      SELECT message
      FROM task_logs
      WHERE task_id = ?
        AND kind = 'system'
        AND (message LIKE 'RUN %' OR message LIKE 'Agent spawn failed:%')
      ORDER BY created_at DESC
      LIMIT 1
    `,
        )
        .get(task.id) as { message: string } | undefined;
      const latestRunMessage = latestRunLog?.message ?? "";

      if (latestRunMessage.startsWith("RUN completed (exit code: 0)")) {
        appendTaskLog(
          task.id,
          "system",
          `Recovery (${reason}): orphan in_progress detected (age_ms=${ageMs}) → replaying successful completion`,
        );
        handleTaskRunComplete(task.id, 0);
        continue;
      }

      if (latestRunMessage.startsWith("RUN ") || latestRunMessage.startsWith("Agent spawn failed:")) {
        appendTaskLog(
          task.id,
          "system",
          `Recovery (${reason}): orphan in_progress detected (age_ms=${ageMs}) → replaying failed completion`,
        );
        handleTaskRunComplete(task.id, 1);
        continue;
      }

      const t = nowMs();
      const move = db
        .prepare("UPDATE tasks SET status = 'inbox', updated_at = ? WHERE id = ? AND status = 'in_progress'")
        .run(t, task.id) as { changes?: number };
      if ((move.changes ?? 0) === 0) continue;

      stopProgressTimer(task.id);
      clearTaskWorkflowState(task.id);
      endTaskExecutionSession(task.id, `orphan_in_progress_${reason}`);
      appendTaskLog(
        task.id,
        "system",
        `Recovery (${reason}): in_progress without active process/run log (age_ms=${ageMs}) → inbox`,
      );

      if (task.assigned_agent_id) {
        db.prepare("UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ?").run(
          task.assigned_agent_id,
        );
        const updatedAgent = db.prepare("SELECT * FROM agents WHERE id = ?").get(task.assigned_agent_id);
        broadcast("agent_status", updatedAgent);
      }

      const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id);
      broadcast("task_update", updatedTask);
      const lang = resolveLang(task.title);
      notifyTaskStatus(task.id, task.title, "inbox", lang);
      const watchdogMessage =
        lang === "en"
          ? `[WATCHDOG] '${task.title}' was in progress but had no active process. Recovered to inbox.`
          : lang === "ja"
            ? `[WATCHDOG] '${task.title}' は in_progress でしたが実行プロセスが存在しないため inbox に復旧しました。`
            : lang === "zh"
              ? `[WATCHDOG] '${task.title}' 处于 in_progress，但未发现执行进程，已恢复到 inbox。`
              : lang === "ru"
                ? `[WATCHDOG] Задача '${task.title}' была in_progress, но активный процесс не обнаружен. Возвращено в inbox.`
                : `[WATCHDOG] '${task.title}' was in progress but had no active process. Recovered to inbox.`;
      notifyCeo(watchdogMessage, task.id);
    }
  }

  function recoverInterruptedWorkflowOnStartup(): void {
    pruneDuplicateReviewMeetings();
    try {
      reconcileCrossDeptSubtasks();
    } catch (err) {
      console.error("[Claw-Empire] startup reconciliation failed:", err);
    }

    recoverOrphanInProgressTasks("startup");
    recoverOrphanWorkingAgents("startup");
    recoverOrphanCollaboratingTasks("startup");

    const reviewTasks = db
      .prepare(
        `
    SELECT id, title
    FROM tasks
    WHERE status = 'review'
    ORDER BY updated_at ASC
  `,
      )
      .all() as Array<{ id: string; title: string }>;

    reviewTasks.forEach((task, idx) => {
      const delay = 1200 + idx * 400;
      setTimeout(() => {
        const current = db.prepare("SELECT status FROM tasks WHERE id = ?").get(task.id) as
          | { status: string }
          | undefined;
        if (!current || current.status !== "review") return;
        finishReview(task.id, task.title);
      }, delay);
    });
  }

  // Auto-assign and directly start inbox tasks (bypassing planned status)
  function startInboxTasks(): void {
    const autoAssignRow = db.prepare("SELECT value FROM settings WHERE key = 'autoAssign'").get() as
      | { value: string }
      | undefined;
    if (autoAssignRow?.value === "false") return;

    const now = nowMs();
    const usedAgentIds = new Set<string>();

    // Step 1: Inbox tasks that already have an assigned idle agent — start them directly
    const assignedRows = db
      .prepare(
        `
        SELECT t.id, t.title, t.assigned_agent_id, t.department_id
        FROM tasks t
        JOIN agents a ON a.id = t.assigned_agent_id
        WHERE t.status = 'inbox'
          AND t.assigned_agent_id IS NOT NULL
          AND a.status = 'idle'
          AND a.current_task_id IS NULL
          AND t.source_task_id IS NULL
        ORDER BY t.created_at ASC
        LIMIT 3
      `,
      )
      .all() as Array<{ id: string; title: string; assigned_agent_id: string; department_id: string | null }>;

    for (const row of assignedRows) {
      if (usedAgentIds.has(row.assigned_agent_id)) continue;
      usedAgentIds.add(row.assigned_agent_id);

      const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(row.assigned_agent_id) as
        | Record<string, unknown>
        | undefined;
      if (!agent || agent.status !== "idle") continue;

      db.prepare("UPDATE tasks SET status = 'planned', updated_at = ? WHERE id = ? AND status = 'inbox'").run(
        now,
        row.id,
      );
      appendTaskLog(row.id, "system", `inbox→planned: auto-promoted (assigned agent idle)`);
      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(row.id));

      const deptId = row.department_id ?? null;
      const deptName = getDeptName ? getDeptName(deptId) : (deptId ?? "Unassigned");
      console.log(`[lifecycle] starting inbox task (assigned agent): ${row.title.slice(0, 50)}`);
      startTaskExecutionForAgent(row.id, agent, deptId, deptName);
    }

    // Step 2: Inbox tasks without an agent — auto-assign a free idle agent and start
    const unassigned = db
      .prepare(
        `
        SELECT id, title, department_id
        FROM tasks
        WHERE status = 'inbox'
          AND assigned_agent_id IS NULL
          AND source_task_id IS NULL
        ORDER BY created_at ASC
        LIMIT 3
      `,
      )
      .all() as Array<{ id: string; title: string; department_id: string | null }>;

    for (const task of unassigned) {
      // Build exclusion list to avoid assigning same agent to multiple tasks this batch
      const excludeList = [...usedAgentIds];
      const excludeClause =
        excludeList.length > 0 ? `AND a.id NOT IN (${excludeList.map(() => "?").join(",")})` : "";
      const agent = db
        .prepare(
          `
          SELECT a.id, a.name, a.department_id, a.status, a.current_task_id
          FROM agents a
          WHERE a.status = 'idle'
            AND a.current_task_id IS NULL
            ${excludeClause}
          ORDER BY
            CASE WHEN a.department_id = ? THEN 0 ELSE 1 END,
            CASE WHEN a.role = 'team_leader' THEN 1 ELSE 0 END,
            a.created_at ASC
          LIMIT 1
        `,
        )
        .get(...excludeList, task.department_id) as
        | { id: string; name: string; department_id: string | null; status: string; current_task_id: string | null }
        | undefined;

      if (!agent) continue;
      usedAgentIds.add(agent.id);

      db.prepare(
        "UPDATE tasks SET assigned_agent_id = ?, status = 'planned', updated_at = ? WHERE id = ? AND status = 'inbox'",
      ).run(agent.id, now, task.id);

      const fullAgent = db.prepare("SELECT * FROM agents WHERE id = ?").get(agent.id) as
        | Record<string, unknown>
        | undefined;
      if (!fullAgent) continue;

      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id));
      appendTaskLog(task.id, "system", `inbox→planned: auto-assigned ${agent.name}`);

      const deptId = task.department_id ?? null;
      const deptName = getDeptName ? getDeptName(deptId) : (deptId ?? "Unassigned");
      console.log(`[lifecycle] starting inbox task (auto-assigned ${agent.name}): ${task.title.slice(0, 50)}`);
      startTaskExecutionForAgent(task.id, fullAgent, deptId, deptName);
    }
  }

  // Auto-start planned tasks for idle agents (batch, max 3 at a time to avoid overload)
  function startPlannedTasks(): void {
    const rows = db
      .prepare(
        `
        SELECT t.id, t.title, t.assigned_agent_id, t.department_id
        FROM tasks t
        JOIN agents a ON a.id = t.assigned_agent_id
        WHERE t.status = 'planned'
          AND a.status = 'idle'
          AND t.assigned_agent_id IS NOT NULL
        ORDER BY t.created_at ASC
        LIMIT 3
      `,
      )
      .all() as Array<{ id: string; title: string; assigned_agent_id: string; department_id: string | null }>;

    rows.forEach((row, idx) => {
      setTimeout(() => {
        const current = db.prepare("SELECT status FROM tasks WHERE id = ?").get(row.id) as
          | { status: string }
          | undefined;
        const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(row.assigned_agent_id) as
          | { status: string }
          | undefined;
        if (!current || current.status !== "planned") return;
        if (!agent || agent.status !== "idle") return;
        const deptId = row.department_id ?? null;
        const deptName = getDeptName ? getDeptName(deptId) : (deptId ?? "Unassigned");
        console.log(`[lifecycle] auto-starting planned task: ${row.title.slice(0, 50)}`);
        startTaskExecutionForAgent(row.id, agent, deptId, deptName);
      }, idx * 1200);
    });
  }

  // Recover collaborating tasks that have been stuck (no subtask activity) for too long
  function recoverOrphanCollaboratingTasks(reason: InProgressRecoveryReason): void {
    const COLLAB_GRACE_MS = 30 * 60 * 1000; // 30 minutes
    const now = nowMs();

    const collaboratingTasks = db
      .prepare(
        `SELECT id, title, assigned_agent_id, updated_at
         FROM tasks
         WHERE status = 'collaborating'
         ORDER BY updated_at ASC`,
      )
      .all() as Array<{ id: string; title: string; assigned_agent_id: string | null; updated_at: number | null }>;

    for (const task of collaboratingTasks) {
      const lastTouched = task.updated_at ?? 0;
      const ageMs = lastTouched > 0 ? Math.max(0, now - lastTouched) : COLLAB_GRACE_MS + 1;
      if (ageMs < COLLAB_GRACE_MS) continue;

      // Check for recent subtask log activity
      const recentSubActivity = db
        .prepare(
          `SELECT tl.created_at FROM task_logs tl
           JOIN subtasks s ON s.delegated_task_id = tl.task_id
           WHERE s.task_id = ? AND tl.created_at > ?
           LIMIT 1`,
        )
        .get(task.id, now - COLLAB_GRACE_MS) as { created_at: number } | undefined;
      if (recentSubActivity) continue;

      const t = nowMs();
      const moved = db
        .prepare("UPDATE tasks SET status = 'inbox', updated_at = ? WHERE id = ? AND status = 'collaborating'")
        .run(t, task.id) as { changes?: number };
      if ((moved.changes ?? 0) === 0) continue;

      clearTaskWorkflowState(task.id);
      if (task.assigned_agent_id) {
        db.prepare("UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ?").run(task.assigned_agent_id);
        broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(task.assigned_agent_id));
      }
      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id));
      const lang = resolveLang(task.title);
      const msg =
        lang === "ru"
          ? `[WATCHDOG] Задача '${task.title}' зависла в режиме collaborating (${Math.round(ageMs / 60000)} мин). Возвращено в inbox.`
          : `[WATCHDOG] '${task.title}' was stuck in collaborating (${Math.round(ageMs / 60000)}min). Recovered to inbox.`;
      notifyCeo(msg, task.id);
      appendTaskLog(task.id, "system", `Recovery (${reason}): collaborating for ${Math.round(ageMs / 60000)}min without activity → inbox`);
      console.warn(`[lifecycle] recovered collaborating task: ${task.title.slice(0, 50)}`);
    }
  }

  function sweepPendingSubtaskDelegations(): void {
    const parents = db
      .prepare(
        `
    SELECT DISTINCT t.id
    FROM tasks t
    JOIN subtasks s ON s.task_id = t.id
    WHERE t.status IN ('planned', 'collaborating', 'in_progress', 'review')
      AND s.target_department_id IS NOT NULL
      AND s.status != 'done'
      AND (s.delegated_task_id IS NULL OR s.delegated_task_id = '')
    ORDER BY t.updated_at ASC
    LIMIT 80
  `,
      )
      .all() as Array<{ id: string }>;

    for (const row of parents) {
      if (!row.id) continue;
      processSubtaskDelegations(row.id);
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-assign agent providers on startup
  // ---------------------------------------------------------------------------
  async function autoAssignAgentProviders(): Promise<void> {
    const autoAssignRow = db.prepare("SELECT value FROM settings WHERE key = 'autoAssign'").get() as
      | { value: string }
      | undefined;
    if (!autoAssignRow || autoAssignRow.value === "false") return;

    const cliStatus = (await detectAllCli()) as Record<string, { installed?: boolean; authenticated?: boolean }>;
    const authenticated = Object.entries(cliStatus)
      .filter(([, s]) => s.installed && s.authenticated)
      .map(([name]) => name);

    if (authenticated.length === 0) {
      console.log("[Claw-Empire] Auto-assign skipped: no authenticated CLI providers");
      return;
    }

    const dpRow = db.prepare("SELECT value FROM settings WHERE key = 'defaultProvider'").get() as
      | { value: string }
      | undefined;
    const defaultProv = dpRow?.value?.replace(/"/g, "") || "claude";
    const fallback = authenticated.includes(defaultProv) ? defaultProv : authenticated[0];

    const agents = db.prepare("SELECT id, name, cli_provider FROM agents").all() as Array<{
      id: string;
      name: string;
      cli_provider: string | null;
    }>;

    let count = 0;
    for (const agent of agents) {
      const prov = agent.cli_provider || "";
      if (prov === "copilot" || prov === "antigravity" || prov === "api") continue;
      if (authenticated.includes(prov)) continue;

      db.prepare("UPDATE agents SET cli_provider = ? WHERE id = ?").run(fallback, agent.id);
      broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(agent.id));
      console.log(`[Claw-Empire] Auto-assigned ${agent.name}: ${prov || "none"} → ${fallback}`);
      count++;
    }
    if (count > 0) console.log(`[Claw-Empire] Auto-assigned ${count} agent(s)`);
  }

  // Run rotation every 60 seconds, and once on startup after 5s
  setTimeout(rotateBreaks, 5_000);
  setInterval(rotateBreaks, 60_000);
  setTimeout(recoverInterruptedWorkflowOnStartup, 3_000);
  setInterval(() => recoverOrphanInProgressTasks("interval"), IN_PROGRESS_ORPHAN_SWEEP_MS);
  setInterval(() => recoverOrphanWorkingAgents("interval"), IN_PROGRESS_ORPHAN_SWEEP_MS);
  setInterval(() => recoverOrphanCollaboratingTasks("interval"), 5 * 60 * 1000);
  setTimeout(sweepPendingSubtaskDelegations, 4_000);
  setInterval(sweepPendingSubtaskDelegations, SUBTASK_DELEGATION_SWEEP_MS);
  // Auto-start inbox + planned tasks: check every 30s, initial check after 6s
  setTimeout(() => { startInboxTasks(); startPlannedTasks(); }, 6_000);
  setInterval(() => { startInboxTasks(); startPlannedTasks(); }, 30_000);
  setTimeout(autoAssignAgentProviders, 4_000);
  const telegramReceiver = startTelegramReceiver({ db });
  const discordReceiver = startDiscordReceiver({ db });

  // ---------------------------------------------------------------------------
  // Start HTTP server + WebSocket
  // ---------------------------------------------------------------------------
  const server = app.listen(PORT, HOST, () => {
    console.log(`[Claw-Empire] v${PKG_VERSION} listening on http://${HOST}:${PORT} (db: ${dbPath})`);
    if (isProduction) {
      console.log(`[Claw-Empire] mode: production (serving UI from ${distDir})`);
    } else {
      console.log(`[Claw-Empire] mode: development (UI served by Vite on separate port)`);
    }
  });

  // Background token refresh: check every 5 minutes for tokens expiring within 5 minutes
  setInterval(
    async () => {
      try {
        const cred = getDecryptedOAuthToken("google_antigravity");
        if (!cred || !cred.refreshToken) return;
        const expiresAtMs = cred.expiresAt && cred.expiresAt < 1e12 ? cred.expiresAt * 1000 : cred.expiresAt;
        if (!expiresAtMs) return;
        // Refresh if expiring within 5 minutes
        if (expiresAtMs < Date.now() + 5 * 60_000) {
          await refreshGoogleToken(cred);
          console.log("[oauth] Background refresh: Antigravity token renewed");
        }
      } catch (err) {
        console.error("[oauth] Background refresh failed:", err instanceof Error ? err.message : err);
      }
    },
    5 * 60 * 1000,
  );

  // WebSocket server on same HTTP server
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WsSocket, req: IncomingMessage) => {
    if (!isIncomingMessageOriginTrusted(req) || !isIncomingMessageAuthenticated(req)) {
      ws.close(1008, "unauthorized");
      return;
    }
    wsClients.add(ws);
    console.log(`[Claw-Empire] WebSocket client connected (total: ${wsClients.size})`);

    // Send initial state to the newly connected client
    ws.send(
      JSON.stringify({
        type: "connected",
        payload: {
          version: PKG_VERSION,
          app: "Claw-Empire",
        },
        ts: nowMs(),
      }),
    );

    ws.on("close", () => {
      wsClients.delete(ws);
      console.log(`[Claw-Empire] WebSocket client disconnected (total: ${wsClients.size})`);
    });

    ws.on("error", () => {
      wsClients.delete(ws);
    });
  });

  registerGracefulShutdownHandlers({
    activeProcesses,
    stopRequestedTasks,
    killPidTree,
    rollbackTaskWorktree,
    db,
    nowMs,
    endTaskExecutionSession,
    wsClients,
    wss,
    server,
    onBeforeClose: () => {
      telegramReceiver.stop();
      discordReceiver.stop();
    },
  });
}
