import type { Lang } from "../../../types/lang.ts";
import type { L10n } from "./language-policy.ts";

interface MessageDeps {
  l: (ko: string[], en: string[], ja?: string[], zh?: string[], ru?: string[]) => L10n;
  pickL: (pool: L10n, lang: Lang) => string;
}

interface LeaderAckParams extends MessageDeps {
  lang: Lang;
  subRole: string;
  subName: string;
  skipPlannedMeeting: boolean;
  isPlanningLead: boolean;
  crossDeptNames: string;
}

interface DelegateMessageParams extends MessageDeps {
  lang: Lang;
  subName: string;
  ceoMessage: string;
}

interface SubordinateAckParams extends MessageDeps {
  lang: Lang;
  leaderRole: string;
  leaderName: string;
}

interface SelfMessageParams extends MessageDeps {
  lang: Lang;
  skipPlannedMeeting: boolean;
}

interface ManualFallbackNoticeParams extends MessageDeps {
  lang: Lang;
  leaderName: string;
}

export function buildLeaderAckMessage(params: LeaderAckParams): string {
  const { l, pickL, lang, subRole, subName, skipPlannedMeeting, isPlanningLead, crossDeptNames } = params;

  if (skipPlannedMeeting && isPlanningLead && crossDeptNames) {
    return pickL(
      l(
        [
          `Understood. We'll skip the leaders' planning meeting, coordinate quickly with ${crossDeptNames}, then delegate immediately to ${subRole} ${subName}. 📋`,
        ],
        [
          `Understood. We'll skip the leaders' planning meeting, coordinate quickly with ${crossDeptNames}, then delegate immediately to ${subRole} ${subName}. 📋`,
        ],
        [
          `了解しました。リーダー計画会議は省略し、${crossDeptNames} と事前調整後に ${subRole} ${subName} へ即時委任します。📋`,
        ],
        [`收到。将跳过负责人规划会议，先与${crossDeptNames}快速协同后立即下达给${subRole} ${subName}。📋`],
        [`Понял. Пропускаем совещание тимлидов, быстро согласуем с ${crossDeptNames} и сразу делегируем ${subRole} ${subName}. 📋`],
      ),
      lang,
    );
  }

  if (skipPlannedMeeting && crossDeptNames) {
    return pickL(
      l(
        [
          `Understood. We'll skip the planning meeting, delegate directly to ${subRole} ${subName}, and coordinate with ${crossDeptNames} in parallel. 📋`,
        ],
        [
          `Understood. We'll skip the planning meeting, delegate directly to ${subRole} ${subName}, and coordinate with ${crossDeptNames} in parallel. 📋`,
        ],
        [
          `了解しました。計画会議なしで ${subRole} ${subName} へ直ちに委任し、${crossDeptNames} との協業を並行します。📋`,
        ],
        [`收到。跳过规划会议，直接下达给${subRole} ${subName}，并并行推进${crossDeptNames}协作。📋`],
        [`Понял. Пропускаем совещание, делегируем напрямую ${subRole} ${subName} и параллельно синхронизируемся с ${crossDeptNames}. 📋`],
      ),
      lang,
    );
  }

  if (skipPlannedMeeting) {
    return pickL(
      l(
        [`Understood. We'll skip the leaders'planning meeting and delegate immediately to ${subRole} ${subName}. 📋`],
        [`Understood. We'll skip the leaders'planning meeting and delegate immediately to ${subRole} ${subName}. 📋`],
        [`了解しました。リーダー計画会議は省略し、${subRole} ${subName} へ即時委任します。📋`],
        [`收到。将跳过负责人规划会议，立即下达给${subRole} ${subName}。📋`],
        [`Понял. Пропускаем совещание тимлидов и сразу делегируем ${subRole} ${subName}. 📋`],
      ),
      lang,
    );
  }

  if (isPlanningLead && crossDeptNames) {
    return pickL(
      l(
        [
          `Understood. I'll first confirm related departments (${crossDeptNames}), finish cross-team pre-processing, then delegate to ${subRole} ${subName}. 📋`,
        ],
        [
          `Understood. I'll first confirm related departments (${crossDeptNames}), finish cross-team pre-processing, then delegate to ${subRole} ${subName}. 📋`,
        ],
        [
          `了解しました。まず関連部門（${crossDeptNames}）を確定し、先行協業完了後に${subRole} ${subName}へ委任します。📋`,
        ],
        [`收到。先确认相关部门（${crossDeptNames}）并完成前置协作后，再下达给${subRole} ${subName}。📋`],
        [`Понял. Сначала уточняю связанные отделы (${crossDeptNames}), завершаю межкомандную подготовку и делегирую ${subRole} ${subName}. 📋`],
      ),
      lang,
    );
  }

  if (crossDeptNames) {
    return pickL(
      l(
        [
          `Understood. We'll run the team-lead planning meeting first, then delegate to ${subRole} ${subName} and coordinate with ${crossDeptNames}. 📋`,
          `Got it. After the leaders' planning meeting, I'll assign ${subName} and sync with ${crossDeptNames}. 🤝`,
        ],
        [
          `Understood. We'll run the team-lead planning meeting first, then delegate to ${subRole} ${subName} and coordinate with ${crossDeptNames}. 📋`,
          `Got it. After the leaders' planning meeting, I'll assign ${subName} and sync with ${crossDeptNames}. 🤝`,
        ],
        [
          `了解しました。まずチームリーダー計画会議を行い、その後 ${subRole} ${subName} へ委任し、${crossDeptNames} との協業も調整します。📋`,
        ],
        [`收到。先进行团队负责人规划会议，再下达给${subRole} ${subName}，并协调${crossDeptNames}协作。📋`],
        [
          `Понял. Сначала проведём совещание тимлидов, затем назначу ${subRole} ${subName} и синхронизируюсь с ${crossDeptNames}. 📋`,
          `Принято. После совещания назначу ${subName} и скоординируюсь с ${crossDeptNames}. 🤝`,
        ],
      ),
      lang,
    );
  }

  return pickL(
    l(
      [
        `Understood. I'll convene the team-lead planning meeting first, then assign to ${subRole} ${subName} after the planning output is finalized. 📋`,
        `Got it. ${subName} is the best fit, and I'll delegate in sequence after the leaders' planning meeting concludes.`,
        `Confirmed. After the leaders' planning meeting, I'll hand this off to ${subName} and manage execution.`,
      ],
      [
        `Understood. I'll convene the team-lead planning meeting first, then assign to ${subRole} ${subName} after the planning output is finalized. 📋`,
        `Got it. ${subName} is the best fit, and I'll delegate in sequence after the leaders' planning meeting concludes.`,
        `Confirmed. After the leaders' planning meeting, I'll hand this off to ${subName} and manage execution.`,
      ],
      [
        `了解しました。まずチームリーダー計画会議を招集し、会議結果整理後に ${subRole} ${subName} へ委任します。📋`,
        `承知しました。${subName} が最適任なので、会議終了後に順次指示します。`,
      ],
      [
        `收到。先召集团队负责人规划会议，整理结论后再分配给${subRole} ${subName}。📋`,
        `明白。${subName}最合适，会在会议结束后按顺序下达。`,
      ],
      [
        `Понял. Сначала созываю совещание тимлидов, после итогов назначу задачу ${subRole} ${subName}. 📋`,
        `Принято. ${subName} — лучший кандидат, назначу после совещания.`,
        `Подтверждено. После совещания тимлидов передам ${subName} и буду управлять выполнением.`,
      ],
    ),
    lang,
  );
}

export function buildDelegateMessage(params: DelegateMessageParams): string {
  const { l, pickL, lang, subName, ceoMessage } = params;
  return pickL(
    l(
      [
        `${subName}, directive from the CEO: "${ceoMessage}" — please handle this!`,
        `${subName}! Priority task: "${ceoMessage}" — needs immediate attention.`,
        `${subName}, new assignment: "${ceoMessage}" — keep me posted on progress 👍`,
      ],
      [
        `${subName}, directive from the CEO: "${ceoMessage}" — please handle this!`,
        `${subName}! Priority task: "${ceoMessage}" — needs immediate attention.`,
        `${subName}, new assignment: "${ceoMessage}" — keep me posted on progress 👍`,
      ],
      [
        `${subName}、CEOからの指示だよ。"${ceoMessage}" — 確認して進めて！`,
        `${subName}！優先タスク: "${ceoMessage}" — よろしく頼む 👍`,
      ],
      [
        `${subName}，CEO的指示："${ceoMessage}" — 请跟进处理！`,
        `${subName}！优先任务："${ceoMessage}" — 随时更新进度 👍`,
      ],
      [
        `${subName}, задание от директора: "${ceoMessage}" — займись этим!`,
        `${subName}! Приоритетная задача: "${ceoMessage}" — нужно сделать срочно.`,
        `${subName}, новое задание: "${ceoMessage}" — держи в курсе прогресса 👍`,
      ],
    ),
    lang,
  );
}

export function buildSubordinateAckMessage(params: SubordinateAckParams): string {
  const { l, pickL, lang, leaderRole, leaderName } = params;
  return pickL(
    l(
      [
        `Yes, ${leaderName}! Confirmed. Starting right away! 💪`,
        `Got it! On it now. I'll keep you updated on progress.`,
        `Confirmed, ${leaderName}! I'll give it my best 🔥`,
      ],
      [
        `Yes, ${leaderName}! Confirmed. Starting right away! 💪`,
        `Got it! On it now. I'll keep you updated on progress.`,
        `Confirmed, ${leaderName}! I'll give it my best 🔥`,
      ],
      [`はい、${leaderName}さん！了解しました。すぐ取りかかります！💪`, `承知しました！進捗共有します 🔥`],
      [`好的，${leaderName}！收到，马上开始！💪`, `明白了！会及时汇报进度 🔥`],
      [
        `Понял, ${leaderName}! Принято. Приступаю прямо сейчас! 💪`,
        `Есть! Работаю. Буду держать в курсе прогресса.`,
        `Принято, ${leaderName}! Сделаю всё возможное 🔥`,
      ],
    ),
    lang,
  );
}

export function buildSelfExecutionMessage(params: SelfMessageParams): string {
  const { l, pickL, lang, skipPlannedMeeting } = params;
  if (skipPlannedMeeting) {
    return pickL(
      l(
        [
          `Understood. We'll skip the leaders' planning meeting and I'll execute this directly right away since no assignee is available. 💪`,
        ],
        [
          `Understood. We'll skip the leaders' planning meeting and I'll execute this directly right away since no assignee is available. 💪`,
        ],
        [`了解しました。リーダー計画会議は省略し、空き要員がいないため私が即時対応します。💪`],
        [`收到。将跳过负责人规划会议，因无可用成员由我立即亲自处理。💪`],
      ),
      lang,
    );
  }
  return pickL(
    l(
      [
        `Understood. We'll complete the team-lead planning meeting first, and since no one is available I'll execute it myself after the plan is organized. 💪`,
        `Got it. I'll proceed personally after the leaders' planning meeting.`,
      ],
      [
        `Understood. We'll complete the team-lead planning meeting first, and since no one is available I'll execute it myself after the plan is organized. 💪`,
        `Got it. I'll proceed personally after the leaders' planning meeting.`,
      ],
      [`了解しました。まずチームリーダー計画会議を行い、空き要員がいないため会議整理後は私が直接対応します。💪`],
      [`收到。先进行团队负责人规划会议，因无可用成员，会议整理后由我亲自执行。💪`],
    ),
    lang,
  );
}

export function buildManualFallbackNotice(params: ManualFallbackNoticeParams): string {
  const { l, pickL, lang, leaderName } = params;
  return pickL(
    l(
      [
        `[CEO OFFICE] Manual assignment safeguard applied: no eligible subordinate in assigned agents, so team leader (${leaderName}) will execute directly.`,
      ],
      [
        `[CEO OFFICE] Manual assignment safeguard applied: no eligible subordinate in assigned agents, so team leader (${leaderName}) will execute directly.`,
      ],
      [
        `[CEO OFFICE] 手動割り当ての安全装置を適用: 指定エージェントに実行可能なサブ担当がいないため、チームリーダー (${leaderName}) が直接実行します。`,
      ],
      [`[CEO OFFICE] 已应用手动分配安全机制：指定员工中无可执行的下属成员，由组长（${leaderName}）直接执行。`],
      [`[CEO OFFICE] Применена защита ручного назначения: среди указанных агентов нет подходящего подчинённого, поэтому тимлид (${leaderName}) выполнит задачу напрямую.`],
    ),
    lang,
  );
}
