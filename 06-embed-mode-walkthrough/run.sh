#!/usr/bin/env bash
# Boots the embed-mode walkthrough: starts the inspector + server + client
# in one process, prints the frame count, then waits for Ctrl-C so you can
# browse the inspector at http://localhost:7456/inspect.
#
# Usage:
#   ./run.sh
#   # then: open http://localhost:7456/inspect
#
#   MCP_DEVTOOLS_PKG='file:/path/to/adityachilka-mcp-devtools-0.1.x.tgz' ./run.sh
#                                # install a local build (needed if your npm
#                                # version of @adityachilka/mcp-devtools is
#                                # older than the one that ships `devtools.wrap`).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-7456}"

cat <<BANNER
============================================================
 mcp-devtools example 06 - embed-mode walkthrough
============================================================
  1. installing deps (if needed)
  2. starting server + inspector on port :${PORT}
  3. running in-process client to generate frames
  4. http://localhost:${PORT}/inspect  <- open this
  Ctrl-C to shut down.
============================================================
BANNER

cd "${HERE}"

if [ ! -d node_modules ]; then
  if [ -n "${MCP_DEVTOOLS_PKG:-}" ]; then
    echo "[run.sh] installing @adityachilka/mcp-devtools from ${MCP_DEVTOOLS_PKG}"
    npm install --no-audit --no-fund --silent "${MCP_DEVTOOLS_PKG}"
  fi
  npm install --no-audit --no-fund --silent
fi

# If MCP_DEVTOOLS_PKG was set on a subsequent run (node_modules already
# present), still let it override the dep.
if [ -n "${MCP_DEVTOOLS_PKG:-}" ]; then
  npm install --no-audit --no-fund --silent "${MCP_DEVTOOLS_PKG}" || true
fi

PORT="${PORT}" node ./client.mjs &
CLIENT_PID=$!

cleanup() {
  if kill -0 "${CLIENT_PID}" 2>/dev/null; then
    kill "${CLIENT_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

wait "${CLIENT_PID}"
