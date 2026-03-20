import type { Dispatch, SetStateAction } from "react";
import AgentSelect from "../../AgentSelect";
import type { Agent, MessengerChannelType, MessengerChannelsConfig, WorkflowPackKey } from "../../../types";
import type { ChannelSettingsTabProps } from "../types";
import { CHANNEL_META, channelTargetHint, isWorkflowPackKey } from "./constants";
import type { ChatEditorState } from "./state";
import { MESSENGER_CHANNELS } from "../../../types";

type WorkflowPackOption = {
  key: WorkflowPackKey;
  name: string;
  enabled: boolean;
};

type ChatEditorModalProps = {
  t: ChannelSettingsTabProps["t"];
  editor: ChatEditorState;
  setEditor: Dispatch<SetStateAction<ChatEditorState>>;
  closeEditorModal: () => void;
  handleSaveEditor: () => void;
  channelsConfig: MessengerChannelsConfig;
  agents: Agent[];
  agentsLoading: boolean;
  workflowPackOptions: WorkflowPackOption[];
  workflowPacksLoading: boolean;
  editorError: string | null;
  discordChannels: Array<{
    id: string;
    name: string;
    guildId: string;
    guildName: string;
    type: number;
  }>;
  discordChannelsLoading: boolean;
  discordChannelsError: string | null;
};

export default function ChatEditorModal({
  t,
  editor,
  setEditor,
  closeEditorModal,
  handleSaveEditor,
  channelsConfig,
  agents,
  agentsLoading,
  workflowPackOptions,
  workflowPacksLoading,
  editorError,
  discordChannels,
  discordChannelsLoading,
  discordChannelsError,
}: ChatEditorModalProps) {
  const discordSelectedChannel =
    editor.channel === "discord" ? discordChannels.find((entry) => entry.id === editor.targetId.trim()) : null;

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center px-4">
      <button className="absolute inset-0 bg-slate-950/70" onClick={closeEditorModal} aria-label="close modal" />
      <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-100">
            {editor.mode === "create"
              ? t({ ko: "", en: "Add Chat", ja: "チャット追加", zh: "新増聊天", ru: "Добавить чат" })
              : t({ ko: "", en: "Edit Chat", ja: "チャット編", zh: "编辑聊天", ru: "Редактировать чат" })}
          </h4>
          <button
            onClick={closeEditorModal}
            className="px-2 py-1 text-xs rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            {t({ ko: "", en: "Close", ja: "閉じる", zh: "关闭", ru: "Закрыть" })}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t({ ko: "", en: "Messenger", ja: "メッセンジャー", zh: "消息渠道", ru: "Мессенджер" })}
            </label>
            <select
              value={editor.channel}
              onChange={(e) => {
                const nextChannel = e.target.value as MessengerChannelType;
                setEditor((prev) => ({
                  ...prev,
                  channel: nextChannel,
                  token: channelsConfig[nextChannel].token ?? "",
                  receiveEnabled: channelsConfig[nextChannel].receiveEnabled !== false,
                }));
              }}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {MESSENGER_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {CHANNEL_META[channel].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t({ ko: "", en: "Enabled", ja: "有効", zh: "启用", ru: "Включён" })}
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 h-[38px]">
              <input
                type="checkbox"
                checked={editor.enabled}
                onChange={(e) => setEditor((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="accent-blue-500"
              />
              {editor.enabled
                ? t({ ko: "", en: "Enabled", ja: "有効", zh: "启用", ru: "Включён" })
                : t({ ko: "", en: "Disabled", ja: "無効", zh: "禁用", ru: "Отключён" })}
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {t({ ko: "", en: "Token", ja: "トークン", zh: "令牌", ru: "Токен" })}
          </label>
          <input
            type="password"
            value={editor.token}
            onChange={(e) => setEditor((prev) => ({ ...prev, token: e.target.value }))}
            placeholder={t({
              ko: `Enter ${CHANNEL_META[editor.channel].label} token`,
              en: `Enter ${CHANNEL_META[editor.channel].label} token`,
              ja: `${CHANNEL_META[editor.channel].label} トークンを入力`,
              zh: `输入 ${CHANNEL_META[editor.channel].label} 令牌`,
              ru: `Введите токен ${CHANNEL_META[editor.channel].label}`,
            })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t({ ko: "", en: "Chat Name", ja: "チャット名", zh: "聊天名称", ru: "Название чата" })}
            </label>
            <input
              value={editor.name}
              onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t({
                ko: ":",
                en: "e.g. Design Alerts",
                ja: "例: デザイン通知",
                zh: "例如：设计组通知",
                ru: "Например: уведомления дизайна",
              })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {t({ ko: "/ ID", en: "Channel/Target ID", ja: "チャンネル/対象 ID", zh: "频道/目标 ID", ru: "ID канала/получателя" })}
            </label>
            {editor.channel === "discord" && discordChannels.length > 0 && (
              <select
                value={discordSelectedChannel ? discordSelectedChannel.id : ""}
                onChange={(e) => {
                  const nextTargetId = e.target.value;
                  setEditor((prev) => {
                    const matched = discordChannels.find((entry) => entry.id === nextTargetId);
                    return {
                      ...prev,
                      targetId: nextTargetId,
                      name: matched && !prev.name.trim() ? `${matched.guildName} #${matched.name}` : prev.name,
                    };
                  });
                }}
                className="mb-2 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="">
                  {t({
                    ko: "Discord   ( )",
                    en: "Choose detected Discord channel (optional)",
                    ja: "検出されたDiscordチャネルを選択（任意）",
                    zh: "选择检测到的 Discord 频道（可选）",
                    ru: "Выбрать найденный канал Discord (необязательно)",
                  })}
                </option>
                {discordChannels.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.guildName} / #{entry.name} ({entry.id})
                  </option>
                ))}
              </select>
            )}
            <input
              value={editor.targetId}
              onChange={(e) => {
                const nextTargetId = e.target.value;
                setEditor((prev) => {
                  const matched =
                    prev.channel === "discord"
                      ? discordChannels.find((entry) => entry.id === nextTargetId.trim())
                      : undefined;
                  return {
                    ...prev,
                    targetId: nextTargetId,
                    name: matched && !prev.name.trim() ? `${matched.guildName} #${matched.name}` : prev.name,
                  };
                });
              }}
              placeholder={channelTargetHint(editor.channel)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500"
            />
            {editor.channel === "discord" && (
              <div className="mt-1 space-y-1">
                {discordChannelsLoading && (
                  <div className="text-[11px] text-blue-300">
                    {t({
                      ko: "Discord    ...",
                      en: "Loading Discord channels...",
                      ja: "Discordチャネルを読み込み中...",
                      zh: "正在加载 Discord 频道...",
                      ru: "Загрузка каналов Discord...",
                    })}
                  </div>
                )}
                {!discordChannelsLoading && !discordChannelsError && editor.token.trim() && (
                  <div className="text-[11px] text-slate-500">
                    {discordChannels.length > 0
                      ? t({
                          ko: `Loaded ${discordChannels.length} channels automatically.`,
                          en: `Loaded ${discordChannels.length} channels automatically.`,
                          ja: `${discordChannels.length} 件のチャネルを自動取得しました。`,
                          zh: `已自动加载 ${discordChannels.length} 个频道。`,
                          ru: `Автоматически загружено ${discordChannels.length} каналов.`,
                        })
                      : t({
                          ko: "Discord  . Bot /   .",
                          en: "No Discord channels found. Check bot permissions and server membership.",
                          ja: "取得できるDiscordチャネルがありません。Bot権限とサーバー参加状態を確認してください。",
                          zh: "未找到可用 Discord 频道。请检查 Bot 权限和服务器加入状态。",
                          ru: "Каналы Discord не найдены. Проверьте права бота и членство в сервере.",
                        })}
                  </div>
                )}
                {discordChannelsError && <div className="text-[11px] text-red-400">{discordChannelsError}</div>}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {t({ ko: "Agent", en: "Conversation Agent", ja: "担当Agent", zh: "对话 Agent", ru: "Агент разговора" })}
          </label>
          <AgentSelect
            agents={agents}
            value={editor.agentId}
            onChange={(agentId) => setEditor((prev) => ({ ...prev, agentId: agentId || "" }))}
            placeholder={t({
              ko: "Agent",
              en: "Select Agent",
              ja: "担エージェント選択",
              zh: "选择对话 Agent",
              ru: "Выбрать агента",
            })}
            className={agentsLoading ? "pointer-events-none opacity-60" : ""}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            {t({ ko: "", en: "Workflow Pack", ja: "ワークフローパック", zh: "工作流包", ru: "Пакет рабочих процессов" })}
          </label>
          <select
            value={editor.workflowPackKey}
            onChange={(e) =>
              setEditor((prev) => ({
                ...prev,
                workflowPackKey: isWorkflowPackKey(e.target.value) ? e.target.value : "development",
              }))
            }
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {workflowPackOptions.map((pack) => (
              <option key={pack.key} value={pack.key} disabled={!pack.enabled && pack.key !== editor.workflowPackKey}>
                {pack.name}
                {!pack.enabled ? ` (${t({ ko: "", en: "disabled", ja: "無効", zh: "禁用", ru: "отключён" })})` : ""}
              </option>
            ))}
          </select>
          {workflowPacksLoading && (
            <div className="mt-1 text-[11px] text-slate-500">
              {t({
                ko: "...",
                en: "Loading packs...",
                ja: "パックを読み込み中...",
                zh: "正在加载工作流包...",
                ru: "Загрузка пакетов...",
              })}
            </div>
          )}
        </div>

        {editor.channel === "telegram" && (
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={editor.receiveEnabled}
              onChange={(e) => setEditor((prev) => ({ ...prev, receiveEnabled: e.target.checked }))}
              className="accent-blue-500"
            />
            {t({
              ko: "",
              en: "Enable direct Telegram receive",
              ja: "Telegram 直接受信を有効化",
              zh: "启用 Telegram 直接接收",
              ru: "Включить прямой прием Telegram",
            })}
          </label>
        )}

        {editorError && <div className="text-xs text-red-400">{editorError}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={closeEditorModal}
            className="px-3 py-1.5 text-xs rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            {t({ ko: "", en: "Cancel", ja: "キャンセル", zh: "取消", ru: "Отмена" })}
          </button>
          <button
            onClick={handleSaveEditor}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-500"
          >
            {t({ ko: "", en: "Confirm", ja: "確認", zh: "确认", ru: "Подтвердить" })}
          </button>
        </div>
      </div>
    </div>
  );
}
