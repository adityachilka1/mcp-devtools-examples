#!/usr/bin/env bash
# Local mirror of the CI job in `.github-actions-example.yml`. Runs
# `check-budget.sh` against the committed fixture, with the same exit-code
# contract as the workflow.
#
# Usage:
#   ./run-locally.sh                                              # default budget = 0.05
#   BUDGET_USD=0.01 ./run-locally.sh                              # tighter ceiling
#   BUDGET_USD=0.000001 ./run-locally.sh                          # demo the failure path
#   MCP_DEVTOOLS_PKG='file:/path/to/...0.1.x.tgz' ./run-locally.sh # install a tarball
#                                                                   # so `summary` resolves
#                                                                   # even before v0.1.x
#                                                                   # ships on npm.
#
# Idempotent: any prior summary-report.json is dropped and the spawned CLI
# is reaped on EXIT/INT/TERM via a trap. The fixture itself is never
# modified.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${HERE}"

cat <<BANNER
============================================================
 mcp-devtools example 09 - cost budget alert (local mirror)
============================================================
  1. fixture trace : ./fixture.mcptrace
  2. summariser    : mcp-devtools summary --model gpt-4o-mini --json
  3. gate          : .cost.totalUsd <= \$${BUDGET_USD:-0.05}
============================================================
BANNER

# Track any background child we spawn so the trap can reap it. We don't
# spawn long-running children here (check-budget.sh runs synchronously),
# but the trap-on-EXIT pattern matches what 07/08 do and keeps the script
# safe under SIGINT mid-run.
CHILD_PID=""
cleanup() {
  if [ -n "${CHILD_PID}" ] && kill -0 "${CHILD_PID}" 2>/dev/null; then
    kill "${CHILD_PID}" 2>/dev/null || true
  fi
  rm -f "${HERE}/summary-report.json"
}
trap cleanup EXIT INT TERM

echo
echo "[1/2] running check-budget.sh ..."
set +e
./check-budget.sh &
CHILD_PID=$!
wait "${CHILD_PID}"
RC=$?
CHILD_PID=""
set -e

echo
echo "[2/2] check-budget exit code: ${RC}"
if [ "${RC}" -ne 0 ]; then
  echo "==> budget gate FAILED. CI would fail here."
  exit 1
fi
echo "==> budget gate passed. Safe to push."
exit 0
