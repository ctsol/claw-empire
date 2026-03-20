import { timeAgo } from "../constants";
import type { CreateTaskModalOverlaysProps } from "./overlay-types";

export default function CreateTaskModalOverlays({
  t,
  localeTag,
  restorePromptOpen,
  selectedRestoreDraft,
  restoreCandidates,
  selectedRestoreDraftId,
  formatDraftTimestamp,
  submitWithoutProjectPromptOpen,
  missingPathPrompt,
  submitBusy,
  manualPathPickerOpen,
  manualPathLoading,
  manualPathCurrent,
  manualPathParent,
  manualPathEntries,
  manualPathTruncated,
  manualPathError,
  draftModalOpen,
  drafts,
  onSelectRestoreDraft,
  onCloseRestorePrompt,
  onLoadSelectedRestoreDraft,
  onCloseSubmitWithoutProjectPrompt,
  onConfirmSubmitWithoutProject,
  onCloseMissingPathPrompt,
  onConfirmCreateMissingPath,
  onCloseManualPathPicker,
  onManualPathGoUp,
  onManualPathRefresh,
  onOpenManualPathEntry,
  onSelectManualCurrentPath,
  onCloseDraftModal,
  onLoadDraft,
  onDeleteDraft,
  onClearDrafts,
}: CreateTaskModalOverlaysProps) {
  return (
    <>
      {restorePromptOpen && selectedRestoreDraft && (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/65 p-4"
          onClick={onCloseRestorePrompt}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {t({
                  ko: "",
                  en: "Restore Draft",
                  ja: "下書き復元",
                  zh: "恢复草稿",
                  ru: "Восстановить черновик",
                })}
              </h3>
            </div>
            <div className="space-y-2 px-4 py-4">
              <p className="text-sm text-slate-200">
                {t({
                  ko: ". ?",
                  en: "There is previously entered data. Would you like to load it?",
                  ja: "以前入力していたデータがあります。読み込みますか？",
                  zh: "检测到之前输入的数据，是否加载？",
                  ru: "Обнаружены ранее введённые данные. Загрузить их?",
                })}
              </p>
              <p className="text-xs text-slate-400">
                {t({
                  ko: "( 3)",
                  en: "Recent drafts (up to 3)",
                  ja: "最近の下書き（最大3件）",
                  zh: "最近草稿（最多3个）",
                  ru: "Последние черновики (до 3)",
                })}
              </p>
              <div className="space-y-2">
                {restoreCandidates.map((draft) => {
                  const isSelected = selectedRestoreDraftId === draft.id;
                  return (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => onSelectRestoreDraft(draft.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/15"
                          : "border-slate-700 bg-slate-800/70 hover:bg-slate-800"
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {draft.title ||
                          t({
                            ko: "( )",
                            en: "(Untitled)",
                            ja: "(無題)",
                            zh: "（无标题）",
                            ru: "(Без названия)",
                          })}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDraftTimestamp(draft.updatedAt)} · {timeAgo(draft.updatedAt, localeTag)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
              <button
                type="button"
                onClick={onCloseRestorePrompt}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                {t({ ko: "", en: "Start Fresh", ja: "新規作成", zh: "重新填写", ru: "Начать заново" })}
              </button>
              <button
                type="button"
                onClick={onLoadSelectedRestoreDraft}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                {t({ ko: "", en: "Load", ja: "読み込み", zh: "加载", ru: "Загрузить" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {submitWithoutProjectPromptOpen && (
        <div
          className="fixed inset-0 z-[59] flex items-center justify-center bg-black/70 p-4"
          onClick={onCloseSubmitWithoutProjectPrompt}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {t({
                  ko: "",
                  en: "Create Without Project",
                  ja: "プロジェクト未連携で作成",
                  zh: "不关联项目创建",
                  ru: "Создать без проекта",
                })}
              </h3>
            </div>
            <div className="space-y-2 px-4 py-4">
              <p className="text-sm text-slate-200">
                {t({
                  ko: "?",
                  en: "Create this task without a project link?",
                  ja: "プロジェクト未連携でタスクを作成しますか？",
                  zh: "要在不关联项目的情况下创建任务吗？",
                  ru: "Создать задачу без привязки к проекту?",
                })}
              </p>
              <p className="text-xs text-slate-400">
                {t({
                  ko: ".",
                  en: "It will not appear in project history.",
                  ja: "この場合、プロジェクト履歴には集計されません。",
                  zh: "该任务不会出现在项目历史中。",
                  ru: "Задача не появится в истории проекта.",
                })}
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
              <button
                type="button"
                onClick={onCloseSubmitWithoutProjectPrompt}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                {t({ ko: "", en: "Cancel", ja: "キャンセル", zh: "取消", ru: "Отмена" })}
              </button>
              <button
                type="button"
                onClick={onConfirmSubmitWithoutProject}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                {t({ ko: "", en: "Continue", ja: "続行", zh: "继续", ru: "Продолжить" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {missingPathPrompt && (
        <div
          className="fixed inset-0 z-[59] flex items-center justify-center bg-black/70 p-4"
          onClick={onCloseMissingPathPrompt}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {t({
                  ko: "",
                  en: "Confirm Project Path",
                  ja: "プロジェクトパス確認",
                  zh: "确认项目路径",
                  ru: "Подтверждение пути проекта",
                })}
              </h3>
            </div>
            <div className="space-y-2 px-4 py-4">
              <p className="text-sm text-slate-200">
                {t({
                  ko: ". ?",
                  en: "This path does not exist. Create it now?",
                  ja: "このパスは存在しません。作成しますか？",
                  zh: "该路径不存在。现在创建吗？",
                  ru: "Этот путь не существует. Создать его?",
                })}
              </p>
              <p className="break-all rounded-md border border-slate-700 bg-slate-800/70 px-2.5 py-2 text-xs text-slate-200">
                {missingPathPrompt.normalizedPath}
              </p>
              {missingPathPrompt.nearestExistingParent && (
                <p className="text-xs text-slate-400">
                  {t({
                    ko: "",
                    en: `Base folder: ${missingPathPrompt.nearestExistingParent}`,
                    ja: `基準フォルダ: ${missingPathPrompt.nearestExistingParent}`,
                    zh: `基准目录：${missingPathPrompt.nearestExistingParent}`,
                    ru: `Базовая папка: ${missingPathPrompt.nearestExistingParent}`,
                  })}
                </p>
              )}
              {!missingPathPrompt.canCreate && (
                <p className="text-xs text-amber-300">
                  {t({
                    ko: ".   .",
                    en: "This path is not creatable with current permissions. Choose another path.",
                    ja: "現在の権限ではこのパスを作成できません。別のパスを指定してください。",
                    zh: "当前权限无法创建此路径，请选择其他路径。",
                    ru: "Создание этого пути невозможно с текущими разрешениями. Выберите другой путь.",
                  })}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
              <button
                type="button"
                onClick={onCloseMissingPathPrompt}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                {t({ ko: "", en: "Cancel", ja: "キャンセル", zh: "取消", ru: "Отмена" })}
              </button>
              <button
                type="button"
                disabled={!missingPathPrompt.canCreate || submitBusy}
                onClick={onConfirmCreateMissingPath}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t({ ko: "", en: "Yes", ja: "はい", zh: "是", ru: "Да" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {manualPathPickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={onCloseManualPathPicker}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {t({
                  ko: "",
                  en: "In-App Folder Browser",
                  ja: "アプリ内フォルダ閲覧",
                  zh: "应用内文件夹浏览",
                  ru: "Просмотр папок в приложении",
                })}
              </h3>
              <button
                type="button"
                onClick={onCloseManualPathPicker}
                className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2">
                <p className="text-[11px] text-slate-400">
                  {t({ ko: "", en: "Current Location", ja: "現在位置", zh: "当前位置", ru: "Текущее местоположение" })}
                </p>
                <p className="break-all text-xs text-slate-200">{manualPathCurrent || "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!manualPathParent || manualPathLoading}
                  onClick={onManualPathGoUp}
                  className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t({ ko: "", en: "Up", ja: "上位フォルダ", zh: "上级目录", ru: "Вверх" })}
                </button>
                <button
                  type="button"
                  disabled={manualPathLoading}
                  onClick={onManualPathRefresh}
                  className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t({ ko: "", en: "Refresh", ja: "更新", zh: "刷新", ru: "Обновить" })}
                </button>
              </div>
              <div className="max-h-[45dvh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50">
                {manualPathLoading ? (
                  <p className="px-3 py-2 text-xs text-slate-400">
                    {t({
                      ko: "...",
                      en: "Loading directories...",
                      ja: "フォルダ一覧を読み込み中...",
                      zh: "正在加载目录...",
                      ru: "Загрузка директорий...",
                    })}
                  </p>
                ) : manualPathError ? (
                  <p className="px-3 py-2 text-xs text-rose-300">{manualPathError}</p>
                ) : manualPathEntries.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">
                    {t({
                      ko: ".",
                      en: "No selectable subdirectories.",
                      ja: "選択可能なサブディレクトリがありません。",
                      zh: "没有可选的子目录。",
                      ru: "Нет доступных подпапок.",
                    })}
                  </p>
                ) : (
                  manualPathEntries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => onOpenManualPathEntry(entry.path)}
                      className="w-full border-b border-slate-700/70 px-3 py-2 text-left transition hover:bg-slate-700/60"
                    >
                      <p className="text-xs font-semibold text-slate-100">{entry.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{entry.path}</p>
                    </button>
                  ))
                )}
              </div>
              {manualPathTruncated && (
                <p className="text-[11px] text-slate-400">
                  {t({
                    ko: "300  .",
                    en: "Only the first 300 directories are shown.",
                    ja: "項目数が多いため先頭300件のみ表示しています。",
                    zh: "目录过多，仅显示前300个。",
                    ru: "Показаны первые 300 директорий.",
                  })}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
              <button
                type="button"
                onClick={onCloseManualPathPicker}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                {t({ ko: "", en: "Cancel", ja: "キャンセル", zh: "取消", ru: "Отмена" })}
              </button>
              <button
                type="button"
                disabled={!manualPathCurrent}
                onClick={onSelectManualCurrentPath}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t({
                  ko: "",
                  en: "Select Current Folder",
                  ja: "現在フォルダを選択",
                  zh: "选择当前文件夹",
                  ru: "Выбрать текущую папку",
                })}
              </button>
            </div>
          </div>
        </div>
      )}

      {draftModalOpen && (
        <div
          className="fixed inset-0 z-[61] flex items-center justify-center bg-black/70 p-4"
          onClick={onCloseDraftModal}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {t({ ko: "", en: "Temporary Drafts", ja: "一時保存一覧", zh: "临时草稿列表", ru: "Временные черновики" })}
              </h3>
              <button
                type="button"
                onClick={onCloseDraftModal}
                className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
                title={t({ ko: "", en: "Close", ja: "閉じる", zh: "关闭", ru: "Закрыть" })}
              >
                ✕
              </button>
            </div>

            <div className="max-h-[55dvh] space-y-2 overflow-y-auto px-4 py-3">
              {drafts.length === 0 ? (
                <div className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-4 text-center text-sm text-slate-400">
                  {t({
                    ko: ".",
                    en: "No temporary drafts saved.",
                    ja: "保存された一時項目はありません。",
                    zh: "没有已保存的临时草稿。",
                    ru: "Нет сохранённых черновиков.",
                  })}
                </div>
              ) : (
                drafts.map((draft) => (
                  <div key={draft.id} className="rounded-lg border border-slate-700 bg-slate-800/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {draft.title ||
                            t({
                              ko: "( )",
                              en: "(Untitled)",
                              ja: "(無題)",
                              zh: "（无标题）",
                              ru: "(Без названия)",
                            })}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatDraftTimestamp(draft.updatedAt)} · {timeAgo(draft.updatedAt, localeTag)}
                        </p>
                        {draft.description.trim() && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-300">{draft.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onLoadDraft(draft)}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-blue-500"
                        >
                          {t({ ko: "", en: "Load", ja: "読み込み", zh: "加载", ru: "Загрузить" })}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDraft(draft.id)}
                          className="rounded-md border border-red-500/70 px-2.5 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                        >
                          {t({ ko: "", en: "Delete", ja: "削除", zh: "删除", ru: "Удалить" })}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-slate-700 px-4 py-3">
              <button
                type="button"
                onClick={onClearDrafts}
                disabled={drafts.length === 0}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t({ ko: "", en: "Delete All", ja: "すべて削除", zh: "全部删除", ru: "Удалить все" })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
