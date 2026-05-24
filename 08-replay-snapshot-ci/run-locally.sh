#!/usr/bin/env bash
# Local mirror of the CI job in `.github-actions-example.yml`. Boots the
# replay server (via `mcp-devtools serve --replay ./fixture.mcptrace`) under
# the hood and runs `client-test.mjs` against it. Same exit-code contract as
# the workflow.
#
# Usage:
#   ./run-locally.sh                                              # uses npx -y @adityachilka/mcp-devtools
#   MCP_DEVTOOLS_PKG='file:/path/to/...0.1.x.tgz' ./run-locally.sh # install a tarball into node_modules
#
# Idempotent: cleans node_modules/.cache and any straggling spawned client on
# EXIT/INT/TERM via a trap. The fixture itself is never modified.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${HERE}"

cat <<BANNER
============================================================
 mcp-devtools example 08 - replay snapshot test (local mirror)
============================================================
  1. fixture trace: ./fixture.mcptrace
  2. replay server: mcp-devtools serve --replay ...
  3. driving client: client-test.mjs (@modelcontextprotocol/sdk)
============================================================
BANNER

# If MCP_DEVTOOLS_PKG was set, install the tarball into ./node_modules so the
# client-test script picks up the local build's `serve --replay`. Mirrors the
# pattern used in examples 06 and 07 — needed until the version that ships
# `serve --replay` lands on npm.
if [ -n "${MCP_DEVTOOLS_PKG:-}" ]; then
  echo "[run-locally] installing @adityachilka/mcp-devtools from ${MCP_DEVTOOLS_PKG}"
  if [ ! -f package.json ]; then
    cat > package.json <<'JSON'
{
  "name": "mcp-devtools-example-08-replay-snapshot-ci",
  "private": true,
  "type": "module",
  "scripts": { "start": "./run-locally.sh" }
}
JSON
  fi
  npm install --no-audit --no-fund --silent "${MCP_DEVTOOLS_PKG}" @modelcontextprotocol/sdk@latest
else
  # Even on the default path we need the SDK installed for client-test.mjs.
  if [ ! -d node_modules/@modelcontextprotocol/sdk ]; then
    if [ ! -f package.json ]; then
      cat > package.json <<'JSON'
{
  "name": "mcp-devtools-example-08-replay-snapshot-ci",
  "private": true,
  "type": "module",
  "scripts": { "start": "./run-locally.sh" }
}
JSON
    fi
    npm install --no-audit --no-fund --silent @modelcontextprotocol/sdk@latest
  fi
fi

CLIENT_PID=""
cleanup() {
  if [ -n "${CLIENT_PID}" ] && kill -0 "${CLIENT_PID}" 2>/dev/null; then
    kill "${CLIENT_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo
echo "[1/2] starting replay server and client ..."
node ./client-test.mjs &
CLIENT_PID=$!
set +e
wait "${CLIENT_PID}"
RC=$?
set -e
CLIENT_PID=""

echo
echo "[2/2] client exit code: ${RC}"
if [ "${RC}" -ne 0 ]; then
  echo "==> snapshot test FAILED. CI would fail here."
  exit 1
fi
echo "==> snapshot test passed. Safe to push."
exit 0
