import { useState } from "react";
import { Building2, Users, BookOpen, BarChart3, ClipboardList, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Department, Agent, CompanySettings } from "../types";
import { useI18n, localeName } from "../i18n";

type View = "office" | "agents" | "dashboard" | "tasks" | "skills" | "settings" | "ceo-meeting";

interface SidebarProps {
  currentView: View;
  onChangeView: (v: View) => void;
  departments: Department[];
  agents: Agent[];
  settings: CompanySettings;
  connected: boolean;
}

const NAV_ITEMS: { view: View; lucideIcon: LucideIcon }[] = [
  { view: "office", lucideIcon: Building2 },
  { view: "agents", lucideIcon: Users },
  { view: "skills", lucideIcon: BookOpen },
  { view: "dashboard", lucideIcon: BarChart3 },
  { view: "tasks", lucideIcon: ClipboardList },
  { view: "settings", lucideIcon: Settings2 },
];

export default function Sidebar({ currentView, onChangeView, departments, agents, settings, connected }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { t, locale } = useI18n();
  const workingCount = agents.filter((a) => a.status === "working").length;
  const totalAgents = agents.length;

  const tr = (ko: string, en: string, ja = en, zh = en, ru = en) => t({ ko, en, ja, zh, ru });

  const navLabels: Record<View, string> = {
    office: tr("", "Office", "オフィス", "办公室", "Офис"),
    agents: tr("", "Agents", "社員管理", "员工管理", "Агенты"),
    skills: tr("", "Library", "ライブラリ", "文档库", "Навыки"),
    dashboard: tr("", "Dashboard", "ダッシュボード", "仪表盘", "Дашборд"),
    tasks: tr("", "Tasks", "タスク管理", "任务管理", "Задачи"),
    settings: tr("", "Settings", "設定", "设置", "Настройки"),
    "ceo-meeting": tr("", "Meeting", "会議", "会议", "Совещание"),
  };

  return (
    <aside
      className={`flex h-full flex-col transition-all duration-250 ${collapsed ? "w-14" : "w-52"}`}
      style={{ background: "var(--th-bg-sidebar)", borderRight: "1px solid var(--th-border)" }}
    >
      {/* Logo / Company */}
      <div
        className="flex items-center gap-2.5 px-3 py-3.5"
        style={{ borderBottom: "1px solid var(--th-border)" }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2.5 min-w-0 hover:opacity-85 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative overflow-visible"
            style={{ background: "var(--th-bg-surface)", border: "1px solid var(--th-border)" }}
          >
            <img
              src="/sprites/ceo-lobster.png"
              alt="CEO"
              className="w-7 h-7 object-contain"
              style={{ imageRendering: "pixelated" }}
            />
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] leading-none">👑</span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate leading-tight" style={{ color: "var(--th-text-heading)", letterSpacing: "-0.02em" }}>
                {settings.companyName}
              </div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--th-text-muted)" }}>
                {settings.ceoName}
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            onClick={() => onChangeView(item.view)}
            className={`sidebar-nav-item ${currentView === item.view ? "active" : ""}`}
            title={collapsed ? navLabels[item.view] : undefined}
          >
            <span className="shrink-0 leading-none flex items-center justify-center">
              <item.lucideIcon size={16} />
            </span>
            {!collapsed && <span className="truncate">{navLabels[item.view]}</span>}
          </button>
        ))}
      </nav>

      {/* Department quick stats */}
      {!collapsed && (
        <div className="px-2.5 py-2" style={{ borderTop: "1px solid var(--th-border)" }}>
          <div
            className="text-[10px] uppercase font-semibold mb-1.5 tracking-widest px-1"
            style={{ color: "var(--th-text-muted)" }}
          >
            {tr("", "Departments", "部門", "部门", "Отделы")}
          </div>
          {departments.map((d) => {
            const deptAgents = agents.filter((a) => a.department_id === d.id);
            const working = deptAgents.filter((a) => a.status === "working").length;
            return (
              <div
                key={d.id}
                className="sidebar-dept-row cursor-default"
              >
                <span className="text-[12px]">{d.icon}</span>
                <span className="flex-1 truncate text-[11px]">{localeName(locale, d)}</span>
                <span
                  className="text-[10px] font-medium tabular-nums"
                  style={{ color: working > 0 ? "var(--th-accent-primary)" : "var(--th-text-muted)" }}
                >
                  {working}/{deptAgents.length}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection status */}
      <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderTop: "1px solid var(--th-border)" }}>
        <div
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`}
          style={{ boxShadow: connected ? "0 0 4px rgba(63, 185, 80, 0.6)" : "none" }}
        />
        {!collapsed && (
          <span className="text-[10px] truncate" style={{ color: "var(--th-text-muted)" }}>
            {connected
              ? `${tr("", "Online", "接続中", "已连接", "Онлайн")} · ${workingCount}/${totalAgents} ${tr("", "active", "稼働中", "工作中", "активны")}`
              : tr("", "Offline", "接続なし", "已断开", "Офлайн")}
          </span>
        )}
      </div>
    </aside>
  );
}
