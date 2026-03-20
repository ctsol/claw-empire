import { useState, useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import * as avataaars from "@dicebear/avataaars";

const TOPS = [
  "bigHair", "bob", "bun", "curly", "curvy", "dreads", "dreads01", "dreads02",
  "frida", "frizzle", "fro", "froBand", "hat", "longButNotTooLong",
  "miaWallace", "shaggy", "shaggyMullet", "shavedSides", "shortCurly",
  "shortFlat", "shortRound", "shortWaved", "sides", "straight01", "straight02",
  "straightAndStrand", "theCaesar", "theCaesarAndSidePart",
] as const;

const EYES = [
  "default", "happy", "closed", "cry", "hearts", "side", "squint",
  "surprised", "wink", "winkWacky",
] as const;

const EYEBROWS = [
  "default", "defaultNatural", "angry", "angryNatural", "flatNatural",
  "raisedExcited", "raisedExcitedNatural", "sadConcerned", "upDown",
] as const;

const MOUTHS = [
  "default", "smile", "twinkle", "tongue", "serious", "sad",
  "concerned", "disbelief", "eating", "grimace",
] as const;

const CLOTHING = [
  "blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt",
  "hoodie", "overall", "shirtCrewNeck", "shirtScoopNeck", "shirtVNeck",
] as const;

const SKIN_COLORS = [
  "614335", "ae5d29", "d08b5b", "edb98a", "ffdbb4", "fd9841",
] as const;

const HAIR_COLORS = [
  "2c1b18", "4a312c", "724133", "a55728", "b58143", "d6b370",
  "c93305", "e8e1e1", "f59797", "ecdcbf",
] as const;

const FACIAL_HAIR = [
  "", "beardLight", "beardMedium", "beardMajestic",
  "moustacheFancy", "moustacheMagnum",
] as const;

const ACCESSORIES = [
  "", "prescription01", "prescription02", "round", "sunglasses", "wayfarers",
] as const;

interface AvatarOptions {
  top: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  clothing: string;
  skinColor: string;
  hairColor: string;
  facialHair: string;
  accessories: string;
}

function buildSvg(opts: AvatarOptions): string {
  return createAvatar(avataaars, {
    seed: "custom",
    size: 128,
    backgroundColor: ["transparent"],
    backgroundType: ["solid"],
    top: [opts.top] as any,
    eyes: [opts.eyes] as any,
    eyebrows: [opts.eyebrows] as any,
    mouth: [opts.mouth] as any,
    clothing: [opts.clothing] as any,
    skinColor: [opts.skinColor] as any,
    hairColor: [opts.hairColor] as any,
    facialHair: opts.facialHair ? [opts.facialHair] as any : [],
    facialHairProbability: opts.facialHair ? 100 : 0,
    accessories: opts.accessories ? [opts.accessories] as any : [],
    accessoriesProbability: opts.accessories ? 100 : 0,
  }).toString();
}

function optionsToSeed(opts: AvatarOptions): string {
  return `custom:${opts.top}:${opts.eyes}:${opts.eyebrows}:${opts.mouth}:${opts.clothing}:${opts.skinColor}:${opts.hairColor}:${opts.facialHair}:${opts.accessories}`;
}

interface AvatarBuilderProps {
  initialSeed?: string;
  onApply: (seed: string) => void;
  onClose: () => void;
  tr: (ko: string, en: string) => string;
}

function parseCustomSeed(seed: string): AvatarOptions | null {
  if (!seed.startsWith("custom:")) return null;
  const parts = seed.replace("custom:", "").split(":");
  if (parts.length < 9) return null;
  return {
    top: parts[0],
    eyes: parts[1],
    eyebrows: parts[2],
    mouth: parts[3],
    clothing: parts[4],
    skinColor: parts[5],
    hairColor: parts[6],
    facialHair: parts[7],
    accessories: parts[8],
  };
}

export default function AvatarBuilder({ initialSeed, onApply, onClose, tr }: AvatarBuilderProps) {
  const parsed = initialSeed ? parseCustomSeed(initialSeed) : null;
  const [opts, setOpts] = useState<AvatarOptions>(parsed ?? {
    top: "shortFlat",
    eyes: "default",
    eyebrows: "default",
    mouth: "smile",
    clothing: "hoodie",
    skinColor: "edb98a",
    hairColor: "2c1b18",
    facialHair: "",
    accessories: "",
  });

  const svg = useMemo(() => buildSvg(opts), [opts]);

  const set = (key: keyof AvatarOptions, val: string) => setOpts((prev) => ({ ...prev, [key]: val }));

  const SelectRow = ({ label, field, options }: { label: string; field: keyof AvatarOptions; options: readonly string[] }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs w-20 shrink-0 text-right" style={{ color: "var(--th-text-secondary)" }}>{label}</span>
      <select
        value={opts[field]}
        onChange={(e) => set(field, e.target.value)}
        className="flex-1 text-xs px-2 py-1 rounded border"
        style={{ background: "var(--th-input-bg)", borderColor: "var(--th-input-border)", color: "var(--th-text-primary)" }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || `(${tr("", "none")})`}</option>
        ))}
      </select>
    </div>
  );

  const ColorRow = ({ label, field, colors }: { label: string; field: keyof AvatarOptions; colors: readonly string[] }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs w-20 shrink-0 text-right" style={{ color: "var(--th-text-secondary)" }}>{label}</span>
      <div className="flex gap-1 flex-wrap">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => set(field, c)}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${opts[field] === c ? "scale-125 border-blue-400" : "border-transparent hover:scale-110"}`}
            style={{ background: `#${c}` }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "var(--th-modal-overlay)" }}>
      <div
        className="w-full max-w-md rounded-2xl p-5 shadow-2xl"
        style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--th-text-heading)" }}>
            {tr("", "Avatar Builder")}
          </h3>
          <button onClick={onClose} className="text-xs" style={{ color: "var(--th-text-muted)" }}>✕</button>
        </div>

        <div className="flex gap-4">
          {/* Preview */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <div
              className="w-36 h-36 rounded-xl overflow-hidden"
              style={{ border: "2px solid var(--th-input-border)", background: "var(--th-bg-surface-hover)" }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <button
              type="button"
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ color: "var(--th-accent)", border: "1px solid var(--th-input-border)" }}
              onClick={() => {
                const rnd = <T extends string>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
                setOpts({
                  top: rnd(TOPS),
                  eyes: rnd(EYES),
                  eyebrows: rnd(EYEBROWS),
                  mouth: rnd(MOUTHS),
                  clothing: rnd(CLOTHING),
                  skinColor: rnd(SKIN_COLORS),
                  hairColor: rnd(HAIR_COLORS),
                  facialHair: Math.random() > 0.7 ? rnd(FACIAL_HAIR.filter(Boolean) as any) : "",
                  accessories: Math.random() > 0.7 ? rnd(ACCESSORIES.filter(Boolean) as any) : "",
                });
              }}
            >
              🎲 {tr("", "Random")}
            </button>
          </div>

          {/* Controls */}
          <div className="flex-1 space-y-2 max-h-72 overflow-y-auto pr-1">
            <ColorRow label={tr("", "Skin")} field="skinColor" colors={SKIN_COLORS} />
            <SelectRow label={tr("", "Hair")} field="top" options={TOPS} />
            <ColorRow label={tr("", "Hair Color")} field="hairColor" colors={HAIR_COLORS} />
            <SelectRow label={tr("", "Eyes")} field="eyes" options={EYES} />
            <SelectRow label={tr("", "Eyebrows")} field="eyebrows" options={EYEBROWS} />
            <SelectRow label={tr("", "Mouth")} field="mouth" options={MOUTHS} />
            <SelectRow label={tr("", "Clothes")} field="clothing" options={CLOTHING} />
            <SelectRow label={tr("", "Facial Hair")} field="facialHair" options={FACIAL_HAIR} />
            <SelectRow label={tr("", "Accessories")} field="accessories" options={ACCESSORIES} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ color: "var(--th-text-secondary)", border: "1px solid var(--th-input-border)" }}
          >
            {tr("", "Cancel")}
          </button>
          <button
            onClick={() => onApply(optionsToSeed(opts))}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
          >
            {tr("", "Apply")}
          </button>
        </div>
      </div>
    </div>
  );
}

export { parseCustomSeed, buildSvg, optionsToSeed };
