#!/usr/bin/env bash
# Boots the demo HTTP MCP server, then runs mcp-devtools in HTTP-transport mode
# with cost attribution turned on. Kill with Ctrl-C — the trap shuts down both.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-5555}"

cat <<BANNER
============================================================
 mcp-devtools example 04 — HTTP transport + cost attribution
============================================================
  1. starting demo HTTP MCP server on :${PORT}
  2. launching: npx -y @adityachilka/mcp-devtools proxy
       --transport http
       --upstream http://localhost:${PORT}/mcp
       --model claude-sonnet-4-6
  3. open the inspector at http://localhost:7456/inspect
     -> tools/call rows show per-call USD + an aggregate header.
============================================================
BANNER

node "${HERE}/server.mjs" &
SERVER_PID=$!
cleanup() {
  if kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Give the server a beat to bind the port.
sleep 0.5

PORT="${PORT}" npx -y @adityachilka/mcp-devtools proxy \
  --transport http \
  --upstream "http://localhost:${PORT}/mcp" \
  --model claude-sonnet-4-6
