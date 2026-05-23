#!/usr/bin/env bash
# Records two MCP sessions (v1 baseline, v2 current) and diffs them.
# Surfaces the regression on the `tools/list` frame.
#
# Usage:
#   ./run.sh                  # uses npx -y @adityachilka/mcp-devtools
#   MCP_DEVTOOLS='node /path/to/cli.js' ./run.sh   # override (e.g. local build)
#
# Idempotent: removes previous .mcptrace files on each run.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_DEVTOOLS="${MCP_DEVTOOLS:-npx -y @adityachilka/mcp-devtools}"

cat <<BANNER
============================================================
 mcp-devtools example 05 - record + diff
============================================================
  1. recording v1 session  -> baseline.mcptrace
  2. recording v2 session  -> current.mcptrace
  3. diffing the two traces structurally
============================================================
BANNER

cd "${HERE}"
rm -f baseline.mcptrace current.mcptrace

echo
echo "[1/3] recording baseline against server-v1.cjs ..."
${MCP_DEVTOOLS} record --upstream "node ./server-v1.cjs" --out ./baseline.mcptrace --quiet < ./fixtures/requests.jsonl > /dev/null

echo "[2/3] recording current against server-v2.cjs ..."
${MCP_DEVTOOLS} record --upstream "node ./server-v2.cjs" --out ./current.mcptrace --quiet < ./fixtures/requests.jsonl > /dev/null

echo "[3/3] diffing ..."
echo
set +e
${MCP_DEVTOOLS} diff ./baseline.mcptrace ./current.mcptrace
DIFF_EXIT=$?
set -e

echo
if [ "${DIFF_EXIT}" -eq 0 ]; then
  echo "==> traces are identical - no regression detected."
else
  echo "==> traces diverged (exit ${DIFF_EXIT}). Inspect the differences above"
  echo "    or open each trace with: ${MCP_DEVTOOLS} open ./baseline.mcptrace"
fi

exit "${DIFF_EXIT}"
