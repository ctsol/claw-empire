#!/usr/bin/env node
/**
 * check-locale-guard.mjs
 *
 * CI gate: fails the build if any non-RU/EN locale code is detected in
 * source files (src/, server/). Targets locale keys like `ko:`, `ja:`,
 * `zh:`, `de:`, `fr:`, `es:`, `pt:`, `it:` inside translation objects.
 *
 * Exit codes:
 *   0 — no forbidden locale keys found
 *   1 — forbidden locale keys detected (blocks merge)
 *
 * Usage:
 *   node scripts/check-locale-guard.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Locale codes that must NOT appear in the codebase. */
const FORBIDDEN_LOCALES = ["ko", "ja", "zh", "de", "fr", "es", "pt", "it"];

/** Directories to scan. */
const SCAN_DIRS = ["src", "server"];

/** File extensions to check. */
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);

// ─── Pattern ────────────────────────────────────────────────────────────────
// Matches translation-object keys like:   ko: "...",  ja: `...`,  zh: '...'
// Also matches standalone locale strings like "locale": "ko" or lang === "ko"
const buildPattern = (locales) => {
  const escaped = locales.join("|");
  // Match:  <locale>:  (object key)
  //  OR:   "<locale>"  (string value)
  //  OR:   '<locale>'  (string value)
  return new RegExp(
    `\\b(${escaped})\\s*:|["'](${escaped})["']`,
    "g"
  );
};

const FORBIDDEN_PATTERN = buildPattern(FORBIDDEN_LOCALES);

// ─── Helpers ────────────────────────────────────────────────────────────────

function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {
      results.push(...collectFiles(full));
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");
  const findings = [];

  // Reset lastIndex before scanning
  FORBIDDEN_PATTERN.lastIndex = 0;

  let match;
  while ((match = FORBIDDEN_PATTERN.exec(source)) !== null) {
    const matchedLocale = match[1] || match[2];
    const lineNum = source.slice(0, match.index).split("\n").length;
    const lineContent = lines[lineNum - 1]?.trim() ?? "";
    findings.push({
      file: path.relative(ROOT, filePath),
      line: lineNum,
      locale: matchedLocale,
      context: lineContent.slice(0, 120),
    });
  }

  return findings;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("=== Locale Guard — Non-RU/EN Locale Check ===\n");
console.log(`Forbidden locale codes: [${FORBIDDEN_LOCALES.join(", ")}]`);
console.log(`Scanning directories: [${SCAN_DIRS.join(", ")}]\n`);

let totalErrors = 0;
const allFindings = [];

for (const scanDir of SCAN_DIRS) {
  const absDir = path.join(ROOT, scanDir);
  const files = collectFiles(absDir);

  for (const filePath of files) {
    const findings = scanFile(filePath);
    allFindings.push(...findings);
    totalErrors += findings.length;
  }
}

if (allFindings.length > 0) {
  console.error(`[FAIL] Found ${allFindings.length} reference(s) to forbidden locale codes:\n`);
  for (const f of allFindings) {
    console.error(`  ${f.file}:${f.line} [locale: ${f.locale}]`);
    console.error(`    → ${f.context}`);
  }
  console.error(
    "\nRemove all non-RU/EN locale keys before merging. " +
    "Only 'ru' and 'en' are permitted in this codebase."
  );
  process.exit(1);
} else {
  console.log("[PASS] No forbidden locale codes found. Only RU/EN locales are present.");
  process.exit(0);
}
