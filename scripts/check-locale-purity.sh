#!/usr/bin/env bash
# check-locale-purity.sh — Locale Purity Gate (Operations)
# Scans src/ and server/ for non-RU/EN locale codes.
# Exit 1 if violations found; exit 0 if clean.
#
# Usage:
#   ./scripts/check-locale-purity.sh             # scan src/ and server/
#   ./scripts/check-locale-purity.sh --report    # emit detailed report to stdout

set -euo pipefail

REPORT_MODE=0
for arg in "$@"; do
  [[ "$arg" == "--report" ]] && REPORT_MODE=1
done

VIOLATIONS=0
REPORT=""

# Patterns: non-RU/EN locale codes as standalone string literals
# Matches: "ko", "ja", "zh", "de", "fr", "es", "pt", "it"
NON_ALLOWED_PATTERN='"ko"|"ja"|"zh"|"de"|"fr"|"es"|"pt"|"it"'

# Additional structural patterns
SCHEMA_PATTERN='name_ko|name_ja|name_zh|name_de|name_fr|name_es'
LANG_TYPE_PATTERN='SupportedLang\s*=.*"ko"|SupportedLang\s*=.*"ja"'

echo "=== Locale Purity Gate (RU/EN only) ==="
echo "Scan targets: src/, server/"
echo "Forbidden locale codes: ko, ja, zh, de, fr, es, pt, it"
echo ""

# ---- 1. String literal scan: src/ ----
echo "--- [1] src/ — locale string literals ---"
SRC_HITS=$(grep -rn --include="*.ts" --include="*.tsx" \
  -E '"ko"|"ja"|"zh"|"de"|"fr"|"es"|"pt"|"it"' \
  src/ 2>/dev/null \
  | grep -v "\.test\." \
  | grep -v "# check-locale" \
  | grep -v "NON_ALLOWED_PATTERN" \
  || true)

if [[ -n "$SRC_HITS" ]]; then
  echo "VIOLATIONS in src/:"
  echo "$SRC_HITS"
  VIOLATIONS=$((VIOLATIONS + $(echo "$SRC_HITS" | wc -l)))
  REPORT+="[src/ violations]\n$SRC_HITS\n\n"
else
  echo "OK — no violations in src/"
fi

echo ""

# ---- 2. String literal scan: server/ ----
echo "--- [2] server/ — locale string literals ---"
SERVER_HITS=$(grep -rn --include="*.ts" \
  -E '"ko"|"ja"|"zh"|"de"|"fr"|"es"|"pt"|"it"' \
  server/ 2>/dev/null \
  | grep -v "\.test\." \
  | grep -v "# check-locale" \
  || true)

if [[ -n "$SERVER_HITS" ]]; then
  echo "VIOLATIONS in server/:"
  echo "$SERVER_HITS"
  VIOLATIONS=$((VIOLATIONS + $(echo "$SERVER_HITS" | wc -l)))
  REPORT+="[server/ violations]\n$SERVER_HITS\n\n"
else
  echo "OK — no violations in server/"
fi

echo ""

# ---- 3. Schema/column name scan ----
echo "--- [3] Database schema/seeds — locale columns ---"
SCHEMA_HITS=$(grep -rn --include="*.ts" \
  -E 'name_ko|name_ja|name_zh|name_de|name_fr|name_es' \
  server/modules/bootstrap/schema/ 2>/dev/null \
  | grep -v "\.test\." \
  || true)

if [[ -n "$SCHEMA_HITS" ]]; then
  echo "INFO — locale columns still present in schema/seeds (tracked separately):"
  echo "$SCHEMA_HITS" | head -20
  REPORT+="[schema locale columns — tracked]\n$SCHEMA_HITS\n\n"
else
  echo "OK — no legacy locale columns in schema"
fi

echo ""

# ---- Summary ----
echo "=== Summary ==="
if [[ $VIOLATIONS -gt 0 ]]; then
  echo "FAIL — $VIOLATIONS locale violation(s) found in src/ and server/"
  if [[ $REPORT_MODE -eq 1 ]]; then
    echo ""
    echo "=== Full Report ==="
    echo -e "$REPORT"
  fi
  exit 1
else
  echo "PASS — no non-RU/EN locale codes in production source"
  exit 0
fi
