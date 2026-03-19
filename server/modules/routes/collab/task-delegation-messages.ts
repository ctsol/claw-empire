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
          `네, 대표님! 팀장 계획 회의는 생략하고 ${crossDeptNames} 유관부서 사전 조율 후 ${subRole} ${subName}에게 즉시 하달하겠습니다. 📋`,
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
          `네, 대표님! 팀장 계획 회의 없이 바로 ${subRole} ${subName}에게 하달하고 ${crossDeptNames} 협업을 병행하겠습니다. 📋`,
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
        [`네, 대표님! 팀장 계획 회의는 생략하고 ${subRole} ${subName}에게 즉시 하달하겠습니다. 📋`],
        [`Understood. We'll skip the leaders' planning meeting and delegate immediately to ${subRole} ${subName}. 📋`],
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
          `네, 대표님! 먼저 ${crossDeptNames} 유관부서 목록을 확정하고 회의/선행 협업을 완료한 뒤 ${subRole} ${subName}에게 하달하겠습니다. 📋`,
          `알겠습니다! 기획팀에서 유관부서 선처리까지 마친 뒤 ${subName}에게 최종 하달하겠습니다.`,
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
          `네, 대표님! 먼저 팀장 계획 회의를 진행한 뒤 ${subRole} ${subName}에게 하달하고, ${crossDeptNames} 협업도 연계하겠습니다. 📋`,
          `알겠습니다! 팀장 계획 회의에서 착수안 정리 완료 후 ${subName} 배정과 ${crossDeptNames} 협업 조율을 진행하겠습니다 🤝`,
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
        `네, 대표님! 먼저 팀장 계획 회의를 소집하고, 회의 결과 정리 후 ${subRole} ${subName}에게 하달하겠습니다. 📋`,
        `알겠습니다! 우리 팀 ${subName}가 적임자이며, 팀장 계획 회의 종료 후 순차적으로 지시하겠습니다.`,
        `확인했습니다, 대표님! 팀장 계획 회의 후 ${subName}에게 전달하고 진행 관리하겠습니다.`,
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
        `${subName}, 대표님 지시사항이야. "${ceoMessage}" — 확인하고 진행해줘!`,
        `${subName}! 긴급 업무야. "${ceoMessage}" — 우선순위 높게 처리 부탁해.`,
        `${subName}, 새 업무 할당이야: "${ceoMessage}" — 진행 상황 수시로 공유해줘 👍`,
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
        `네, ${leaderRole} ${leaderName}님! 확인했습니다. 바로 착수하겠습니다! 💪`,
        `알겠습니다! 바로 시작하겠습니다. 진행 상황 공유 드리겠습니다.`,
        `확인했습니다, ${leaderName}님! 최선을 다해 처리하겠습니다 🔥`,
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
        [`네, 대표님! 팀장 계획 회의는 생략하고 팀 내 가용 인력이 없어 제가 즉시 직접 처리하겠습니다. 💪`],
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
        `네, 대표님! 먼저 팀장 계획 회의를 진행하고, 팀 내 가용 인력이 없어 회의 정리 후 제가 직접 처리하겠습니다. 💪`,
        `알겠습니다! 팀장 계획 회의 완료 후 제가 직접 진행하겠습니다.`,
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
        `[CEO OFFICE] 수동 배정 안전장치 적용: 지정 직원 중 실행 가능한 하위 직원이 없어 팀장(${leaderName})이 직접 수행합니다.`,
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
