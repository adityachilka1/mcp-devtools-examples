#!/usr/bin/env bash
# Local mirror of the CI job in `.github-actions-example.yml`. Run this from
# your laptop to verify your MCP server passes every `mcp-devtools doctor`
# check before you push.
#
# Usage:
#   ./run-locally.sh                                              # uses npx -y @adityachilka/mcp-devtools
#   MCP_DEVTOOLS='node /path/to/cli.js' ./run-locally.sh          # override (local build)
#   MCP_DEVTOOLS_PKG='file:/path/to/...0.1.x.tgz' ./run-locally.sh # install a tarball into node_modules
#   SERVER='node ./server.cjs' ./run-locally.sh                   # probe a different server
#
# Idempotent: drops any prior report.json and stops the spawned doctor child
# on EXIT/INT/TERM via a trap.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${HERE}"

MCP_DEVTOOLS="${MCP_DEVTOOLS:-npx -y @adityachilka/mcp-devtools}"
SERVER="${SERVER:-node ./server.cjs}"
REPORT="${HERE}/doctor-report.json"

cat <<BANNER
============================================================
 mcp-devtools example 07 - doctor in CI (local mirror)
============================================================
  1. probing server: ${SERVER}
  2. running: mcp-devtools doctor --upstream ... --json
  3. failing on summary.failed > 0
============================================================
BANNER

# If MCP_DEVTOOLS_PKG was set, install the tarball so the locally-published
# version of @adityachilka/mcp-devtools is what `npx` picks up. Mirrors the
# pattern used in examples 05 and 06 — needed until v0.1.2 (the release that
# ships `doctor --json`) lands on npm.
if [ -n "${MCP_DEVTOOLS_PKG:-}" ]; then
  echo "[run-locally] installing @adityachilka/mcp-devtools from ${MCP_DEVTOOLS_PKG}"
  if [ ! -f package.json ]; then
    cat > package.json <<JSON
{
  "name": "mcp-devtools-example-07-doctor-ci",
  "private": true,
  "scripts": { "start": "./run-locally.sh" }
}
JSON
  fi
  npm install --no-audit --no-fund --silent "${MCP_DEVTOOLS_PKG}"
  MCP_DEVTOOLS="node ./node_modules/@adityachilka/mcp-devtools/dist/cli.js"
fi

rm -f "${REPORT}"

# Always clean up: kill any straggling child and remove the report on exit.
# The report is the source of truth for the run; we don't keep it around
# between invocations.
DOCTOR_PID=""
cleanup() {
  if [ -n "${DOCTOR_PID}" ] && kill -0 "${DOCTOR_PID}" 2>/dev/null; then
    kill "${DOCTOR_PID}" 2>/dev/null || true
  fi
  rm -f "${REPORT}"
}
trap cleanup EXIT INT TERM

echo
echo "[1/2] running doctor ..."
# `doctor --json` emits a single-line JSON envelope to stdout. Capture it to
# a file so jq can both pretty-print the per-check summary AND drive the
# exit-code logic below without re-running the probe. We intentionally
# *don't* propagate doctor's own exit code here — we want to parse the JSON
# report and produce our own pretty failure message either way.
set +e
${MCP_DEVTOOLS} doctor --upstream "${SERVER}" --json > "${REPORT}" &
DOCTOR_PID=$!
wait "${DOCTOR_PID}"
DOCTOR_PID=""
set -e

echo "[2/2] parsing report ..."
echo

# Pretty per-check summary.
jq -r '
  "upstream: \(.upstream)",
  "version:  \(.version)",
  "summary:  \(.summary.passed)/\(.summary.total) passed (\(.summary.failed) failed)",
  "",
  (.checks[] | "  \(if .passed then "PASS" else "FAIL" end)  \(.name)\(if .message then " — \(.message)" else "" end)")
' "${REPORT}"

echo

# Exit-code logic: any failed check fails the job. Mirror what
# `.github-actions-example.yml` does in CI so local == remote.
FAILED=$(jq -r '.summary.failed' "${REPORT}")
if [ "${FAILED}" -gt 0 ]; then
  echo "==> doctor reported ${FAILED} failing check(s):"
  jq -r '.checks[] | select(.passed == false) | "      - \(.name)\(if .message then " — \(.message)" else "" end)"' "${REPORT}"
  echo
  echo "==> CI would fail here. Fix the regressions above before pushing."
  exit 1
fi

echo "==> all checks passed. Safe to push."
exit 0
