#!/usr/bin/env node
/**
 * check-i18n-completeness.mjs
 *
 * CI gate: verifies that i18n translation objects in the codebase
 * have all required language keys populated.
 *
 * Exit codes:
 *   0 — all checks passed (or only warnings)
 *   1 — required-language keys are missing (blocks merge)
 *
 * Usage:
 *   node scripts/check-i18n-completeness.mjs [--strict]
 *
 * Options:
 *   --strict   Also fail on missing optional languages (ja, zh)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Languages required in every LangText object (non-nullable fields).
const REQUIRED_LANGS = ["ko", "en"];

// Optional languages — missing triggers a WARNING only (unless --strict).
const OPTIONAL_LANGS = ["ja", "zh"];

// If any of these languages appear in UiLanguage type but are NOT in REQUIRED_LANGS,
// they are treated as optional. Add "ru" here when Russian work begins.
const KNOWN_LANGS = [...REQUIRED_LANGS, ...OPTIONAL_LANGS];

const STRICT = process.argv.includes("--strict");

// Scan these globs for translation objects
const SCAN_DIRS = ["src"];
const EXTENSIONS = [".ts", ".tsx"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function collectFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...collectFiles(full));
    } else if (entry.isFile() && EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract all LangText-like object literals from source text.
 * Matches patterns like: t({ ko: "...", en: "...", ... })
 * and standalone { ko: "...", en: "..." } objects.
 *
 * Returns array of { line, keys } objects.
 */
function extractLangObjects(source, filePath) {
  const findings = [];
  // Match object literals that contain at least one known language key
  // Pattern: { ... ko: ..., en: ..., [ja: ...,] [zh: ...] ... }
  const objPattern =
    /\{[^{}]*\b(ko|en|ja|zh)\s*:\s*(?:`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')[^{}]*\}/g;

  let match;
  while ((match = objPattern.exec(source)) !== null) {
    const obj = match[0];
    const lineNum = source.slice(0, match.index).split("\n").length;

    // Only care about objects that look like LangText (have ko or en)
    if (!/\bko\s*:/.test(obj) && !/\ben\s*:/.test(obj)) continue;

    const presentKeys = KNOWN_LANGS.filter((lang) => new RegExp(`\\b${lang}\\s*:`).test(obj));

    const missingRequired = REQUIRED_LANGS.filter((lang) => !presentKeys.includes(lang));
    const missingOptional = OPTIONAL_LANGS.filter((lang) => !presentKeys.includes(lang));

    if (missingRequired.length > 0 || (STRICT && missingOptional.length > 0)) {
      findings.push({
        file: path.relative(ROOT, filePath),
        line: lineNum,
        presentKeys,
        missingRequired,
        missingOptional,
      });
    }
  }
  return findings;
}

/**
 * Check src/i18n.ts for supported language declarations.
 * Warns if UiLanguage type diverges from KNOWN_LANGS.
 */
function checkI18nTypeFile() {
  const i18nPath = path.join(ROOT, "src", "i18n.ts");
  if (!fs.existsSync(i18nPath)) {
    console.warn('[WARN] src/i18n.ts not found — skipping type check');
    return { warnings: [], errors: [] };
  }

  const source = fs.readFileSync(i18nPath, "utf8");
  const warnings = [];
  const errors = [];

  // Extract UiLanguage type value
  const typeMatch = source.match(/export\s+type\s+UiLanguage\s*=\s*([^;]+);/);
  if (!typeMatch) {
    warnings.push("Could not parse UiLanguage type from src/i18n.ts");
    return { warnings, errors };
  }

  const typeStr = typeMatch[1];
  const declaredLangs = [...typeStr.matchAll(/"([a-z]{2,3})"/g)].map((m) => m[1]);

  // Check that all REQUIRED_LANGS are in UiLanguage
  for (const lang of REQUIRED_LANGS) {
    if (!declaredLangs.includes(lang)) {
      errors.push(`Required language "${lang}" is missing from UiLanguage type in src/i18n.ts`);
    }
  }

  // Check for languages declared in type but unknown to this script
  const unknownDeclared = declaredLangs.filter((l) => !KNOWN_LANGS.includes(l));
  if (unknownDeclared.length > 0) {
    warnings.push(
      `UiLanguage declares unknown languages: ${unknownDeclared.join(", ")}. ` +
      `Update KNOWN_LANGS in this script if these are intentional additions.`
    );
  }

  // Check parseLanguage has handlers for all declared langs
  for (const lang of declaredLangs) {
    if (!new RegExp(`"${lang}"`).test(source.replace(typeMatch[0], ""))) {
      warnings.push(`Language "${lang}" is in UiLanguage but may lack a parseLanguage() handler`);
    }
  }

  console.log(`  UiLanguage declared: [${declaredLangs.join(", ")}]`);
  return { warnings, errors };
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("=== i18n Completeness Gate ===\n");

let totalErrors = 0;
let totalWarnings = 0;
const errorFindings = [];
const warnFindings = [];

// 1. Check type file
console.log("1. Checking src/i18n.ts type declarations...");
const { warnings: typeWarnings, errors: typeErrors } = checkI18nTypeFile();
for (const w of typeWarnings) {
  console.warn(`  [WARN] ${w}`);
  totalWarnings++;
}
for (const e of typeErrors) {
  console.error(`  [ERROR] ${e}`);
  totalErrors++;
}

// 2. Scan source files
console.log("\n2. Scanning source files for incomplete translation objects...");

let scannedCount = 0;
for (const scanDir of SCAN_DIRS) {
  const absDir = path.join(ROOT, scanDir);
  if (!fs.existsSync(absDir)) continue;

  for (const filePath of collectFiles(absDir)) {
    const source = fs.readFileSync(filePath, "utf8");
    const findings = extractLangObjects(source, filePath);

    for (const f of findings) {
      if (f.missingRequired.length > 0) {
        errorFindings.push(f);
        totalErrors++;
      } else if (f.missingOptional.length > 0) {
        warnFindings.push(f);
        totalWarnings++;
      }
    }
    scannedCount++;
  }
}

console.log(`  Scanned ${scannedCount} source files.`);

// Report findings
if (errorFindings.length > 0) {
  console.error(`\n[ERRORS] Missing REQUIRED language keys (${errorFindings.length} objects):`);
  for (const f of errorFindings) {
    console.error(
      `  ${f.file}:${f.line} — present: [${f.presentKeys.join(",")}], missing required: [${f.missingRequired.join(",")}]`
    );
  }
}

if (warnFindings.length > 0) {
  const label = STRICT ? "[ERRORS]" : "[WARNINGS]";
  console.warn(
    `\n${label} Missing optional language keys (${warnFindings.length} objects):` +
    (STRICT ? "" : " (use --strict to fail on these)")
  );
  for (const f of warnFindings.slice(0, 20)) {
    console.warn(
      `  ${f.file}:${f.line} — present: [${f.presentKeys.join(",")}], missing optional: [${f.missingOptional.join(",")}]`
    );
  }
  if (warnFindings.length > 20) {
    console.warn(`  ... and ${warnFindings.length - 20} more.`);
  }
}

// Summary
console.log("\n=== Summary ===");
console.log(`  Errors:   ${totalErrors}`);
console.log(`  Warnings: ${totalWarnings}`);

if (totalErrors > 0) {
  console.error("\n[FAIL] i18n completeness gate failed — required translations missing.");
  process.exit(1);
} else {
  console.log("\n[PASS] i18n completeness gate passed.");
  process.exit(0);
}
