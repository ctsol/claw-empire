import {
  BarChart3,
  Code2,
  Palette,
  FlaskConical,
  ShieldCheck,
  Settings2,
  Cigarette,
  Monitor,
  type LucideIcon,
} from "lucide-react";

interface DeptIconDef {
  Icon: LucideIcon;
  color: string;
  bg: string;
}

const DEPT_ICONS: Record<string, DeptIconDef> = {
  planning:   { Icon: BarChart3,     color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  dev:        { Icon: Code2,         color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  design:     { Icon: Palette,       color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
  qa:         { Icon: FlaskConical,  color: "#ef4444", bg: "rgba(239,68,68,0.15)"  },
  devsecops:  { Icon: ShieldCheck,   color: "#f97316", bg: "rgba(249,115,22,0.15)" },
  operations: { Icon: Settings2,     color: "#10b981", bg: "rgba(16,185,129,0.15)" },
};

interface DeptIconProps {
  /** Department id (planning, dev, design, qa, devsecops, operations) */
  deptId: string;
  /** Fallback emoji if dept not recognized */
  fallback?: string;
  size?: number;
  /** If true, shows colored icon without background pill */
  plain?: boolean;
  className?: string;
}

export default function DeptIcon({ deptId, fallback, size = 16, plain = false, className = "" }: DeptIconProps) {
  const def = DEPT_ICONS[deptId];

  if (!def) {
    // For the smoking area room icon
    if (deptId === "break_room") {
      return plain ? (
        <Cigarette size={size} color="#94a3b8" className={className} />
      ) : (
        <span
          className={`inline-flex items-center justify-center rounded ${className}`}
          style={{ background: "rgba(148,163,184,0.15)", width: size + 6, height: size + 6 }}
        >
          <Cigarette size={size} color="#94a3b8" />
        </span>
      );
    }
    return <span className={className}>{fallback ?? "🏢"}</span>;
  }

  const { Icon, color, bg } = def;

  if (plain) {
    return <Icon size={size} color={color} className={className} />;
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded ${className}`}
      style={{ background: bg, width: size + 6, height: size + 6 }}
    >
      <Icon size={size} color={color} strokeWidth={2} />
    </span>
  );
}
