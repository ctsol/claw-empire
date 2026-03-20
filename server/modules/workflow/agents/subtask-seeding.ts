import { randomUUID } from "node:crypto";
import type { Lang } from "../../../types/lang.ts";
import { resolveConstrainedAgentScopeForTask } from "../../routes/core/tasks/execution-run-auto-assign.ts";

type SubtaskSeedingDeps = {
  db: any;
  nowMs: () => number;
  broadcast: (event: string, payload: unknown) => void;
  analyzeSubtaskDepartment: (title: string, parentDeptId: string | null) => string | null;
  rerouteSubtasksByPlanningLeader: (
    taskId: string,
    ownerDeptId: string | null,
    phase: "planned" | "review",
  ) => Promise<void>;
  findTeamLeader: (departmentId: string, candidateAgentIds?: string[] | null) => any;
  getDeptName: (departmentId: string, workflowPackKey?: string | null) => string;
  getPreferredLanguage: () => Lang;
  resolveLang: (text: string) => Lang;
  l: (ko: string[], en: string[], ja: string[], zh: string[], ru?: string[]) => any;
  pickL: (choices: any, lang: string) => string;
  appendTaskLog: (taskId: string | null, kind: string, message: string) => void;
  notifyCeo: (message: string, taskId: string | null, messageType?: string) => void;
};

export function createSubtaskSeedingTools(deps: SubtaskSeedingDeps) {
  const {
    db,
    nowMs,
    broadcast,
    analyzeSubtaskDepartment,
    rerouteSubtasksByPlanningLeader,
    findTeamLeader,
    getDeptName,
    getPreferredLanguage,
    resolveLang,
    l,
    pickL,
    appendTaskLog,
    notifyCeo,
  } = deps;

  function createSubtaskFromCli(taskId: string, toolUseId: string, title: string): void {
    const subId = randomUUID();
    const parentAgent = db.prepare("SELECT assigned_agent_id FROM tasks WHERE id = ?").get(taskId) as
      | { assigned_agent_id: string | null }
      | undefined;

    db.prepare(
      `
    INSERT INTO subtasks (id, task_id, title, status, assigned_agent_id, cli_tool_use_id, created_at)
    VALUES (?, ?, ?, 'in_progress', ?, ?, ?)
  `,
    ).run(subId, taskId, title, parentAgent?.assigned_agent_id ?? null, toolUseId, nowMs());

    // Detect if this subtask belongs to a foreign department
    const parentTaskDept = db.prepare("SELECT department_id, workflow_pack_key FROM tasks WHERE id = ?").get(taskId) as
      | { department_id: string | null; workflow_pack_key: string | null }
      | undefined;
    const targetDeptId = analyzeSubtaskDepartment(title, parentTaskDept?.department_id ?? null);

    if (targetDeptId) {
      const targetDeptName = getDeptName(targetDeptId, parentTaskDept?.workflow_pack_key ?? null);
      const lang = getPreferredLanguage();
      const blockedReason = pickL(
        l(
          [``],
          [`Waiting for ${targetDeptName} collaboration`],
          [`${targetDeptName}の協業待ち`],
          [`等待${targetDeptName}协作`],
        ),
        lang,
      );
      db.prepare(
        "UPDATE subtasks SET target_department_id = ?, status = 'blocked', blocked_reason = ? WHERE id = ?",
      ).run(targetDeptId, blockedReason, subId);
    }

    const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(subId);
    broadcast("subtask_update", subtask);
  }

  function completeSubtaskFromCli(toolUseId: string): void {
    const existing = db.prepare("SELECT id, status FROM subtasks WHERE cli_tool_use_id = ?").get(toolUseId) as
      | { id: string; status: string }
      | undefined;
    if (!existing || existing.status === "done") return;

    db.prepare("UPDATE subtasks SET status = 'done', completed_at = ? WHERE id = ?").run(nowMs(), existing.id);

    const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(existing.id);
    broadcast("subtask_update", subtask);
  }

  function seedApprovedPlanSubtasks(taskId: string, ownerDeptId: string | null, planningNotes: string[] = []): void {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM subtasks WHERE task_id = ?").get(taskId) as {
      cnt: number;
    };
    if (existing.cnt > 0) return;

    const task = db
      .prepare(
        "SELECT title, description, assigned_agent_id, department_id, project_id, workflow_pack_key FROM tasks WHERE id = ?",
      )
      .get(taskId) as
      | {
          title: string;
          description: string | null;
          assigned_agent_id: string | null;
          department_id: string | null;
          project_id: string | null;
          workflow_pack_key: string | null;
        }
      | undefined;
    if (!task) return;

    const baseDeptId = ownerDeptId ?? task.department_id;
    const lang = resolveLang(task.description ?? task.title);
    const constrainedAgentIds = resolveConstrainedAgentScopeForTask(db as any, {
      project_id: task.project_id,
      workflow_pack_key: task.workflow_pack_key,
      department_id: baseDeptId,
    });

    const now = nowMs();
    const baseAssignee = task.assigned_agent_id;
    const uniquePlanNotes: string[] = [];
    const planSeen = new Set<string>();
    for (const note of planningNotes) {
      const normalized = note.replace(/\s+/g, " ").trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (planSeen.has(key)) continue;
      planSeen.add(key);
      uniquePlanNotes.push(normalized);
      if (uniquePlanNotes.length >= 8) break;
    }

    const items: Array<{
      title: string;
      description: string;
      status: "pending" | "blocked";
      assignedAgentId: string | null;
      blockedReason: string | null;
      targetDepartmentId: string | null;
    }> = [
      {
        title: pickL(
          l(
            ["Planned"],
            ["Finalize detailed execution plan from planned meeting"],
            ["Planned会議の詳細実行計画を確定"],
            ["确定 Planned 会议的详细执行计划"],
          ),
          lang,
        ),
        description: pickL(
          l(
            [``],
            [`Finalize detailed task sequence and deliverable criteria from the planned meeting. (${task.title})`],
            [`Planned会議を基準に、詳細な作業順序と成果物基準を確定します。(${task.title})`],
            [`基于 Planned 会议，确定详细任务顺序与交付物标准。（${task.title}）`],
          ),
          lang,
        ),
        status: "pending",
        assignedAgentId: baseAssignee,
        blockedReason: null,
        targetDepartmentId: null,
      },
    ];
    const noteDetectedDeptSet = new Set<string>();

    for (const note of uniquePlanNotes) {
      const detail = note.replace(/^[\s\-*0-9.)]+/, "").trim();
      if (!detail) continue;
      const afterColon = detail.includes(":") ? detail.split(":").slice(1).join(":").trim() : detail;
      const titleCore = (afterColon || detail).slice(0, 56).trim();
      const clippedTitle = titleCore.length > 54 ? `${titleCore.slice(0, 53).trimEnd()}…` : titleCore;
      const targetDeptId = analyzeSubtaskDepartment(detail, baseDeptId);
      const targetDeptName = targetDeptId ? getDeptName(targetDeptId, task.workflow_pack_key ?? null) : "";
      const targetLeader = targetDeptId ? findTeamLeader(targetDeptId, constrainedAgentIds) : null;
      if (targetDeptId && targetDeptId !== baseDeptId) {
        noteDetectedDeptSet.add(targetDeptId);
      }

      items.push({
        title: pickL(
          l(
            [``],
            [`[Plan Item] ${clippedTitle || "Additional improvement item"}`],
            [`[補完計画] ${clippedTitle || "追加補完項目"}`],
            [`[计划项] ${clippedTitle || "补充改进事项"}`],
          ),
          lang,
        ),
        description: pickL(
          l(
            [``],
            [`Convert this planned-meeting improvement note into an executable task: ${detail}`],
            [`Planned会議の補完項目を実行計画へ反映します: ${detail}`],
            [`将 Planned 会议补充项转为可执行任务：${detail}`],
          ),
          lang,
        ),
        status: targetDeptId ? "blocked" : "pending",
        assignedAgentId: targetDeptId ? (targetLeader?.id ?? null) : baseAssignee,
        blockedReason: targetDeptId
          ? pickL(
              l(
                [``],
                [`Waiting for ${targetDeptName} collaboration`],
                [`${targetDeptName}の協業待ち`],
                [`等待${targetDeptName}协作`],
              ),
              lang,
            )
          : null,
        targetDepartmentId: targetDeptId,
      });
    }

    const relatedDepts = [...noteDetectedDeptSet];
    for (const deptId of relatedDepts) {
      const deptName = getDeptName(deptId, task.workflow_pack_key ?? null);
      const crossLeader = findTeamLeader(deptId, constrainedAgentIds);
      items.push({
        title: pickL(
          l(
            [``],
            [`[Collaboration] Produce ${deptName} deliverable`],
            [`[協業] ${deptName}成果物を作成`],
            [`[协作] 编写${deptName}交付物`],
          ),
          lang,
        ),
        description: pickL(
          l(
            [``],
            [`Create and share the ${deptName}-owned deliverable based on the planned meeting.`],
            [`Planned会議を基準に、${deptName}担当の成果物を作成・共有します。`],
            [`基于 Planned 会议，完成并共享${deptName}负责的交付物。`],
          ),
          lang,
        ),
        status: "blocked",
        assignedAgentId: crossLeader?.id ?? null,
        blockedReason: pickL(
          l(
            [``],
            [`Waiting for ${deptName} collaboration`],
            [`${deptName}の協業待ち`],
            [`等待${deptName}协作`],
          ),
          lang,
        ),
        targetDepartmentId: deptId,
      });
    }

    items.push({
      title: pickL(
        l(
          [""],
          ["Consolidate department deliverables and finalize package"],
          ["部門成果物の統合と最終整理"],
          ["整合部门交付物并完成最终整理"],
        ),
        lang,
      ),
      description: pickL(
        l(
          ["Review  ."],
          ["Collect related-department outputs, merge into one package, and prepare the review submission."],
          ["関連部門の成果物を集約して単一成果物へ統合し、レビュー提出版を準備します。"],
          ["汇总相关部门产出，整合为单一成果，并准备 Review 提交版本。"],
        ),
        lang,
      ),
      status: "pending",
      assignedAgentId: baseAssignee,
      blockedReason: null,
      targetDepartmentId: null,
    });

    // Add final video rendering subtask for video_preprod pack
    if (task.workflow_pack_key === "video_preprod") {
      const devLeader = findTeamLeader("dev", constrainedAgentIds);
      const devDeptName = getDeptName("dev", task.workflow_pack_key ?? null);
      items.push({
        title: "[VIDEO_FINAL_RENDER]",
        description: [
          "[VIDEO_FINAL_RENDER]",
          `Parent task: ${task.title}`,
          "/      1 .",
          "Remotion . Python(moviepy/Pillow)   .",
          "(project_department_final.mp4) ,   /  .",
          "",
          "[QUALITY]",
          "-   55~65, 8~12",
          "-  2~4 /",
          "-   3  ,  (//)",
          "- / safe area( 8%,  10%)",
          "-   \\n/\\t//     (  )",
          "-",
        ].join("\n"),
        status: "blocked",
        assignedAgentId: devLeader?.id ?? null,
        blockedReason: pickL(
          l(
            [``],
            [`Waiting for ${devDeptName} collaboration`],
            [`${devDeptName}の協業待ち`],
            [`等待${devDeptName}协作`],
          ),
          lang,
        ),
        targetDepartmentId: "dev",
      });
    }

    for (const st of items) {
      const sid = randomUUID();
      db.prepare(
        `
      INSERT INTO subtasks (id, task_id, title, description, status, assigned_agent_id, blocked_reason, target_department_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      ).run(
        sid,
        taskId,
        st.title,
        st.description,
        st.status,
        st.assignedAgentId,
        st.blockedReason,
        st.targetDepartmentId,
        now,
      );
      broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(sid));
    }

    appendTaskLog(
      taskId,
      "system",
      `Planned meeting seeded ${items.length} subtasks (plan-notes: ${uniquePlanNotes.length}, cross-dept: ${relatedDepts.length})`,
    );
    notifyCeo(
      pickL(
        l(
          [
            ``,
          ],
          [
            `Created ${items.length} subtasks from the planned-meeting output for '${task.title}' and assigned owners/cross-department collaboration.`,
          ],
          [
            `'${task.title}' のPlanned会議結果を基準に SubTask を${items.length}件作成し、担当者と関連部門協業を割り当てました。`,
          ],
          [`已基于'${task.title}'的 Planned 会议结果创建${items.length}个 SubTask，并分配负责人及跨部门协作。`],
        ),
        lang,
      ),
      taskId,
    );

    void rerouteSubtasksByPlanningLeader(taskId, baseDeptId, "planned");
  }

  function seedReviewRevisionSubtasks(
    taskId: string,
    ownerDeptId: string | null,
    revisionNotes: string[] = [],
  ): number {
    const task = db
      .prepare(
        "SELECT title, description, assigned_agent_id, department_id, project_id, workflow_pack_key FROM tasks WHERE id = ?",
      )
      .get(taskId) as
      | {
          title: string;
          description: string | null;
          assigned_agent_id: string | null;
          department_id: string | null;
          project_id: string | null;
          workflow_pack_key: string | null;
        }
      | undefined;
    if (!task) return 0;

    const baseDeptId = ownerDeptId ?? task.department_id;
    const baseAssignee = task.assigned_agent_id;
    const lang = resolveLang(task.description ?? task.title);
    const constrainedAgentIds = resolveConstrainedAgentScopeForTask(db as any, {
      project_id: task.project_id,
      workflow_pack_key: task.workflow_pack_key,
      department_id: baseDeptId,
    });
    const now = nowMs();
    const uniqueNotes: string[] = [];
    const seen = new Set<string>();
    for (const note of revisionNotes) {
      const cleaned = note.replace(/\s+/g, " ").trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueNotes.push(cleaned);
      if (uniqueNotes.length >= 8) break;
    }

    const items: Array<{
      title: string;
      description: string;
      status: "pending" | "blocked";
      assignedAgentId: string | null;
      blockedReason: string | null;
      targetDepartmentId: string | null;
    }> = [];

    for (const note of uniqueNotes) {
      const detail = note.replace(/^[\s\-*0-9.)]+/, "").trim();
      if (!detail) continue;
      const afterColon = detail.includes(":") ? detail.split(":").slice(1).join(":").trim() : detail;
      const titleCore = (afterColon || detail).slice(0, 56).trim();
      const clippedTitle = titleCore.length > 54 ? `${titleCore.slice(0, 53).trimEnd()}…` : titleCore;
      const targetDeptId = analyzeSubtaskDepartment(detail, baseDeptId);
      const targetDeptName = targetDeptId ? getDeptName(targetDeptId, task.workflow_pack_key ?? null) : "";
      const targetLeader = targetDeptId ? findTeamLeader(targetDeptId, constrainedAgentIds) : null;

      items.push({
        title: pickL(
          l(
            [``],
            [`[Review Revision] ${clippedTitle || "Additional revision item"}`],
            [`[レビュー補完] ${clippedTitle || "追加補完項目"}`],
            [`[评审整改] ${clippedTitle || "补充整改事项"}`],
          ),
          lang,
        ),
        description: pickL(
          l(
            [``],
            [`Apply the review-meeting revision request: ${detail}`],
            [`Review会議で要請された補完項目を反映します: ${detail}`],
            [`落实 Review 会议提出的整改项：${detail}`],
          ),
          lang,
        ),
        status: targetDeptId ? "blocked" : "pending",
        assignedAgentId: targetDeptId ? (targetLeader?.id ?? null) : baseAssignee,
        blockedReason: targetDeptId
          ? pickL(
              l(
                [``],
                [`Waiting for ${targetDeptName} collaboration`],
                [`${targetDeptName}の協業待ち`],
                [`等待${targetDeptName}协作`],
              ),
              lang,
            )
          : null,
        targetDepartmentId: targetDeptId,
      });
    }

    items.push({
      title: pickL(
        l(
          ["[]"],
          ["[Review Revision] Consolidate updates and resubmit for review"],
          ["[レビュー補完] 反映結果を統合し再レビュー提出"],
          ["[评审整改] 整合更新并重新提交评审"],
        ),
        lang,
      ),
      description: pickL(
        l(
          ["."],
          ["Collect revision outputs and prepare the re-review submission package."],
          ["補完反映の成果を集約し、再レビュー提出版を整えます。"],
          ["汇总整改结果并整理重新评审提交包。"],
        ),
        lang,
      ),
      status: "pending",
      assignedAgentId: baseAssignee,
      blockedReason: null,
      targetDepartmentId: null,
    });

    const hasOpenSubtask = db.prepare(
      "SELECT 1 FROM subtasks WHERE task_id = ? AND title = ? AND status != 'done' LIMIT 1",
    );
    const insertSubtask = db.prepare(`
    INSERT INTO subtasks (id, task_id, title, description, status, assigned_agent_id, blocked_reason, target_department_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    let created = 0;
    for (const st of items) {
      const exists = hasOpenSubtask.get(taskId, st.title) as { 1: number } | undefined;
      if (exists) continue;
      const sid = randomUUID();
      insertSubtask.run(
        sid,
        taskId,
        st.title,
        st.description,
        st.status,
        st.assignedAgentId,
        st.blockedReason,
        st.targetDepartmentId,
        now,
      );
      created++;
      broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(sid));
    }

    if (created > 0) {
      void rerouteSubtasksByPlanningLeader(taskId, baseDeptId, "review");
    }

    return created;
  }

  return {
    createSubtaskFromCli,
    completeSubtaskFromCli,
    seedApprovedPlanSubtasks,
    seedReviewRevisionSubtasks,
  };
}
