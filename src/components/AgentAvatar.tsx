import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { Agent } from "../types";
import { generateAvatar, generateAvatarSvg } from "./avatar-generator";

/** Map agent IDs to sprite numbers (stable order, same as OfficeView) */
export function buildSpriteMap(agents: Agent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of agents) {
    if (a.sprite_number != null && a.sprite_number > 0) map.set(a.id, a.sprite_number);
  }
  const doro = agents.find((a) => a.name === "DORO");
  if (doro && !map.has(doro.id)) map.set(doro.id, 13);
  const rest = [...agents].filter((a) => !map.has(a.id)).sort((a, b) => a.id.localeCompare(b.id));
  rest.forEach((a, i) => map.set(a.id, (i % 12) + 1));
  return map;
}

/** Hook: memoized sprite map from agents array */
export function useSpriteMap(agents: Agent[]): Map<string, number> {
  return useMemo(() => buildSpriteMap(agents), [agents]);
}

/** Get the sprite number for an agent by ID */
export function getSpriteNum(agents: Agent[], agentId: string): number | undefined {
  return buildSpriteMap(agents).get(agentId);
}

interface AgentAvatarProps {
  agent: Agent | undefined;
  agents?: Agent[];
  spriteMap?: Map<string, number>;
  size?: number;
  className?: string;
  rounded?: "full" | "xl" | "2xl";
  imageFit?: "cover" | "contain";
  imagePosition?: CSSProperties["objectPosition"];
}

/** Avataaars-based avatar — generates unique avatar from agent ID */
export default function AgentAvatar({
  agent,
  size = 28,
  className = "",
  rounded = "full",
}: AgentAvatarProps) {
  const roundedClass = rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : "rounded-2xl";

  if (agent) {
    const avatarUrl = generateAvatar(agent.avatar_seed || agent.id, Math.max(size, 64));
    return (
      <div
        className={`${roundedClass} overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={avatarUrl}
          alt={agent.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={`${roundedClass} bg-gray-700 flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.6 }}
    >
      🤖
    </div>
  );
}

/** Inline SVG avatar for cases needing raw SVG */
export function AgentAvatarSvg({ agentId, size = 28 }: { agentId: string; size?: number }) {
  const svg = generateAvatarSvg(agentId);
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
