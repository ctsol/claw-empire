import type { ManualAssignmentWarning, ProjectI18nTranslate, ProjectManualSelectionStats } from "./types";

interface ManualAssignmentWarningDialogProps {
  warning: ManualAssignmentWarning | null;
  stats: ProjectManualSelectionStats;
  t: ProjectI18nTranslate;
  onCancel: () => void;
  onConfirm: (warning: ManualAssignmentWarning) => void;
}

export default function ManualAssignmentWarningDialog({
  warning,
  stats,
  t,
  onCancel,
  onConfirm,
}: ManualAssignmentWarningDialogProps) {
  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[61] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-amber-500/40 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-amber-500/30 px-4 py-3">
          <h3 className="text-sm font-semibold text-amber-200">
            {t({ ko: "", en: "Manual Assignment Check", ja: "手動割り当て確認", zh: "手动分配确认", ru: "Проверка ручного назначения" })}
          </h3>
        </div>
        <div className="space-y-2 px-4 py-4">
          <p className="text-sm text-slate-100">
            {warning.reason === "no_agents"
              ? t({
                  ko: ".         ()   .  ?",
                  en: "No agents are selected. If you save now, the manual-mode safeguard may let team leaders execute tasks directly. Continue?",
                  ja: "エージェントが選択されていません。このまま保存すると実行時にチームリーダーが直接対応する可能性があります。続行しますか？",
                  zh: "当前未选择员工。若继续保存，运行时可能由组长直接执行。是否继续？",
                  ru: "Сотрудники не выбраны. При сохранении руководители групп могут выполнять задачи самостоятельно. Продолжить?",
                })
              : t({
                  ko: ".         ()   .  ?",
                  en: "Only team leaders are selected. Without subordinates, the manual-mode safeguard may let team leaders execute tasks directly. Continue?",
                  ja: "チームリーダーのみ選択されています。サブ担当がいない場合、実行時にチームリーダーが直接対応する可能性があります。続行しますか？",
                  zh: "当前仅选择了组长。若无下属成员，运行时可能由组长直接执行。是否继续？",
                  ru: "Выбраны только руководители групп. Без подчинённых они могут выполнять задачи самостоятельно. Продолжить?",
                })}
          </p>
          <div className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-[11px] text-slate-300">
            <p>
              {t({ ko: "", en: "Selection Summary", ja: "選択サマリー", zh: "选择摘要", ru: "Сводка выбора" })}: {stats.total}
            </p>
            <p>
              {t({ ko: "", en: "Leaders", ja: "リーダー", zh: "组长", ru: "Руководители" })}: {stats.leaders} ·{" "}
              {t({ ko: "", en: "Subordinates", ja: "サブ担当", zh: "下属成员", ru: "Подчинённые" })}: {stats.subordinates}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            {t({ ko: "", en: "Cancel", ja: "キャンセル", zh: "取消", ru: "Отмена" })}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(warning)}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500"
          >
            {t({ ko: "", en: "Save Anyway", ja: "そのまま保存", zh: "仍然保存", ru: "Сохранить всё равно" })}
          </button>
        </div>
      </div>
    </div>
  );
}
