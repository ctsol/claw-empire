import type { Lang } from "../../../types/lang.ts";
import type { L10n } from "./language-policy.ts";

interface MessageDeps {
  l: (ko: string[], en: string[], ja?: string[], zh?: string[], ru?: string[]) => L10n;
  pickL: (pool: L10n, lang: Lang) => string;
}

interface QueueProgressParams extends MessageDeps {
  lang: Lang;
  targetDeptName: string;
  queueIndex: number;
  queueTotal: number;
  itemCount: number;
}

interface OriginRequestParams extends MessageDeps {
  lang: Lang;
  crossLeaderName: string;
  parentTitle: string;
  itemCount: number;
  batchTitle: string;
}

interface CrossLeaderAckParams extends MessageDeps {
  lang: Lang;
  hasSubordinate: boolean;
  originLeaderName: string;
  itemCount: number;
  batchTitle: string;
  execName: string;
}

interface DelegatedDescriptionParams extends MessageDeps {
  lang: Lang;
  sourceDeptName: string;
  parentSummary: string;
  delegatedChecklist: string;
}

interface ExecutionStartParams extends MessageDeps {
  lang: Lang;
  targetDeptName: string;
  execName: string;
  itemCount: number;
  worktreeCeoNote: string;
}

export function teamLeadFallbackLabel(deps: MessageDeps, lang: Lang): string {
  return deps.pickL(deps.l(["Team Lead"], ["Team Lead"], ["チームリーダー"], ["组长"], ["Тимлид"]), lang);
}

export function buildQueueProgressNotice(params: QueueProgressParams): string {
  const { l, pickL, lang, targetDeptName, queueIndex, queueTotal, itemCount } = params;
  return pickL(
    l(
      [
        `Batched subtask delegation in progress: ${targetDeptName} (${queueIndex + 1}/${queueTotal}, ${itemCount} item(s))`,
      ],
      [
        `Batched subtask delegation in progress: ${targetDeptName} (${queueIndex + 1}/${queueTotal}, ${itemCount} item(s))`,
      ],
      [`サブタスク一括委任進行中: ${targetDeptName} (${queueIndex + 1}/${queueTotal}, ${itemCount}件)`],
      [`批量 SubTask 委派进行中：${targetDeptName}（${queueIndex + 1}/${queueTotal}，${itemCount}项）`],
      [`Пакетная делегация подзадач: ${targetDeptName} (${queueIndex + 1}/${queueTotal}, ${itemCount} шт.)`],
    ),
    lang,
  );
}

export function buildOriginRequestMessage(params: OriginRequestParams): string {
  const { l, pickL, lang, crossLeaderName, parentTitle, itemCount, batchTitle } = params;
  return pickL(
    l(
      [
        `${crossLeaderName}, please process ${itemCount} subtasks (${batchTitle}) for '${parentTitle}' as one sequential checklist in a single run. 🤝`,
      ],
      [
        `${crossLeaderName}, please process ${itemCount} subtasks (${batchTitle}) for '${parentTitle}' as one sequential checklist in a single run. 🤝`,
      ],
      [
        `${crossLeaderName}さん、'${parentTitle}' のサブタスク${itemCount}件（${batchTitle}）を順次チェックリストで一括対応お願いします！🤝`,
      ],
      [`${crossLeaderName}，请将'${parentTitle}'的 ${itemCount} 个 SubTask（${batchTitle}）按顺序清单一次性处理！🤝`],
      [
        `${crossLeaderName}, пожалуйста, обработай ${itemCount} подзадач (${batchTitle}) по проекту '${parentTitle}' в виде единого последовательного чеклиста! 🤝`,
      ],
    ),
    lang,
  );
}

export function buildCrossLeaderAckMessage(params: CrossLeaderAckParams): string {
  const { l, pickL, lang, hasSubordinate, originLeaderName, itemCount, batchTitle, execName } = params;
  if (hasSubordinate) {
    return pickL(
      l(
        [
          `Got it, ${originLeaderName}! I'll assign ${itemCount} items (${batchTitle}) to ${execName} as one ordered batch. 👍`,
        ],
        [
          `Got it, ${originLeaderName}! I'll assign ${itemCount} items (${batchTitle}) to ${execName} as one ordered batch. 👍`,
        ],
        [
          `了解です、${originLeaderName}さん！${itemCount}件（${batchTitle}）を${execName}に一括割り当てて順次対応します 👍`,
        ],
        [`收到，${originLeaderName}！将把 ${itemCount} 项（${batchTitle}）批量分配给 ${execName} 按顺序处理 👍`],
        [
          `Понял, ${originLeaderName}! Назначу ${execName} ${itemCount} задач (${batchTitle}) одним пакетом по порядку 👍`,
        ],
      ),
      lang,
    );
  }

  return pickL(
    l(
      [`Understood, ${originLeaderName}! I'll handle ${itemCount} items (${batchTitle}) myself in order. 👍`],
      [`Understood, ${originLeaderName}! I'll handle ${itemCount} items (${batchTitle}) myself in order. 👍`],
      [`承知しました、${originLeaderName}さん！${itemCount}件（${batchTitle}）を私が順次対応します 👍`],
      [`明白，${originLeaderName}！这 ${itemCount} 项（${batchTitle}）由我按顺序亲自处理 👍`],
      [`Понял, ${originLeaderName}! Обработаю ${itemCount} задач (${batchTitle}) сам по порядку 👍`],
    ),
    lang,
  );
}

export function buildDelegatedTitle(deps: MessageDeps, lang: Lang, itemCount: number, batchTitle: string): string {
  return deps.pickL(
    deps.l(
      [`[Batched Subtask Collaboration x${itemCount}] ${batchTitle}`],
      [`[Batched Subtask Collaboration x${itemCount}] ${batchTitle}`],
      [`[サブタスク一括協業 x${itemCount}] ${batchTitle}`],
      [`[批量 SubTask 协作 x${itemCount}] ${batchTitle}`],
      [`[Пакетная работа x${itemCount}] ${batchTitle}`],
    ),
    lang,
  );
}

export function buildDelegatedDescription(params: DelegatedDescriptionParams): string {
  const { l, pickL, lang, sourceDeptName, parentSummary, delegatedChecklist } = params;
  return pickL(
    l(
      [`[Subtasks delegated from ${sourceDeptName}] ${parentSummary}\n\n[Sequential checklist]\n${delegatedChecklist}`],
      [`[Subtasks delegated from ${sourceDeptName}] ${parentSummary}\n\n[Sequential checklist]\n${delegatedChecklist}`],
      [`[サブタスク委任元 ${sourceDeptName}] ${parentSummary}\n\n[順次チェックリスト]\n${delegatedChecklist}`],
      [`[SubTask 委派来源 ${sourceDeptName}] ${parentSummary}\n\n[顺序清单]\n${delegatedChecklist}`],
      [`[Подзадачи от ${sourceDeptName}] ${parentSummary}\n\n[Последовательный чеклист]\n${delegatedChecklist}`],
    ),
    lang,
  );
}

export function buildWorktreeCeoNote(
  deps: MessageDeps,
  lang: Lang,
  delegatedTaskId: string,
  hasWorktree: boolean,
): string {
  if (!hasWorktree) return "";
  return deps.pickL(
    deps.l(
      [` (isolated branch: climpire/${delegatedTaskId.slice(0, 8)})`],
      [` (isolated branch: climpire/${delegatedTaskId.slice(0, 8)})`],
      [` (分離ブランチ: climpire/${delegatedTaskId.slice(0, 8)})`],
      [`（隔离分支: climpire/${delegatedTaskId.slice(0, 8)}）`],
      [` (изолированная ветка: climpire/${delegatedTaskId.slice(0, 8)})`],
    ),
    lang,
  );
}

export function buildExecutionStartNotice(params: ExecutionStartParams): string {
  const { l, pickL, lang, targetDeptName, execName, itemCount, worktreeCeoNote } = params;
  return pickL(
    l(
      [`${targetDeptName} ${execName} started one batched run for ${itemCount} subtasks.${worktreeCeoNote}`],
      [`${targetDeptName} ${execName} started one batched run for ${itemCount} subtasks.${worktreeCeoNote}`],
      [`${targetDeptName}の${execName}がサブタスク${itemCount}件の一括作業を開始しました。${worktreeCeoNote}`],
      [`${targetDeptName} 的 ${execName} 已开始 ${itemCount} 个 SubTask 的批量处理。${worktreeCeoNote}`],
      [`${targetDeptName} ${execName} запустил пакетную обработку ${itemCount} подзадач.${worktreeCeoNote}`],
    ),
    lang,
  );
}
