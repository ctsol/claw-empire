import { CLI_INFO } from "./constants";
import type { CliSettingsTabProps } from "./types";

export default function CliSettingsTab({
  t,
  cliStatus,
  cliModels,
  cliModelsLoading,
  form,
  setForm,
  persistSettings,
  onRefresh,
}: CliSettingsTabProps) {
  return (
    <section
      className="rounded-xl p-5 sm:p-6 space-y-5"
      style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--th-text-primary)" }}>
          {t({ ko: "CLI", en: "CLI Tool Status", ja: "CLI ツール状態", zh: "CLI 工具状态", ru: "Статус CLI инструментов" })}
        </h3>
        <button onClick={onRefresh} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          🔄 {t({ ko: "", en: "Refresh", ja: "更新", zh: "刷新", ru: "Обновить" })}
        </button>
      </div>

      {cliStatus ? (
        <div className="space-y-2">
          {Object.entries(cliStatus)
            .filter(([provider]) => !["copilot", "antigravity"].includes(provider))
            .map(([provider, status]) => {
              const info = CLI_INFO[provider];
              const isReady = status.installed && status.authenticated;
              const hasSubModel = provider === "claude" || provider === "codex";
              const modelList = cliModels?.[provider] ?? [];
              const currentModel = form.providerModelConfig?.[provider]?.model || "";
              const currentSubModel = form.providerModelConfig?.[provider]?.subModel || "";
              const currentReasoningLevel = form.providerModelConfig?.[provider]?.reasoningLevel || "";

              const selectedModel = modelList.find((m) => m.slug === currentModel);
              const reasoningLevels = selectedModel?.reasoningLevels;
              const defaultReasoning = selectedModel?.defaultReasoningLevel || "";

              return (
                <div key={provider} className="bg-slate-700/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{info?.icon ?? "?"}</span>
                    <div className="flex-1">
                      <div className="text-sm text-white">{info?.label ?? provider}</div>
                      <div className="text-xs text-slate-500">
                        {status.version ??
                          (status.installed
                            ? t({
                                ko: "",
                                en: "Version unknown",
                                ja: "バージョン不明",
                                zh: "版本未知",
                                ru: "Версия неизвестна",
                              })
                            : t({ ko: "", en: "Not installed", ja: "未インストール", zh: "未安装", ru: "Не установлено" }))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          status.installed ? "bg-green-500/20 text-green-400" : "bg-slate-600/50 text-slate-400"
                        }`}
                      >
                        {status.installed
                          ? t({ ko: "", en: "Installed", ja: "インストール済み", zh: "已安装", ru: "Установлено" })
                          : t({ ko: "", en: "Not installed", ja: "未インストール", zh: "未安装", ru: "Не установлено" })}
                      </span>
                      {status.installed && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            status.authenticated ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {status.authenticated
                            ? t({ ko: "", en: "Authenticated", ja: "認証済み", zh: "已认证", ru: "Авторизовано" })
                            : t({ ko: "", en: "Not Authenticated", ja: "未認証", zh: "未认证", ru: "Не авторизовано" })}
                        </span>
                      )}
                    </div>
                  </div>

                  {isReady && (
                    <div className="space-y-1.5 pl-0 sm:pl-8">
                      <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <span className="w-auto shrink-0 text-xs text-slate-400 sm:w-20">
                          {hasSubModel
                            ? t({ ko: ":", en: "Main model:", ja: "メインモデル:", zh: "主模型:", ru: "Основная модель:" })
                            : t({ ko: ":", en: "Model:", ja: "モデル:", zh: "模型:", ru: "Модель:" })}
                        </span>
                        {cliModelsLoading ? (
                          <span className="text-xs text-slate-500 animate-pulse">
                            {t({ ko: "...", en: "Loading...", ja: "読み込み中...", zh: "加载中...", ru: "Загрузка..." })}
                          </span>
                        ) : modelList.length > 0 ? (
                          <select
                            value={currentModel}
                            onChange={(e) => {
                              const newSlug = e.target.value;
                              const newModel = modelList.find((m) => m.slug === newSlug);
                              const prev = form.providerModelConfig?.[provider] || {};
                              const newConfig = {
                                ...form.providerModelConfig,
                                [provider]: {
                                  ...prev,
                                  model: newSlug,
                                  reasoningLevel: newModel?.defaultReasoningLevel || undefined,
                                },
                              };
                              const newForm = { ...form, providerModelConfig: newConfig };
                              setForm(newForm);
                              persistSettings(newForm);
                            }}
                            className="w-full min-w-0 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none sm:flex-1"
                          >
                            <option value="">{t({ ko: "", en: "Default", ja: "デフォルト", zh: "默认", ru: "По умолчанию" })}</option>
                            {modelList.map((m) => (
                              <option key={m.slug} value={m.slug}>
                                {m.displayName || m.slug}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {t({ ko: "", en: "No models", ja: "モデル一覧なし", zh: "无模型列表", ru: "Нет моделей" })}
                          </span>
                        )}
                      </div>

                      {provider === "codex" && reasoningLevels && reasoningLevels.length > 0 && (
                        <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                          <span className="w-auto shrink-0 text-xs text-slate-400 sm:w-20">
                            {t({ ko: ":", en: "Reasoning:", ja: "推論レベル:", zh: "推理级别:", ru: "Рассуждение:" })}
                          </span>
                          <select
                            value={currentReasoningLevel || defaultReasoning}
                            onChange={(e) => {
                              const prev = form.providerModelConfig?.[provider] || { model: "" };
                              const newConfig = {
                                ...form.providerModelConfig,
                                [provider]: { ...prev, reasoningLevel: e.target.value },
                              };
                              const newForm = { ...form, providerModelConfig: newConfig };
                              setForm(newForm);
                              persistSettings(newForm);
                            }}
                            className="w-full min-w-0 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none sm:flex-1"
                          >
                            {reasoningLevels.map((rl) => (
                              <option key={rl.effort} value={rl.effort}>
                                {rl.effort} ({rl.description})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {hasSubModel && (
                        <>
                          <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                            <span className="w-auto shrink-0 text-xs text-slate-400 sm:w-20">
                              {t({
                                ko: ":",
                                en: "Sub-agent model:",
                                ja: "サブモデル:",
                                zh: "子代理模型:",
                                ru: "Модель суб-агента:",
                              })}
                            </span>
                            {cliModelsLoading ? (
                              <span className="text-xs text-slate-500 animate-pulse">
                                {t({ ko: "...", en: "Loading...", ja: "読み込み中...", zh: "加载中...", ru: "Загрузка..." })}
                              </span>
                            ) : modelList.length > 0 ? (
                              <select
                                value={currentSubModel}
                                onChange={(e) => {
                                  const newSlug = e.target.value;
                                  const newSubModel = modelList.find((m) => m.slug === newSlug);
                                  const prev = form.providerModelConfig?.[provider] || { model: "" };
                                  const newConfig = {
                                    ...form.providerModelConfig,
                                    [provider]: {
                                      ...prev,
                                      subModel: newSlug,
                                      subModelReasoningLevel: newSubModel?.defaultReasoningLevel || undefined,
                                    },
                                  };
                                  const newForm = { ...form, providerModelConfig: newConfig };
                                  setForm(newForm);
                                  persistSettings(newForm);
                                }}
                                className="w-full min-w-0 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none sm:flex-1"
                              >
                                <option value="">
                                  {t({ ko: "", en: "Default", ja: "デフォルト", zh: "默认", ru: "По умолчанию" })}
                                </option>
                                {modelList.map((m) => (
                                  <option key={m.slug} value={m.slug}>
                                    {m.displayName || m.slug}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-500">
                                {t({ ko: "", en: "No models", ja: "モデル一覧なし", zh: "无模型列表", ru: "Нет моделей" })}
                              </span>
                            )}
                          </div>

                          {(() => {
                            const subSelected = modelList.find((m) => m.slug === currentSubModel);
                            const subLevels = subSelected?.reasoningLevels;
                            const subDefault = subSelected?.defaultReasoningLevel || "";
                            const currentSubRL = form.providerModelConfig?.[provider]?.subModelReasoningLevel || "";
                            if (provider !== "codex" || !subLevels || subLevels.length === 0) return null;
                            return (
                              <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                                <span className="w-auto shrink-0 text-xs text-slate-400 sm:w-20">
                                  {t({ ko: ":", en: "Sub reasoning:", ja: "サブ推論:", zh: "子推理:", ru: "Суб-рассуждение:" })}
                                </span>
                                <select
                                  value={currentSubRL || subDefault}
                                  onChange={(e) => {
                                    const prev = form.providerModelConfig?.[provider] || { model: "" };
                                    const newConfig = {
                                      ...form.providerModelConfig,
                                      [provider]: { ...prev, subModelReasoningLevel: e.target.value },
                                    };
                                    const newForm = { ...form, providerModelConfig: newConfig };
                                    setForm(newForm);
                                    persistSettings(newForm);
                                  }}
                                  className="w-full min-w-0 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none sm:flex-1"
                                >
                                  {subLevels.map((rl) => (
                                    <option key={rl.effort} value={rl.effort}>
                                      {rl.effort} ({rl.description})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : (
        <div className="text-center py-4 text-slate-500 text-sm">
          {t({ ko: "...", en: "Loading...", ja: "読み込み中...", zh: "加载中...", ru: "Загрузка..." })}
        </div>
      )}

      <p className="text-xs text-slate-500">
        {t({
          ko: "CLI        . Copilot/Antigravity  OAuth  .",
          en: "Each agent's CLI tool can be changed in Office by clicking an agent. Configure Copilot/Antigravity models in OAuth tab.",
          ja: "各エージェントの CLI ツールは Office でエージェントをクリックして変更できます。Copilot/Antigravity のモデルは OAuth タブで設定してください。",
          zh: "每个代理的 CLI 工具可在 Office 中点击代理后修改。Copilot/Antigravity 模型请在 OAuth 页签配置。",
          ru: "CLI инструмент каждого агента можно изменить в Офисе, нажав на агента. Модели Copilot/Antigravity настраиваются во вкладке OAuth.",
        })}
      </p>
    </section>
  );
}
