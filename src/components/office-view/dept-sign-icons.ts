/**
 * Colored SVG icons for department room signs (Lucide-based, 24×24 viewBox).
 * Icons are white (for use on colored sign backgrounds).
 */

import { Assets, type Texture } from "pixi.js";

// Lucide SVG paths per department (white stroke, for colored backgrounds)
const DEPT_SVG_PATHS: Record<string, string> = {
  planning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
    <path d="M18 17V9"/>
    <path d="M13 17V5"/>
    <path d="M8 17v-3"/>
  </svg>`,
  dev: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>`,
  design: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/>
    <circle cx="13.5" cy="6.5" r=".5" fill="white"/>
    <circle cx="17.5" cy="10.5" r=".5" fill="white"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="white"/>
    <circle cx="6.5" cy="12.5" r=".5" fill="white"/>
  </svg>`,
  qa: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/>
    <path d="M6.453 15h11.094"/>
    <path d="M8.5 2h7"/>
  </svg>`,
  devsecops: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>`,
  operations: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,
  break_room: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14"/>
    <path d="M18 8c0-2.5-2-2.5-2-5"/>
    <path d="M21 8c0-2.5-2-2.5-2-5"/>
    <path d="M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
  </svg>`,
};

const DEFAULT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="3" width="20" height="14" rx="2"/>
  <path d="M8 21h8M12 17v4"/>
</svg>`;

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export type DeptIconTextureMap = Record<string, Texture>;

export async function loadDeptSignIconTextures(): Promise<DeptIconTextureMap> {
  const result: DeptIconTextureMap = {};
  const entries = [
    ...Object.entries(DEPT_SVG_PATHS),
    ["default", DEFAULT_ICON],
  ];
  await Promise.all(
    entries.map(async ([key, svg]) => {
      try {
        const url = svgToDataUrl(svg);
        const texture = await Assets.load<Texture>(url);
        result[key] = texture;
      } catch {
        // silent – fallback to emoji text
      }
    }),
  );
  return result;
}

/** Look up a dept icon texture from the main scene textures map (uses `dept_icon:` prefix). */
export function getDeptSignTexture(
  deptId: string,
  textureMap: Record<string, Texture>,
): Texture | null {
  return (
    textureMap[`dept_icon:${deptId}`] ??
    textureMap[`dept_icon:default`] ??
    null
  );
}

export function getBreakRoomTexture(textureMap: Record<string, Texture>): Texture | null {
  return textureMap["dept_icon:break_room"] ?? null;
}
