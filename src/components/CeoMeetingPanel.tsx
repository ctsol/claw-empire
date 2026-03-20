import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "../i18n";
import { getProjects } from "../api";
import type { Project } from "../types";

type MeetingMode = "reporting" | "planning";
type MeetingState = "idle" | "running" | "waiting_ceo" | "ready" | "done";

interface MeetingParticipant {
  id: string;
  name: string;
  emoji: string;
  role: string;
  departmentId: string;
  departmentName: string;
}

interface MeetingMessage {
  id: string;
  role: "ceo" | "agent" | "system";
  agentId?: string;
  agentName?: string;
  agentEmoji?: string;
  content: string;
  options?: string[];
  timestamp: number;
}

interface CeoMeetingPanelProps {
  onBack: () => void;
  lang: string;
}

export default function CeoMeetingPanel({ onBack, lang }: CeoMeetingPanelProps) {
  const { t } = useI18n();

  const [mode, setMode] = useState<MeetingMode>("planning");
  const [topic, setTopic] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [meetingState, setMeetingState] = useState<MeetingState>("idle");
  const [round, setRound] = useState(0);
  const [tasksCreated, setTasksCreated] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [createTasksError, setCreateTasksError] = useState<string | null>(null);
  // Multi-select: per message ID → Set of selected options; sentMessages = already submitted
  const [selectedOptions, setSelectedOptions] = useState<Map<string, Set<string>>>(new Map());
  const [sentMessages, setSentMessages] = useState<Set<string>>(new Set());
  const [pendingMessageIds, setPendingMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    getProjects({ page_size: 100 }).then((res) => setProjects(res.projects ?? [])).catch(() => {});
  }, []);

  const scrollToBottom = useCallback(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Poll session state while active
  useEffect(() => {
    if (!sessionId || meetingState === "idle" || meetingState === "done") {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const doRefresh = async () => {
      try {
        const res = await fetch(`/api/ceo-meeting/${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        setMessages(data.messages ?? []);
        setMeetingState(data.state);
        setRound(data.round ?? 0);
        if (data.tasksCreated) setTasksCreated(true);
        if (data.state === "done" || data.state === "idle") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch {
        // ignore
      }
    };

    pollIntervalRef.current = setInterval(() => void doRefresh(), 2000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [sessionId, meetingState]);

  async function startMeeting() {
    if (mode === "planning" && !topic.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ceo-meeting/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, topic: topic.trim(), lang, projectId: selectedProjectId || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message ?? "Error starting meeting");
        return;
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setParticipants(data.participants ?? []);
      setMessages([]);
      setRound(0);
      setMeetingState("running");
    } catch (err) {
      alert(String(err));
    } finally {
      setLoading(false);
    }
  }

  // Send reply from text input (global loading)
  async function sendReply(text?: string) {
    const msg = (text ?? replyText).trim();
    if (!sessionId || !msg) return;
    if (meetingState !== "waiting_ceo" && meetingState !== "running" && meetingState !== "ready") return;
    setLoading(true);
    if (!text) setReplyText("");
    try {
      const res = await fetch(`/api/ceo-meeting/${sessionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) return;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ceo",
          content: msg,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Toggle option selection for a message (multi-select)
  function toggleOption(messageId: string, opt: string) {
    if (sentMessages.has(messageId)) return;
    setSelectedOptions((prev) => {
      const next = new Map(prev);
      const cur = new Set(next.get(messageId) ?? []);
      if (cur.has(opt)) {
        cur.delete(opt);
      } else {
        cur.add(opt);
      }
      next.set(messageId, cur);
      return next;
    });
  }

  // Submit selected options for a message
  async function sendSelectedOptions(messageId: string) {
    if (!sessionId) return;
    if (sentMessages.has(messageId)) return;
    const chosen = selectedOptions.get(messageId);
    if (!chosen || chosen.size === 0) return;
    const text = Array.from(chosen).join(", ");
    setSentMessages((prev) => new Set(prev).add(messageId));
    setPendingMessageIds((prev) => { const s = new Set(prev); s.add(messageId); return s; });
    try {
      await fetch(`/api/ceo-meeting/${sessionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
    } catch {
      // ignore
    } finally {
      setPendingMessageIds((prev) => { const s = new Set(prev); s.delete(messageId); return s; });
    }
  }

  async function createTasks() {
    if (!sessionId) return;
    if (meetingState === "idle") return;
    if (tasksCreated) return;
    setLoading(true);
    setCreateTasksError(null);
    try {
      const res = await fetch(`/api/ceo-meeting/${sessionId}/create-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateTasksError(data.message ?? `Error ${res.status}`);
        return;
      }
      setTasksCreated(true);
      setMeetingState("done");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          content:
            lang === "ru"
              ? `✅ Создано ${(data.taskIds as string[])?.length ?? 0} задач. Команды приступают к работе.`
              : lang === "ko"
                ? ``
                : `✅ Created ${(data.taskIds as string[])?.length ?? 0} tasks. Teams are starting work.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const isStarted = sessionId !== null;
  const isActive = isStarted && meetingState !== "idle" && meetingState !== "done";
  // Show "Create Tasks" button: any non-idle state where tasks haven't been created yet
  // For planning: after round 1 (agents asked questions), for reporting: after they reported
  const canStartWork =
    isStarted &&
    !tasksCreated &&
    meetingState !== "idle" &&
    (mode === "reporting" || round >= 1);

  const stateLabel = {
    idle: "",
    running:
      lang === "ru"
        ? "Руководители готовят ответы..."
        : lang === "ko"
          ? "..."
          : "Heads responding...",
    waiting_ceo:
      lang === "ru"
        ? "Ожидает вашего ответа"
        : lang === "ko"
          ? ""
          : "Waiting for your reply",
    ready: lang === "ru" ? "Готовы к разработке" : lang === "ko" ? "" : "Ready to begin",
    done:
      lang === "ru" ? "Совещание завершено" : lang === "ko" ? "" : "Meeting completed",
  }[meetingState];

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--th-bg-main)", color: "var(--th-text-primary)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--th-border)", background: "var(--th-bg-surface)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md transition-colors hover:opacity-80"
          style={{ background: "var(--th-bg-hover)", color: "var(--th-text-muted)" }}
        >
          ←{" "}
          {lang === "ru" ? "Офис" : lang === "ko" ? "" : "Office"}
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate" style={{ color: "var(--th-text-heading)" }}>
            {lang === "ru"
              ? "Совещание руководителей"
              : lang === "ko"
                ? ""
                : "Leadership Meeting"}
            {isStarted && mode === "planning" && round > 0 && (
              <span className="ml-2 text-[11px] font-normal opacity-60">
                {lang === "ru" ? `Раунд ${round}` : `Round ${round}`}
              </span>
            )}
          </h2>
          {stateLabel && (
            <p className="text-xs" style={{ color: meetingState === "waiting_ceo" ? "#f59e0b" : "var(--th-text-muted)" }}>
              {meetingState === "waiting_ceo" && "⏳ "}{stateLabel}
            </p>
          )}
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isActive && meetingState === "running" && (
            <div
              className="text-xs px-2.5 py-1 rounded-md animate-pulse"
              style={{ background: "var(--th-bg-hover)", color: "var(--th-text-muted)" }}
            >
              ●●●
            </div>
          )}
          {canStartWork && !loading && meetingState !== "running" && (
            <div
              className="text-xs px-2.5 py-1 rounded-md font-medium animate-pulse"
              style={{ background: "#065f46", color: "#10b981", border: "1px solid #10b981" }}
            >
              {lang === "ru" ? "↓ Готово к запуску" : "↓ Ready"}
            </div>
          )}
        </div>
      </div>

      {/* Setup area (before start) */}
      {!isStarted && (
        <div className="flex flex-col items-center justify-center flex-1 gap-6 px-4 overflow-y-auto">
          <div className="w-full max-w-xl py-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">👑</div>
              <h3 className="text-lg font-semibold" style={{ color: "var(--th-text-heading)" }}>
                {lang === "ru"
                  ? "Созвать совещание с руководителями"
                  : lang === "ko"
                    ? ""
                    : "Call a Leadership Meeting"}
              </h3>
              <p className="text-sm mt-1" style={{ color: "var(--th-text-muted)" }}>
                {lang === "ru"
                  ? "Соберите всех руководителей отделов для планирования или отчётности"
                  : lang === "ko"
                    ? ""
                    : "Gather all department heads for planning or reporting"}
              </p>
            </div>

            {/* Mode selector */}
            <div className="flex gap-3 mb-5">
              <button
                onClick={() => setMode("planning")}
                className="flex-1 flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all"
                style={{
                  background: mode === "planning" ? "var(--th-bg-hover)" : "var(--th-bg-surface)",
                  borderColor: mode === "planning" ? "#3b82f6" : "var(--th-border)",
                }}
              >
                <span className="text-2xl">📋</span>
                <span className="text-sm font-medium" style={{ color: "var(--th-text-heading)" }}>
                  {lang === "ru" ? "Планирование" : lang === "ko" ? "" : "Planning"}
                </span>
                <span className="text-xs text-center" style={{ color: "var(--th-text-muted)" }}>
                  {lang === "ru"
                    ? "Руководители задают вопросы, вы выбираете ответы"
                    : lang === "ko"
                      ? ","
                      : "Heads ask questions, you choose answers"}
                </span>
              </button>
              <button
                onClick={() => setMode("reporting")}
                className="flex-1 flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all"
                style={{
                  background: mode === "reporting" ? "var(--th-bg-hover)" : "var(--th-bg-surface)",
                  borderColor: mode === "reporting" ? "#f59e0b" : "var(--th-border)",
                }}
              >
                <span className="text-2xl">📊</span>
                <span className="text-sm font-medium" style={{ color: "var(--th-text-heading)" }}>
                  {lang === "ru" ? "Отчётность" : lang === "ko" ? "" : "Reporting"}
                </span>
                <span className="text-xs text-center" style={{ color: "var(--th-text-muted)" }}>
                  {lang === "ru"
                    ? "Каждый руководитель докладывает статус"
                    : lang === "ko"
                      ? ""
                      : "Each head reports their status"}
                </span>
              </button>
            </div>

            {/* Topic input for planning mode */}
            {mode === "planning" && (
              <div className="mb-4">
                <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--th-text-muted)" }}>
                  {lang === "ru" ? "Тема планирования" : lang === "ko" ? "" : "Planning Topic"}
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && startMeeting()}
                  placeholder={
                    lang === "ru"
                      ? "Например: Создать мобильное приложение для доставки еды"
                      : lang === "ko"
                        ? ":"
                        : "e.g. Build a food delivery mobile app"
                  }
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--th-bg-input)",
                    border: "1px solid var(--th-border)",
                    color: "var(--th-text-primary)",
                  }}
                />
              </div>
            )}

            {/* Project selector */}
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1.5" style={{ color: "var(--th-text-muted)" }}>
                {lang === "ru" ? "Проект (необязательно)" : lang === "ko" ? "()" : "Project (optional)"}
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  background: "var(--th-bg-input)",
                  border: "1px solid var(--th-border)",
                  color: "var(--th-text-primary)",
                }}
              >
                <option value="">
                  {lang === "ru" ? "— Без проекта —" : lang === "ko" ? "—   —" : "— No project —"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={startMeeting}
              disabled={loading || (mode === "planning" && !topic.trim())}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: "#3b82f6", color: "#fff" }}
            >
              {loading
                ? lang === "ru"
                  ? "Созываем..."
                  : lang === "ko"
                    ? "..."
                    : "Starting..."
                : lang === "ru"
                  ? "🔔 Созвать совещание"
                  : lang === "ko"
                    ? "🔔"
                    : "🔔 Call Meeting"}
            </button>
          </div>
        </div>
      )}

      {/* Active meeting */}
      {isStarted && (
        <div className="flex flex-1 min-h-0">
          {/* Participants sidebar */}
          <div
            className="w-36 shrink-0 flex flex-col gap-1 p-2 overflow-y-auto"
            style={{ borderRight: "1px solid var(--th-border)", background: "var(--th-bg-surface)" }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 px-1" style={{ color: "var(--th-text-muted)" }}>
              {lang === "ru" ? "Участники" : lang === "ko" ? "" : "Participants"}
            </div>
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 py-1 px-1.5 rounded-lg"
                style={{ background: "var(--th-bg-hover)" }}
              >
                <span className="text-base shrink-0">{p.emoji}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: "var(--th-text-heading)" }}>
                    {p.name}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: "var(--th-text-muted)" }}>
                    {p.departmentName}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat column */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5"
              onScroll={() => {
                const el = chatContainerRef.current;
                if (!el) return;
                isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "ceo" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  {msg.role === "agent" && (
                    <div className="text-lg shrink-0 mt-0.5">{msg.agentEmoji ?? "🤖"}</div>
                  )}
                  {msg.role === "system" && (
                    <div className="text-base shrink-0 mt-0.5">⚙️</div>
                  )}
                  {msg.role === "ceo" && (
                    <div className="text-base shrink-0 mt-0.5">👑</div>
                  )}

                  <div className="flex flex-col gap-1" style={{ maxWidth: "78%" }}>
                    {msg.role === "agent" && msg.agentName && (
                      <div className="text-[10px] font-semibold" style={{ color: "var(--th-text-muted)" }}>
                        {msg.agentName}
                      </div>
                    )}
                    <div
                      className="text-sm px-3 py-2 rounded-xl"
                      style={{
                        background:
                          msg.role === "ceo"
                            ? "#3b82f6"
                            : msg.role === "system"
                              ? "var(--th-bg-hover)"
                              : "var(--th-bg-surface)",
                        color:
                          msg.role === "ceo"
                            ? "#fff"
                            : msg.role === "system"
                              ? "var(--th-text-muted)"
                              : "var(--th-text-primary)",
                        border: msg.role !== "ceo" ? "1px solid var(--th-border)" : "none",
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Multi-select option buttons */}
                    {msg.options && msg.options.length > 0 && isActive && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex flex-wrap gap-1.5">
                          {msg.options.map((opt) => {
                            const chosen = selectedOptions.get(msg.id) ?? new Set<string>();
                            const isChosen = chosen.has(opt);
                            const isSent = sentMessages.has(msg.id);
                            const isPending = pendingMessageIds.has(msg.id);
                            return (
                              <button
                                key={opt}
                                onClick={() => toggleOption(msg.id, opt)}
                                disabled={isSent || isPending}
                                className="text-xs px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
                                style={{
                                  background: isChosen ? "#3b82f6" : isSent ? "var(--th-bg-hover)" : "var(--th-bg-surface)",
                                  border: `1px solid ${isChosen ? "#3b82f6" : isSent ? "var(--th-border)" : "#3b82f6"}`,
                                  color: isChosen ? "#fff" : isSent ? "var(--th-text-muted)" : "#3b82f6",
                                  cursor: isSent ? "default" : "pointer",
                                  fontWeight: isChosen ? "600" : "normal",
                                }}
                              >
                                {isChosen ? "✓ " : ""}{opt}
                              </button>
                            );
                          })}
                        </div>
                        {/* Send button — appears when at least one option selected and not yet sent */}
                        {!sentMessages.has(msg.id) && (selectedOptions.get(msg.id)?.size ?? 0) > 0 && (
                          <button
                            onClick={() => void sendSelectedOptions(msg.id)}
                            disabled={pendingMessageIds.has(msg.id)}
                            className="self-start text-xs px-3 py-1 rounded-lg font-semibold transition-all disabled:opacity-50"
                            style={{ background: "#3b82f6", color: "#fff" }}
                          >
                            {pendingMessageIds.has(msg.id)
                              ? "..."
                              : lang === "ru"
                                ? `Отправить (${selectedOptions.get(msg.id)?.size})`
                                : lang === "ko"
                                  ? ``
                                  : `Send (${selectedOptions.get(msg.id)?.size})`}
                          </button>
                        )}
                        {sentMessages.has(msg.id) && (
                          <div className="text-[10px]" style={{ color: "var(--th-text-muted)" }}>
                            ✓ {lang === "ru" ? "Отправлено" : lang === "ko" ? "" : "Sent"}:{" "}
                            {Array.from(selectedOptions.get(msg.id) ?? []).join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {meetingState === "running" && (
                <div className="flex gap-2 items-center px-1">
                  <div className="text-base">💬</div>
                  <div
                    className="text-xs px-3 py-1.5 rounded-xl animate-pulse"
                    style={{
                      background: "var(--th-bg-surface)",
                      border: "1px solid var(--th-border)",
                      color: "var(--th-text-muted)",
                    }}
                  >
                    {lang === "ru"
                      ? "Руководители готовят ответы..."
                      : lang === "ko"
                        ? "..."
                        : "Heads responding..."}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Create Tasks action zone — prominent banner when ready */}
            {canStartWork && meetingState !== "running" && (
              <div
                className="shrink-0 mx-3 mb-2 p-3 rounded-xl flex flex-col gap-2"
                style={{ background: "linear-gradient(135deg, #065f46 0%, #047857 100%)", border: "1px solid #10b981" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚀</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">
                      {lang === "ru"
                        ? "Совещание завершено — запустить задачи?"
                        : lang === "ko"
                          ? "—  ?"
                          : "Meeting complete — start the tasks?"}
                    </div>
                    <div className="text-xs text-green-200 mt-0.5">
                      {lang === "ru"
                        ? `Будет создано ${participants.length} задач, по одной для каждого отдела`
                        : lang === "ko"
                          ? ``
                          : `${participants.length} tasks will be created, one per department`}
                    </div>
                  </div>
                  <button
                    onClick={createTasks}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 shrink-0"
                    style={{ background: "#10b981", color: "#fff" }}
                  >
                    {loading
                      ? "..."
                      : lang === "ru"
                        ? "Создать задачи"
                        : lang === "ko"
                          ? ""
                          : "Create Tasks"}
                  </button>
                </div>
                {createTasksError && (
                  <div className="text-xs text-red-300 px-1">{createTasksError}</div>
                )}
              </div>
            )}

            {/* CEO input — always visible when meeting is active */}
            {isActive && (
              <div
                className="shrink-0 p-3"
                style={{ borderTop: "1px solid var(--th-border)", background: "var(--th-bg-surface)" }}
              >
                {meetingState === "waiting_ceo" && (
                  <div className="text-[11px] mb-1.5" style={{ color: "#f59e0b" }}>
                    ⏳{" "}
                    {lang === "ru"
                      ? "Руководители ждут вашего ответа. Выберите вариант или напишите свой:"
                      : lang === "ko"
                        ? ".    :"
                        : "Heads are waiting. Choose an option above or type your reply:"}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !loading) {
                        void sendReply();
                      }
                    }}
                    disabled={meetingState === "running"}
                    placeholder={
                      meetingState === "running"
                        ? lang === "ru"
                          ? "Ожидание ответов руководителей..."
                          : "Waiting for heads to respond..."
                        : lang === "ru"
                          ? "Ваш вопрос или ответ..."
                          : lang === "ko"
                            ? "..."
                            : "Your question or reply..."
                    }
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
                    style={{
                      background: "var(--th-bg-input)",
                      border: `1px solid ${meetingState === "waiting_ceo" ? "#f59e0b" : "var(--th-border)"}`,
                      color: "var(--th-text-primary)",
                    }}
                  />
                  <button
                    onClick={() => void sendReply()}
                    disabled={loading || !replyText.trim() || meetingState === "running"}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
                    style={{ background: "#3b82f6", color: "#fff" }}
                  >
                    →
                  </button>
                </div>
              </div>
            )}

            {/* Done state */}
            {meetingState === "done" && (
              <div
                className="p-3 text-center shrink-0"
                style={{ borderTop: "1px solid var(--th-border)", background: "var(--th-bg-surface)" }}
              >
                <span className="text-sm" style={{ color: "var(--th-text-muted)" }}>
                  {lang === "ru"
                    ? "Совещание завершено. "
                    : lang === "ko"
                      ? "."
                      : "Meeting completed. "}
                </span>
                <button
                  onClick={onBack}
                  className="text-sm underline"
                  style={{ color: "#3b82f6" }}
                >
                  {lang === "ru"
                    ? "Вернуться в офис"
                    : lang === "ko"
                      ? ""
                      : "Return to office"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
