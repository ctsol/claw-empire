import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../../i18n";
import {
  discardTask,
  getTaskDiff,
  getTaskVerifyCommit,
  mergeTask,
  type TaskDiffResult,
  type TaskVerifyCommitResult,
} from "../../api";

interface DiffModalProps {
  taskId: string;
  onClose: () => void;
}

function DiffModal({ taskId, onClose }: DiffModalProps) {
  const { t } = useI18n();
  const [diffData, setDiffData] = useState<TaskDiffResult | null>(null);
  const [verifyData, setVerifyData] = useState<TaskVerifyCommitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([getTaskDiff(taskId), getTaskVerifyCommit(taskId)]).then(([diffResult, verifyResult]) => {
      if (diffResult.status === "fulfilled") {
        const d = diffResult.value;
        if (!d.ok)
          setError(d.error || t({ ko: "", en: "Unknown error", ja: "不明なエラー", zh: "未知错误", ru: "Неизвестная ошибка" }));
        else setDiffData(d);
      } else {
        setError(diffResult.reason instanceof Error ? diffResult.reason.message : String(diffResult.reason));
      }

      if (verifyResult.status === "fulfilled") {
        const v = verifyResult.value;
        if (!v.ok)
          setVerifyError(v.error || t({ ko: "", en: "Verification failed", ja: "検証失敗", zh: "校验失败", ru: "Проверка не пройдена" }));
        else setVerifyData(v);
      } else {
        setVerifyError(
          verifyResult.reason instanceof Error ? verifyResult.reason.message : String(verifyResult.reason),
        );
      }
      setLoading(false);
    });
  }, [taskId, t]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleMerge = useCallback(async () => {
    if (
      !confirm(
        t({
          ko: "?",
          en: "Merge this branch into main?",
          ja: "このブランチを main にマージしますか？",
          zh: "要将此分支合并到 main 吗？",
          ru: "Слить эту ветку в main?",
        }),
      )
    )
      return;
    setMerging(true);
    try {
      const result = await mergeTask(taskId);
      setActionResult(
        result.ok
          ? `${t({ ko: "", en: "Merge completed", ja: "マージ完了", zh: "合并完成", ru: "Слияние выполнено" })}: ${result.message}`
          : `${t({ ko: "", en: "Merge failed", ja: "マージ失敗", zh: "合并失败", ru: "Ошибка слияния" })}: ${result.message}`,
      );
      if (result.ok) setTimeout(onClose, 1500);
    } catch (e: unknown) {
      setActionResult(
        `${t({ ko: "", en: "Error", ja: "エラー", zh: "错误", ru: "Ошибка" })}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setMerging(false);
    }
  }, [taskId, onClose, t]);

  const handleDiscard = useCallback(async () => {
    if (
      !confirm(
        t({
          ko: "?     .",
          en: "Discard all changes in this branch? This action cannot be undone.",
          ja: "このブランチの変更をすべて破棄しますか？この操作は元に戻せません。",
          zh: "要丢弃此分支的所有更改吗？此操作无法撤销。",
          ru: "Отменить все изменения в этой ветке? Это действие нельзя отменить.",
        }),
      )
    )
      return;
    setDiscarding(true);
    try {
      const result = await discardTask(taskId);
      setActionResult(
        result.ok
          ? t({
              ko: ".",
              en: "Branch was discarded.",
              ja: "ブランチを破棄しました。",
              zh: "分支已丢弃。",
              ru: "Ветка была удалена.",
            })
          : `${t({ ko: "", en: "Discard failed", ja: "破棄失敗", zh: "丢弃失败", ru: "Ошибка удаления" })}: ${result.message}`,
      );
      if (result.ok) setTimeout(onClose, 1500);
    } catch (e: unknown) {
      setActionResult(
        `${t({ ko: "", en: "Error", ja: "エラー", zh: "错误", ru: "Ошибка" })}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setDiscarding(false);
    }
  }, [taskId, onClose, t]);

  const verifyToneClass =
    verifyData?.verdict === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : verifyData?.verdict === "dirty_without_commit" || verifyData?.verdict === "commit_but_no_code"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-slate-700 bg-slate-800/70 text-slate-300";

  const verifyVerdictLabel = (() => {
    switch (verifyData?.verdict) {
      case "ok":
        return t({ ko: "", en: "Passed", ja: "成功", zh: "通过", ru: "Пройдено" });
      case "dirty_without_commit":
        return t({ ko: "", en: "Uncommitted changes", ja: "未コミット変更", zh: "未提交变更", ru: "Незафиксированные изменения" });
      case "commit_but_no_code":
        return t({ ko: "", en: "No code changes", ja: "コード変更なし", zh: "无代码变更", ru: "Нет изменений кода" });
      case "no_commit":
        return t({ ko: "", en: "No commit", ja: "コミットなし", zh: "无提交", ru: "Нет коммитов" });
      case "no_worktree":
        return t({ ko: "", en: "No worktree", ja: "ワークツリーなし", zh: "无工作树", ru: "Нет рабочего дерева" });
      default:
        return t({ ko: "", en: "Unknown", ja: "不明", zh: "未知", ru: "Неизвестно" });
    }
  })();

  const commitLabel =
    verifyData && typeof verifyData.commitCount === "number"
      ? t({
          ko: ``,
          en: `${verifyData.commitCount} commit${verifyData.commitCount === 1 ? "" : "s"}`,
          ja: `${verifyData.commitCount}件のコミット`,
          zh: `${verifyData.commitCount} 个提交`,
          ru: `${verifyData.commitCount} коммит(ов)`,
        })
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">
              {t({ ko: "Git", en: "Git Diff", ja: "Git 差分", zh: "Git 差异", ru: "Git Diff" })}
            </span>
            {diffData?.branchName && (
              <span className="rounded-full bg-purple-900 px-2.5 py-0.5 text-xs text-purple-300">
                {diffData.branchName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMerge}
              disabled={merging || discarding || !diffData?.hasWorktree}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-600 disabled:opacity-40"
            >
              {merging ? "..." : t({ ko: "", en: "Merge", ja: "マージ", zh: "合并", ru: "Слить" })}
            </button>
            <button
              onClick={handleDiscard}
              disabled={merging || discarding || !diffData?.hasWorktree}
              className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              {discarding ? "..." : t({ ko: "", en: "Discard", ja: "破棄", zh: "丢弃", ru: "Отменить" })}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title={t({ ko: "", en: "Close", ja: "閉じる", zh: "关闭", ru: "Закрыть" })}
            >
              X
            </button>
          </div>
        </div>

        {/* Action result */}
        {actionResult && (
          <div className="border-b border-slate-700 bg-slate-800 px-5 py-2 text-sm text-amber-300">{actionResult}</div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              {t({
                ko: "...",
                en: "Loading diff...",
                ja: "差分を読み込み中...",
                zh: "正在加载差异...",
                ru: "Загрузка изменений...",
              })}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-400">
              {t({ ko: "", en: "Error", ja: "エラー", zh: "错误", ru: "Ошибка" })}: {error}
            </div>
          ) : !diffData?.hasWorktree ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              {t({
                ko: ". (Git     )",
                en: "No worktree found for this task (non-git project or already merged)",
                ja: "このタスクのワークツリーが見つかりません（Git プロジェクトではない、または既にマージ済み）",
                zh: "找不到该任务的 worktree（非 Git 项目或已合并）",
                ru: "Рабочее дерево для этой задачи не найдено (не Git-проект или уже слито)",
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {verifyData && (
                <div className={`rounded-lg border p-3 ${verifyToneClass}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      {t({
                        ko: "",
                        en: "Final Branch Verification",
                        ja: "最終ブランチ検証",
                        zh: "最终分支校验",
                        ru: "Финальная проверка ветки",
                      })}
                    </h3>
                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs font-medium">
                      {verifyVerdictLabel}
                    </span>
                    {commitLabel && <span className="text-xs opacity-80">{commitLabel}</span>}
                    {verifyData.compareRef && <span className="text-xs opacity-80">base: {verifyData.compareRef}</span>}
                  </div>
                  {verifyData.files && verifyData.files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {verifyData.files.slice(0, 6).map((filePath) => (
                        <span key={filePath} className="rounded bg-black/20 px-2 py-0.5 text-[11px]">
                          {filePath}
                        </span>
                      ))}
                    </div>
                  )}
                  {verifyData.uncommittedFiles && verifyData.uncommittedFiles.length > 0 && (
                    <p className="mt-2 text-xs">
                      {t({
                        ko: ``,
                        en: `${verifyData.uncommittedFiles.length} uncommitted file(s)`,
                        ja: `未コミット変更 ${verifyData.uncommittedFiles.length}件`,
                        zh: `${verifyData.uncommittedFiles.length} 个未提交文件`,
                        ru: `${verifyData.uncommittedFiles.length} незафиксированных файлов`,
                      })}
                    </p>
                  )}
                </div>
              )}
              {verifyError && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {t({
                    ko: "",
                    en: "Branch verification could not be loaded",
                    ja: "ブランチ検証情報を取得できませんでした",
                    zh: "无法加载分支校验信息",
                    ru: "Не удалось загрузить данные проверки ветки",
                  })}
                  : {verifyError}
                </div>
              )}
              {/* Stat summary */}
              {diffData.stat && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-300">
                    {t({ ko: "", en: "Summary", ja: "概要", zh: "摘要", ru: "Сводка" })}
                  </h3>
                  <pre className="rounded-lg bg-slate-800 p-3 text-xs text-slate-300 overflow-x-auto">
                    {diffData.stat}
                  </pre>
                </div>
              )}
              {/* Full diff */}
              {diffData.diff && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-300">
                    {t({ ko: "Diff", en: "Diff", ja: "差分", zh: "差异", ru: "Diff" })}
                  </h3>
                  <pre className="max-h-[50vh] overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed">
                    {diffData.diff.split("\n").map((line, i) => {
                      let cls = "text-slate-400";
                      if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-green-400";
                      else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-red-400";
                      else if (line.startsWith("@@")) cls = "text-cyan-400";
                      else if (line.startsWith("diff ") || line.startsWith("index ")) cls = "text-slate-500 font-bold";
                      return (
                        <span key={i} className={cls}>
                          {line}
                          {"\n"}
                        </span>
                      );
                    })}
                  </pre>
                </div>
              )}
              {!diffData.stat && !diffData.diff && (
                <div className="text-center text-slate-500 py-8">
                  {t({
                    ko: "",
                    en: "No changes detected",
                    ja: "変更はありません",
                    zh: "未检测到更改",
                    ru: "Изменения не обнаружены",
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DiffModal;
