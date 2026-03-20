import type { ProjectDecisionEventItem } from "../../api";
import type { ProjectI18nTranslate } from "./types";

export function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "-";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

export function getDecisionEventLabel(
  eventType: ProjectDecisionEventItem["event_type"],
  t: ProjectI18nTranslate,
): string {
  switch (eventType) {
    case "planning_summary":
      return t({ ko: "", en: "Planning Summary", ja: "企画要約", zh: "规划摘要", ru: "Сводка планирования" });
    case "representative_pick":
      return t({ ko: "", en: "Representative Pick", ja: "代表選択", zh: "代表选择", ru: "Выбор представителя" });
    case "followup_request":
      return t({ ko: "", en: "Follow-up Request", ja: "追加依頼", zh: "追加请求", ru: "Запрос дополнений" });
    case "start_review_meeting":
      return t({ ko: "", en: "Review Meeting Started", ja: "レビュー会議開始", zh: "评审会议开始", ru: "Начало совещания по проверке" });
    default:
      return eventType;
  }
}
