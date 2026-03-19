import { useRef, forwardRef, useImperativeHandle } from "react";
import type { Agent, Task } from "../../types";
import type { UiLanguage } from "../../i18n";
import type { LangText } from "../../i18n";

type TFunction = (messages: LangText) => string;

interface RecentTasksPanelProps {
  tasks: Task[];
  agents: Agent[];
  language: UiLanguage;
  t: TFunction;
  onTaskRef?: (taskId: string, el: HTMLDivElement | null) => void;
}

export interface RecentTasksPanelHandle {
  getTaskEl: (taskId: string) => HTMLDivElement | null;
}

const STATUS_COLORS: Record<string, string> = {
  inbox: "bg-slate-500/20 text-slate-400",
  planned: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-emerald-500/20 text-emerald-400",
  review: "bg-amber-500/20 text-amber-400",
  done: "bg-green-500/20 text-green-400",
  cancelled: "bg-slate-500/20 text-slate-500",
};

function statusLabel(status: string, t: TFunction): string {
  const labels: Record<string, LangText> = {
    inbox: { ko: "접수", en: "Inbox", ja: "受信", zh: "收件", ru: "Входящие" },
    planned: { ko: "계획", en: "Planned", ja: "計画", zh: "计划", ru: "Планируется" },
    in_progress: { ko: "진행", en: "In Progress", ja: "進行中", zh: "进行中", ru: "В работе" },
    review: { ko: "검토", en: "Review", ja: "レビュー", zh: "评审", ru: "Проверка" },
    done: { ko: "완료", en: "Done", ja: "完了", zh: "完成", ru: "Готово" },
    cancelled: { ko: "취소", en: "Cancelled", ja: "取消", zh: "取消", ru: "Отменено" },
  };
  return labels[status] ? t(labels[status]) : status;
}

const RecentTasksPanel = forwardRef<RecentTasksPanelHandle, RecentTasksPanelProps>(
  ({ tasks, agents, t, onTaskRef }, ref) => {
    const taskElsRef = useRef<Map<string, HTMLDivElement>>(new Map());

    useImperativeHandle(ref, () => ({
      getTaskEl: (taskId: string) => taskElsRef.current.get(taskId) ?? null,
    }));

    const STATUS_ORDER: Record<string, number> = { inbox: 0, planned: 1, review: 2, in_progress: 9 };
    const recent = [...tasks]
      .filter((t) => t.status !== "cancelled" && t.status !== "done" && !t.source_task_id)
      .sort((a, b) => {
        const ao = STATUS_ORDER[a.status] ?? 9;
        const bo = STATUS_ORDER[b.status] ?? 9;
        if (ao !== bo) return ao - bo;
        return (b.updated_at ?? 0) - (a.updated_at ?? 0);
      });

    const getAgent = (id: string | null) => id ? agents.find((a) => a.id === id) : undefined;

    if (recent.length === 0) return null;

    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-4 backdrop-blur-sm h-full flex flex-col">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-violet-400">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-slate-200">
            {t({ ko: "최근 작업", en: "Recent Tasks", ja: "最近のタスク", zh: "最近任务", ru: "Последние задачи" })}
          </h3>
          <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
            {recent.length}
          </span>
        </div>
        <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0">
          {recent.map((task) => {
            const agent = getAgent(task.assigned_agent_id);
            const color = STATUS_COLORS[task.status] ?? "bg-slate-500/20 text-slate-400";
            return (
              <div
                key={task.id}
                ref={(el) => {
                  if (el) {
                    taskElsRef.current.set(task.id, el);
                    onTaskRef?.(task.id, el);
                  } else {
                    taskElsRef.current.delete(task.id);
                    onTaskRef?.(task.id, null);
                  }
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-800/60"
              >
                {/* Agent avatar emoji */}
                <span className="text-base w-5 text-center flex-shrink-0">
                  {agent?.avatar_emoji ?? "🤖"}
                </span>
                {/* Title */}
                <span className="flex-1 min-w-0 text-[11px] text-slate-300 truncate" title={task.title}>
                  {task.title}
                </span>
                {/* Status badge */}
                <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${color}`}>
                  {statusLabel(task.status, t)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

RecentTasksPanel.displayName = "RecentTasksPanel";
export default RecentTasksPanel;
