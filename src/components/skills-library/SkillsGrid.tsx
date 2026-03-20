import type { MutableRefObject } from "react";
import type { SkillDetail, SkillHistoryProvider } from "../../api";
import type { Agent } from "../../types";
import AgentAvatar from "../AgentAvatar";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  categoryLabel,
  cliProviderIcon,
  formatFirstSeen,
  getRankBadge,
  learnedProviderLabel,
  localizeAuditStatus,
  type CategorizedSkill,
  type TFunction,
} from "./model";

interface SkillsGridProps {
  t: TFunction;
  localeTag: string;
  agents: Agent[];
  filtered: CategorizedSkill[];
  learnedProvidersBySkill: Map<string, SkillHistoryProvider[]>;
  learnedRepresentatives: Map<SkillHistoryProvider, Agent | null>;
  hoveredSkill: string | null;
  setHoveredSkill: (key: string | null) => void;
  detailCache: Record<string, SkillDetail | "loading" | "error">;
  tooltipRef: MutableRefObject<HTMLDivElement | null>;
  hoverTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  copiedSkill: string | null;
  onHoverEnter: (skill: CategorizedSkill) => void;
  onHoverLeave: () => void;
  onOpenLearningModal: (skill: CategorizedSkill) => void;
  onCopy: (skill: CategorizedSkill) => void;
}

export default function SkillsGrid({
  t,
  localeTag,
  agents,
  filtered,
  learnedProvidersBySkill,
  learnedRepresentatives,
  hoveredSkill,
  setHoveredSkill,
  detailCache,
  tooltipRef,
  hoverTimerRef,
  copiedSkill,
  onHoverEnter,
  onHoverLeave,
  onOpenLearningModal,
  onCopy,
}: SkillsGridProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((skill) => {
          const badge = getRankBadge(skill.rank);
          const catColor = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.Other;
          const detailId = skill.skillId || skill.name;
          const detailKey = `${skill.repo}/${detailId}`;
          const learnedProviders = learnedProvidersBySkill.get(detailKey) ?? [];
          const learnedProvidersForCard = learnedProviders.slice(0, 4);
          const isHovered = hoveredSkill === detailKey;
          const detail = detailCache[detailKey];

          return (
            <div
              key={`${skill.rank}-${detailId}`}
              className="relative bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all group"
              onMouseEnter={() => onHoverEnter(skill)}
              onMouseLeave={onHoverLeave}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/60 text-sm font-bold">
                    {badge.icon ? <span>{badge.icon}</span> : <span className={badge.color}>#{skill.rank}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{skill.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{skill.repo}</div>
                  </div>
                </div>

                {learnedProvidersForCard.length > 0 && (
                  <div className="grid w-[64px] shrink-0 grid-cols-2 gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-1">
                    {learnedProvidersForCard.map((provider) => {
                      const agent = learnedRepresentatives.get(provider) ?? null;
                      return (
                        <span
                          key={`${detailKey}-${provider}`}
                          className="inline-flex h-5 w-6 items-center justify-center gap-0.5 rounded-md border border-emerald-500/20 bg-slate-900/70"
                          title={`${learnedProviderLabel(provider)}${agent ? ` · ${agent.name}` : ""}`}
                        >
                          <span className="flex h-2.5 w-2.5 items-center justify-center">
                            {cliProviderIcon(provider)}
                          </span>
                          <span className="h-2.5 w-2.5 overflow-hidden rounded-[3px] bg-slate-800/80">
                            <AgentAvatar agent={agent ?? undefined} agents={agents} size={10} rounded="xl" />
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${catColor}`}>
                  {CATEGORY_ICONS[skill.category]} {categoryLabel(skill.category, t)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">
                    <span className="text-empire-green font-medium">{skill.installsDisplay}</span>{" "}
                    {t({ ko: "", en: "installs", ja: "インストール", zh: "安装", ru: "установок" })}
                  </span>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onOpenLearningModal(skill)}
                      className="px-2 py-1 text-[10px] bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-md hover:bg-emerald-600/30 transition-all"
                      title={t({
                        ko: "CLI",
                        en: "Teach this skill to selected CLI leaders",
                        ja: "選択したCLI代表にこのスキルを学習させる",
                        zh: "让所选 CLI 代表学习此技能",
                        ru: "Обучить выбранных CLI-лидеров этому навыку",
                      })}
                    >
                      {t({ ko: "", en: "Learn", ja: "学習", zh: "学习", ru: "Изучить" })}
                    </button>
                    <button
                      onClick={() => onCopy(skill)}
                      className="px-2 py-1 text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-600/30 transition-all"
                      title={`npx skills add ${skill.repo}`}
                    >
                      {copiedSkill === skill.name
                        ? t({ ko: "", en: "Copied", ja: "コピー済み", zh: "已复制", ru: "Скопировано" })
                        : t({ ko: "", en: "Copy", ja: "コピー", zh: "复制", ru: "Копировать" })}
                    </button>
                  </div>
                </div>
              </div>

              {isHovered && (
                <div
                  ref={tooltipRef}
                  className="absolute z-50 left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-md border border-slate-600/60 rounded-xl p-4 shadow-2xl shadow-black/40 animate-in fade-in slide-in-from-top-1 duration-200"
                  onMouseEnter={() => {
                    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                    setHoveredSkill(detailKey);
                  }}
                  onMouseLeave={onHoverLeave}
                >
                  {detail === "loading" && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full" />
                      {t({
                        ko: "...",
                        en: "Loading details...",
                        ja: "詳細を読み込み中...",
                        zh: "加载详情...",
                        ru: "Загрузка деталей...",
                      })}
                    </div>
                  )}

                  {detail === "error" && (
                    <div className="text-slate-500 text-xs">
                      {t({
                        ko: "",
                        en: "Could not load details",
                        ja: "詳細を読み込めません",
                        zh: "无法加载详情",
                        ru: "Не удалось загрузить детали",
                      })}
                    </div>
                  )}

                  {detail && typeof detail === "object" && (
                    <div className="space-y-3">
                      {detail.title && <div className="text-sm font-semibold text-white">{detail.title}</div>}

                      {detail.description && (
                        <p className="text-xs text-slate-300 leading-relaxed">{detail.description}</p>
                      )}

                      {detail.whenToUse.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                            {t({ ko: "", en: "When to Use", ja: "使うタイミング", zh: "适用场景", ru: "Когда использовать" })}
                          </div>
                          <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
                            {detail.whenToUse.slice(0, 6).map((item, idx) => (
                              <li key={`${detailKey}-when-${idx}`}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 text-[11px]">
                        {detail.weeklyInstalls && (
                          <span className="text-slate-400">
                            <span className="text-empire-green font-medium">{detail.weeklyInstalls}</span>{" "}
                            {t({ ko: "", en: "weekly", ja: "週間", zh: "周安装", ru: "в неделю" })}
                          </span>
                        )}
                        {detail.firstSeen && (
                          <span className="text-slate-500">
                            {t({ ko: "", en: "First seen", ja: "初登録", zh: "首次发现", ru: "Впервые замечен" })}:{" "}
                            {formatFirstSeen(detail.firstSeen, localeTag)}
                          </span>
                        )}
                      </div>

                      {detail.platforms.length > 0 && (
                        <div>
                          <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">
                            {t({
                              ko: "",
                              en: "Platform Installs",
                              ja: "プラットフォーム別",
                              zh: "平台安装量",
                              ru: "Установки по платформам",
                            })}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {detail.platforms.slice(0, 6).map((platform) => (
                              <span
                                key={platform.name}
                                className="text-[10px] px-2 py-0.5 bg-slate-800/80 border border-slate-700/50 rounded-md text-slate-400"
                              >
                                {platform.name} <span className="text-empire-green">{platform.installs}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {detail.audits.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {detail.audits.map((audit) => (
                            <span
                              key={audit.name}
                              className={`text-[10px] px-2 py-0.5 rounded-md border ${
                                audit.status.toLowerCase() === "pass"
                                  ? "text-green-400 bg-green-500/10 border-green-500/30"
                                  : audit.status.toLowerCase() === "warn" || audit.status.toLowerCase() === "pending"
                                    ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                                    : "text-red-400 bg-red-500/10 border-red-500/30"
                              }`}
                            >
                              {audit.name}: {localizeAuditStatus(audit.status, t)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-500 font-mono bg-slate-800/60 rounded-md px-2 py-1.5 truncate">
                        $ {detail.installCommand}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-slate-400 text-sm">
            {t({ ko: "", en: "No search results", ja: "検索結果はありません", zh: "没有搜索结果", ru: "Результаты не найдены" })}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            {t({
              ko: "",
              en: "Try a different keyword",
              ja: "別のキーワードで検索してください",
              zh: "请尝试其他关键词",
              ru: "Попробуйте другое ключевое слово",
            })}
          </div>
        </div>
      )}
    </>
  );
}
