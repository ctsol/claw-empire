type ChatMode = "chat" | "task" | "announcement" | "report" | "btw";

type Tr = (ko: string, en: string, ja?: string, zh?: string, ru?: string) => string;

interface ChatModeHintProps {
  mode: ChatMode;
  isDirectiveMode: boolean;
  tr: Tr;
}

export default function ChatModeHint({ mode, isDirectiveMode, tr }: ChatModeHintProps) {
  if (mode === "chat" && !isDirectiveMode) return null;

  return (
    <div className="px-4 py-1 flex-shrink-0">
      {isDirectiveMode ? (
        <p className="text-xs text-red-400 font-medium">
          {tr(
            "—",
            "Directive mode - Planning team auto-coordinates",
            "業務指示モード — 企画チームが自動的に主管します",
            "业务指示模式 — 企划组自动主管",
            "Режим директивы — команда планирования координирует автоматически",
          )}
        </p>
      ) : (
        <>
          {mode === "task" && (
            <p className="text-xs text-blue-400">
              📋{" "}
              {tr(
                "—",
                "Task mode - assign work to the agent",
                "タスク指示モード — エージェントに作業を割り当てます",
                "任务指示模式 — 向代理分配工作",
                "Режим задачи — назначить работу агенту",
              )}
            </p>
          )}
          {mode === "announcement" && (
            <p className="text-xs text-yellow-400">
              📢{" "}
              {tr(
                "—",
                "Announcement mode - sent to all agents",
                "全体告知モード — すべてのエージェントに送信",
                "全员公告模式 — 将发送给所有代理",
                "Режим объявления — отправляется всем агентам",
              )}
            </p>
          )}
          {mode === "report" && (
            <p className="text-xs text-emerald-400">
              📊{" "}
              {tr(
                "— /",
                "Report mode - request report/deck authoring",
                "レポート依頼モード — レポート/資料作成を依頼します",
                "报告请求模式 — 请求撰写报告/演示资料",
                "Режим отчёта — запрос на составление отчёта/презентации",
              )}
            </p>
          )}
          {mode === "btw" && (
            <p className="text-xs text-purple-400">
              💬{" "}
              {tr(
                "—",
                "Quick ask mode — agent answers instantly, no task created",
                "クイック質問モード — エージェントがすぐに答えます",
                "快速提问模式 — 代理即时回答，不创建任务",
                "Режим быстрого вопроса — агент отвечает без создания задачи",
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
