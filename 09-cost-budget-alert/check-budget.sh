#!/usr/bin/env bash
# Runs `mcp-devtools summary <trace> --model <id> --json` against the
# committed fixture, parses `.cost.totalUsd` with `jq`, and fails (exit 1)
# if the cost exceeds $BUDGET_USD. Idempotent — safe to call repeatedly.
#
# Designed to be the only thing the matching CI workflow has to execute:
# any drift in recorded prompt size or tool-call volume nudges totalUsd,
# and once it crosses the budget threshold the build goes red.
#
# Usage:
#   ./check-budget.sh                        # BUDGET_USD defaults to 0.05
#   BUDGET_USD=0.01 ./check-budget.sh        # tighter ceiling
#   BUDGET_USD=0.000001 ./check-budget.sh    # see the failure path
#   MODEL=gpt-4o-mini ./check-budget.sh      # different model basis
#   TRACE=./other.mcptrace ./check-budget.sh # different recorded session
#
# Exit codes:
#   0  cost <= BUDGET_USD          (build is green)
#   1  cost >  BUDGET_USD          (over budget — build is red)
#   1  trace missing / jq missing / summary errored
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${HERE}"

MCP_DEVTOOLS="${MCP_DEVTOOLS:-npx -y @adityachilka/mcp-devtools}"
MODEL="${MODEL:-gpt-4o-mini}"
TRACE="${TRACE:-./fixture.mcptrace}"
BUDGET_USD="${BUDGET_USD:-0.05}"
REPORT="${HERE}/summary-report.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required (brew install jq / apt-get install jq)" >&2
  exit 1
fi

if [ ! -f "${TRACE}" ]; then
  echo "error: trace not found: ${TRACE}" >&2
  exit 1
fi

# If MCP_DEVTOOLS_PKG was set by the caller (run-locally.sh / a developer
# pointing at a local tarball), prefer the locally-installed CLI so we pick
# up `summary --model --json` even before v0.1.x ships on npm. Mirrors the
# pattern used in examples 05, 06, 07, 08.
if [ -n "${MCP_DEVTOOLS_PKG:-}" ]; then
  if [ ! -f node_modules/@adityachilka/mcp-devtools/dist/cli.js ]; then
    if [ ! -f package.json ]; then
      cat > package.json <<'JSON'
{
  "name": "mcp-devtools-example-09-cost-budget-alert",
  "private": true,
  "scripts": { "start": "./check-budget.sh" }
}
JSON
    fi
    npm install --no-audit --no-fund --silent "${MCP_DEVTOOLS_PKG}"
  fi
  MCP_DEVTOOLS="node ./node_modules/@adityachilka/mcp-devtools/dist/cli.js"
fi

# Always start with a clean report so a stale file from a previous run can't
# poison the comparison below. The report stays on disk after a successful
# run so CI can upload it as a build artifact — `run-locally.sh` is the
# layer that scrubs it for repeated local runs.
rm -f "${REPORT}"

echo "[1/3] summarising trace: ${TRACE}"
echo "       model: ${MODEL}"
echo "      budget: \$${BUDGET_USD}"

# `summary --json` writes a single-line JSON envelope to stdout. Capture it
# so we can both inspect the envelope and drive the exit-code logic without
# re-running the analysis. Don't propagate the CLI's own exit code yet — we
# always want to print a clear pass/fail message ourselves.
set +e
${MCP_DEVTOOLS} summary "${TRACE}" --model "${MODEL}" --json > "${REPORT}"
RC=$?
set -e

if [ "${RC}" -ne 0 ] || [ ! -s "${REPORT}" ]; then
  echo "error: mcp-devtools summary failed (exit ${RC})" >&2
  exit 1
fi

echo "[2/3] parsing cost from report ..."

# `.cost.totalUsd` is `null` when no priced calls landed in the trace
# (e.g. the model id wasn't in the pricing table). Treat that as a
# hard error rather than a 0 — silently passing in that case would
# defeat the whole point of the budget check.
TOTAL_USD="$(jq -r '.cost.totalUsd' "${REPORT}")"
PRICED_CALLS="$(jq -r '.cost.pricedCalls' "${REPORT}")"
PRICED_WITH_COST="$(jq -r '.cost.pricedWithCost' "${REPORT}")"
BASIS="$(jq -r '.cost.bases | join(",")' "${REPORT}")"

if [ "${TOTAL_USD}" = "null" ] || [ -z "${TOTAL_USD}" ]; then
  echo "error: cost.totalUsd is null — no priced tools/call frames in trace." >&2
  echo "       Check that --model '${MODEL}' is in the pricing table." >&2
  exit 1
fi

echo "[3/3] comparing against budget ..."
echo
echo "  total cost      : \$${TOTAL_USD}"
echo "  budget          : \$${BUDGET_USD}"
echo "  priced calls    : ${PRICED_WITH_COST} / ${PRICED_CALLS}"
echo "  basis           : ${BASIS}"
echo

# bc handles arbitrary precision; jq's numeric output is plain decimal so
# the comparison is straightforward. `bc` exits 1 if missing — guard it.
if ! command -v bc >/dev/null 2>&1; then
  # Fall back to jq numeric comparison. jq is already required above so this
  # branch is always reachable.
  OVER="$(jq -n --argjson a "${TOTAL_USD}" --argjson b "${BUDGET_USD}" '$a > $b')"
else
  OVER_RAW="$(echo "${TOTAL_USD} > ${BUDGET_USD}" | bc -l)"
  if [ "${OVER_RAW}" = "1" ]; then OVER=true; else OVER=false; fi
fi

if [ "${OVER}" = "true" ]; then
  echo "==> OVER BUDGET: \$${TOTAL_USD} > \$${BUDGET_USD}"
  echo "==> CI would fail here. Investigate which tools/call(s) blew the budget,"
  echo "    or raise BUDGET_USD intentionally and commit the new ceiling."
  exit 1
fi

echo "==> under budget: \$${TOTAL_USD} <= \$${BUDGET_USD}. Safe to push."
exit 0
