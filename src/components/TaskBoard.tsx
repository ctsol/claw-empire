import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bulkHideTasks, getProjects } from "../api";
import { useI18n } from "../i18n";
import type { Agent, Department, Project, SubTask, Task, WorkflowPackKey } from "../types";
import ProjectManagerModal from "./ProjectManagerModal";
import BulkHideModal from "./taskboard/BulkHideModal";
import CreateTaskModal from "./taskboard/CreateTaskModal";
import FilterBar from "./taskboard/FilterBar";
import TaskCard from "./taskboard/TaskCard";
import { COLUMNS, isHideableStatus, taskStatusLabel, type HideableStatus } from "./taskboard/constants";

interface TaskBoardProps {
  tasks: Task[];
  agents: Agent[];
  departments: Department[];
  subtasks: SubTask[];
  onCreateTask: (input: {
    title: string;
    description?: string;
    department_id?: string;
    task_type?: string;
    priority?: number;
    project_id?: string;
    project_path?: string;
    assigned_agent_id?: string;
    workflow_pack_key?: WorkflowPackKey;
  }) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAssignTask: (taskId: string, agentId: string) => void;
  onRunTask: (id: string) => void;
  onStopTask: (id: string) => void;
  onPauseTask?: (id: string) => void;
  onResumeTask?: (id: string) => void;
  onOpenTerminal?: (taskId: string) => void;
  onOpenMeetingMinutes?: (taskId: string) => void;
  onMergeTask?: (id: string) => void;
  onDiscardTask?: (id: string) => void;
}

export function TaskBoard({
  tasks,
  agents,
  departments,
  subtasks,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onAssignTask,
  onRunTask,
  onStopTask,
  onPauseTask,
  onResumeTask,
  onOpenTerminal,
  onOpenMeetingMinutes,
  onMergeTask,
  onDiscardTask,
}: TaskBoardProps) {
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showBulkHideModal, setShowBulkHideModal] = useState(false);
  const [filterDept, setFilterDept] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const dragTaskIdRef = useRef<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const hiddenTaskIds = useMemo(
    () => new Set(tasks.filter((task) => task.hidden === 1).map((task) => task.id)),
    [tasks],
  );

  const hideTask = useCallback(
    (taskId: string) => {
      onUpdateTask(taskId, { hidden: 1 });
    },
    [onUpdateTask],
  );

  const unhideTask = useCallback(
    (taskId: string) => {
      onUpdateTask(taskId, { hidden: 0 });
    },
    [onUpdateTask],
  );

  useEffect(() => {
    getProjects({ page_size: 200 }).then((res) => setProjects(res.projects ?? [])).catch(() => {});
  }, []);

  const hideByStatuses = useCallback((statuses: HideableStatus[]) => {
    if (statuses.length === 0) return;
    bulkHideTasks(statuses, 1);
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterDept && task.department_id !== filterDept) return false;
      if (filterAgent && task.assigned_agent_id !== filterAgent) return false;
      if (filterType && task.task_type !== filterType) return false;
      if (filterProject && task.project_id !== filterProject) return false;
      if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
      const isHidden = hiddenTaskIds.has(task.id);
      if (!showAllTasks && isHidden) return false;
      return true;
    });
  }, [tasks, filterDept, filterAgent, filterType, search, hiddenTaskIds, showAllTasks]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    for (const column of COLUMNS) {
      grouped[column.status] = filteredTasks
        .filter((task) => task.status === column.status)
        .sort((a, b) => b.priority - a.priority || b.created_at - a.created_at);
    }
    return grouped;
  }, [filteredTasks]);

  const subtasksByTask = useMemo(() => {
    const grouped: Record<string, SubTask[]> = {};
    for (const subtask of subtasks) {
      if (!grouped[subtask.task_id]) grouped[subtask.task_id] = [];
      grouped[subtask.task_id].push(subtask);
    }
    return grouped;
  }, [subtasks]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    dragTaskIdRef.current = taskId;
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, status: string) => {
      e.preventDefault();
      const taskId = dragTaskIdRef.current || e.dataTransfer.getData("text/plain");
      if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (task && task.status !== status) {
          onUpdateTask(taskId, { status: status as Task["status"] });
        }
      }
      dragTaskIdRef.current = null;
      setDragTaskId(null);
      setDragOverColumn(null);
    },
    [tasks, onUpdateTask],
  );

  const handleDragEnd = useCallback(() => {
    dragTaskIdRef.current = null;
    setDragTaskId(null);
    setDragOverColumn(null);
  }, []);

  const activeFilterCount = [filterDept, filterAgent, filterType, filterProject, search].filter(Boolean).length;
  const hiddenTaskCount = useMemo(() => {
    let count = 0;
    for (const task of tasks) {
      if (isHideableStatus(task.status) && hiddenTaskIds.has(task.id)) count++;
    }
    return count;
  }, [tasks, hiddenTaskIds]);

  return (
    <div className="taskboard-shell flex h-full flex-col gap-4 bg-slate-950 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-white">
          {t({ ko: "업무 보드", en: "Task Board", ja: "タスクボード", zh: "任务看板", ru: "Доска задач" })}
        </h1>
        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
          {t({ ko: "총", en: "Total", ja: "合計", zh: "总计", ru: "Итого" })} {filteredTasks.length}
          {t({ ko: "개", en: "", ja: "件", zh: "项", ru: "" })}
          {activeFilterCount > 0 &&
            ` (${t({ ko: "필터", en: "filters", ja: "フィルター", zh: "筛选器", ru: "фильтров" })} ${activeFilterCount}${t({
              ko: "개 적용",
              en: " applied",
              ja: "件適用",
              zh: "个已应用",
              ru: " применено",
            })})`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setFilterDept("");
                setFilterAgent("");
                setFilterType("");
                setFilterProject("");
                setSearch("");
              }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              {t({ ko: "필터 초기화", en: "Reset Filters", ja: "フィルターをリセット", zh: "重置筛选", ru: "Сбросить фильтры" })}
            </button>
          )}
          <button
            onClick={() => setShowAllTasks((prev) => !prev)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
              showAllTasks
                ? "border-cyan-600 bg-cyan-900/40 text-cyan-100 hover:bg-cyan-900/60"
                : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title={
              showAllTasks
                ? t({
                    ko: "진행중 보기로 전환 (숨김 제외)",
                    en: "Switch to active view (exclude hidden)",
                    ja: "進行中表示へ切替（非表示を除外）",
                    zh: "切换到进行中视图（排除隐藏）",
                    ru: "Переключить на активные (скрытые исключены)",
                  })
                : t({
                    ko: "모두보기로 전환 (숨김 포함)",
                    en: "Switch to all view (include hidden)",
                    ja: "全体表示へ切替（非表示を含む）",
                    zh: "切换到全部视图（包含隐藏）",
                    ru: "Переключить на все (включая скрытые)",
                  })
            }
          >
            <span className={showAllTasks ? "text-slate-400" : "text-emerald-200"}>
              {t({ ko: "진행중", en: "Active", ja: "進行中", zh: "进行中", ru: "Активные" })}
            </span>
            <span className="mx-1 text-slate-500">/</span>
            <span className={showAllTasks ? "text-cyan-100" : "text-slate-500"}>
              {t({ ko: "모두보기", en: "All", ja: "すべて", zh: "全部", ru: "Все" })}
            </span>
            <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
              {hiddenTaskCount}
            </span>
          </button>
          <button
            onClick={() => setShowBulkHideModal(true)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
            title={t({
              ko: "완료/보류/취소 상태 업무 숨기기",
              en: "Hide done/pending/cancelled tasks",
              ja: "完了/保留/キャンセル状態を非表示",
              zh: "隐藏完成/待处理/已取消任务",
              ru: "Скрыть выполненные/отложенные/отменённые задачи",
            })}
          >
            🙈 {t({ ko: "숨김", en: "Hide", ja: "非表示", zh: "隐藏", ru: "Скрыть" })}
          </button>
          <button
            onClick={() => setShowProjectManager(true)}
            className="taskboard-project-manage-btn rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
          >
            🗂 {t({ ko: "프로젝트 관리", en: "Project Manager", ja: "プロジェクト管理", zh: "项目管理", ru: "Управление проектами" })}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500 active:scale-95"
          >
            + {t({ ko: "새 업무", en: "New Task", ja: "新規タスク", zh: "新建任务", ru: "Новая задача" })}
          </button>
        </div>
      </div>

      <FilterBar
        agents={agents}
        departments={departments}
        projects={projects}
        filterDept={filterDept}
        filterAgent={filterAgent}
        filterType={filterType}
        filterProject={filterProject}
        search={search}
        onFilterDept={setFilterDept}
        onFilterAgent={setFilterAgent}
        onFilterType={setFilterType}
        onFilterProject={setFilterProject}
        onSearch={setSearch}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-2 sm:flex-row sm:overflow-x-auto sm:overflow-y-hidden" onDragEnd={handleDragEnd}>
        {COLUMNS.map((column) => {
          const columnTasks = tasksByStatus[column.status] ?? [];
          return (
            <div
              key={column.status}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDrop={(e) => handleDrop(e, column.status)}
              onDragLeave={(e) => {
                // Only clear if leaving the column entirely (not entering a child)
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverColumn(null);
                }
              }}
              className={`taskboard-column flex w-full flex-col rounded-xl border sm:w-72 sm:flex-shrink-0 transition-colors ${
                dragOverColumn === column.status && dragTaskId
                  ? "border-blue-500 bg-blue-950/40"
                  : `${column.borderColor} bg-slate-900`
              }`}
            >
              <div className={`flex items-center justify-between rounded-t-xl ${column.headerBg} px-3.5 py-2.5`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${column.dotColor}`} />
                  <span className="text-sm font-semibold text-white">
                    {column.icon} {taskStatusLabel(column.status, t)}
                  </span>
                </div>
                <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs font-bold text-white/80">
                  {columnTasks.length}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 p-2.5 sm:flex-1 sm:overflow-y-auto">
                {dragOverColumn === column.status && dragTaskId && (
                  <div className="rounded-xl border-2 border-dashed border-blue-500/60 bg-blue-500/10 h-12 flex items-center justify-center text-xs text-blue-400 animate-pulse">
                    {t({ ko: "여기에 놓기", en: "Drop here", ja: "ここにドロップ", zh: "放置到此处", ru: "Опустить сюда" })}
                  </div>
                )}
                {columnTasks.length === 0 ? (
                  <div className="flex min-h-24 items-center justify-center py-8 text-xs text-slate-600 sm:flex-1">
                    {t({ ko: "업무 없음", en: "No tasks", ja: "タスクなし", zh: "暂无任务", ru: "Нет задач" })}
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agents={agents}
                      departments={departments}
                      projects={projects}
                      taskSubtasks={subtasksByTask[task.id] ?? []}
                      isHiddenTask={hiddenTaskIds.has(task.id)}
                      isDragging={dragTaskId === task.id}
                      onUpdateTask={onUpdateTask}
                      onDeleteTask={onDeleteTask}
                      onAssignTask={onAssignTask}
                      onRunTask={onRunTask}
                      onStopTask={onStopTask}
                      onPauseTask={onPauseTask}
                      onResumeTask={onResumeTask}
                      onOpenTerminal={onOpenTerminal}
                      onOpenMeetingMinutes={onOpenMeetingMinutes}
                      onMergeTask={onMergeTask}
                      onDiscardTask={onDiscardTask}
                      onHideTask={hideTask}
                      onUnhideTask={unhideTask}
                      onDragStart={handleDragStart}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreateTaskModal
          agents={agents}
          departments={departments}
          onClose={() => setShowCreate(false)}
          onCreate={onCreateTask}
          onAssign={onAssignTask}
        />
      )}

      {showProjectManager && (
        <ProjectManagerModal agents={agents} departments={departments} onClose={() => setShowProjectManager(false)} />
      )}

      {showBulkHideModal && (
        <BulkHideModal
          tasks={tasks}
          hiddenTaskIds={hiddenTaskIds}
          onClose={() => setShowBulkHideModal(false)}
          onApply={(statuses) => {
            hideByStatuses(statuses);
            setShowBulkHideModal(false);
          }}
        />
      )}
    </div>
  );
}

export default TaskBoard;
