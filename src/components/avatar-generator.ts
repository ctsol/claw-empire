/**
 * Avatar generator using DiceBear avataaars style (fluttermoji-compatible).
 * Generates unique SVG avatars deterministically from agent ID.
 * Returns data URL (PNG via canvas) for use in both React and PixiJS.
 */
import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";

const svgCache = new Map<string, string>();
const dataUrlCache = new Map<string, string>();

/** Parse custom seed format: custom:top:eyes:eyebrows:mouth:clothing:skinColor:hairColor:facialHair:accessories */
function parseCustomSeed(seed: string): Record<string, any> | null {
  if (!seed.startsWith("custom:")) return null;
  const parts = seed.replace("custom:", "").split(":");
  if (parts.length < 9) return null;
  const opts: Record<string, any> = {
    top: [parts[0]],
    eyes: [parts[1]],
    eyebrows: [parts[2]],
    mouth: [parts[3]],
    clothing: [parts[4]],
    skinColor: [parts[5]],
    hairColor: [parts[6]],
  };
  if (parts[7]) {
    opts.facialHair = [parts[7]];
    opts.facialHairProbability = 100;
  } else {
    opts.facialHairProbability = 0;
  }
  if (parts[8]) {
    opts.accessories = [parts[8]];
    opts.accessoriesProbability = 100;
  } else {
    opts.accessoriesProbability = 0;
  }
  return opts;
}

/** Generate an avataaars SVG string from an agent ID or custom seed (cached) */
export function generateAvatarSvg(agentId: string): string {
  const cached = svgCache.get(agentId);
  if (cached) return cached;

  const customOpts = parseCustomSeed(agentId);

  const avatar = createAvatar(avataaars, {
    seed: customOpts ? "custom" : agentId,
    size: 128,
    backgroundColor: ["transparent"],
    backgroundType: ["solid"],
    ...customOpts,
  });

  const svg = avatar.toString();
  svgCache.set(agentId, svg);
  return svg;
}

/** Generate a data URL (PNG) from an agent ID — for <img> tags and PixiJS textures */
export function generateAvatar(agentId: string, size = 64): string {
  const key = `${agentId}:${size}`;
  const cached = dataUrlCache.get(key);
  if (cached) return cached;

  const svg = generateAvatarSvg(agentId);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Render SVG to canvas for PNG data URL
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    const dataUrl = canvas.toDataURL("image/png");
    dataUrlCache.set(key, dataUrl);
  };
  img.src = url;

  // Return SVG data URL immediately (async PNG will be cached for next call)
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  dataUrlCache.set(key, svgDataUrl);
  return svgDataUrl;
}

/** Cached SVG data URLs for synchronous access in PixiJS */
const svgDataUrlCache = new Map<string, string>();

/** Get SVG data URL synchronously (for PixiJS Texture.from or img src) */
export function getAvatarSvgDataUrl(agentId: string): string {
  const cached = svgDataUrlCache.get(agentId);
  if (cached) return cached;
  const svg = generateAvatarSvg(agentId);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  svgDataUrlCache.set(agentId, url);
  return url;
}

/** Pre-generate avatar textures for a list of agent IDs, returns a Promise that resolves when all are ready */
export function preloadAvatars(agentIds: string[], size = 64): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    const result = new Map<string, string>();
    let pending = agentIds.length;
    if (pending === 0) { resolve(result); return; }

    for (const id of agentIds) {
      const key = `${id}:${size}`;
      const cached = dataUrlCache.get(key);
      if (cached && !cached.startsWith("data:image/svg")) {
        result.set(id, cached);
        pending--;
        if (pending === 0) resolve(result);
        continue;
      }

      const svg = generateAvatarSvg(id);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/png");
        dataUrlCache.set(key, dataUrl);
        result.set(id, dataUrl);
        pending--;
        if (pending === 0) resolve(result);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        pending--;
        if (pending === 0) resolve(result);
      };
      img.src = url;
    }
  });
}
