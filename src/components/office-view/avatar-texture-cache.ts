/**
 * PixiJS texture cache for avataaars avatars.
 * Preloads all agent avatars as PixiJS textures before scene build.
 */
import { Assets, Texture } from "pixi.js";
import { getAvatarSvgDataUrl } from "../avatar-generator";
import type { Agent } from "../../types";

const textureCache = new Map<string, Texture>();
const seedCache = new Map<string, string>();

/** Get a cached PixiJS texture for an agent avatar (synchronous, must preload first) */
export function getAvatarTexture(agentId: string): Texture | undefined {
  return textureCache.get(agentId);
}

/** Preload avatar textures for all agents. Call before buildScene. */
export async function preloadAvatarTextures(agents: Agent[]): Promise<void> {
  const toLoad: Agent[] = [];
  for (const agent of agents) {
    const seed = agent.avatar_seed || agent.id;
    const cached = seedCache.get(agent.id);
    if (cached !== seed) toLoad.push(agent);
  }
  if (toLoad.length === 0) return;

  await Promise.all(
    toLoad.map(async (agent) => {
      try {
        const seed = agent.avatar_seed || agent.id;
        const url = getAvatarSvgDataUrl(seed);
        const key = `avatar-${agent.id}-${seed}-${Date.now()}`;
        const tex = await Assets.load<Texture>({ alias: key, src: url });
        textureCache.set(agent.id, tex);
        seedCache.set(agent.id, seed);
      } catch {
        // Silently skip failed loads
      }
    }),
  );
}

/** Invalidate cached texture for an agent (e.g., after avatar_seed change) */
export function invalidateAvatarTexture(agentId: string): void {
  textureCache.delete(agentId);
  seedCache.delete(agentId);
}
