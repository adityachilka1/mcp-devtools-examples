## 04 — HTTP transport + per-call cost attribution

This example proves out two `mcp-devtools` features that landed together:

1. **`--transport http`** — the proxy speaks **Streamable HTTP + SSE** to an
   upstream MCP server while keeping a plain stdio interface facing your local
   agent. `Mcp-Session-Id` capture and replay happen automatically.
2. **`--model <id>`** — every `tools/call` row in the inspector is annotated
   with a per-call USD estimate, and the top header shows an aggregate total
   for the session.

The example ships its own tiny HTTP-speaking MCP server (`server.mjs`, ~90 LOC,
zero deps) so you can run end-to-end without standing up a real upstream.

## Prerequisites

- **Node 20+** (uses `node:http`, native `fetch`, and top-level `await`).
- A working `npx` (bundled with Node). The proxy is fetched on-demand via
  `npx -y @adityachilka/mcp-devtools` — no global install needed.
- A free TCP port at `5555` for the demo server and `7456` for the inspector.

## Run it

```bash
./run.sh        # or: npm start
```

That script:

1. Launches `server.mjs` in the background on `http://localhost:5555/mcp`.
2. Runs the proxy in HTTP transport mode pointing at the demo server, with
   cost attribution enabled (`--model claude-sonnet-4-6`).
3. Cleans up the demo server when you Ctrl-C.

Once both are up, drive the proxy from any MCP client (Claude Desktop, Cursor,
your own agent) and watch the inspector at <http://localhost:7456/inspect>.

### What's in the box

- `server.mjs` — a minimal HTTP-speaking MCP server. Two tools:
  - `add(a, b)` — returns the sum. Replies as **`application/json`** because
    the proxy treats `tools/call` as streamable but the response is one shot.
  - `slow_echo(text)` — sleeps ~200 ms before replying so the cost+latency
    badges have something interesting to show.
  Non-`tools/call` methods (`initialize`, `tools/list`) return
  `application/json`; `tools/call` returns `text/event-stream` so the proxy
  exercises the SSE code path.
- `run.sh` — orchestrates the demo, prints a banner, traps on exit.
- `package.json` — minimal, no deps.

## What you should see

In the inspector tab:

- **Header**: `transport: http` badge next to `session: 1`, plus an
  `est. spend: $0.000…` chip that ticks up after each `tools/call`.
- **Frames**: every row shows direction, method, latency. `tools/call` rows
  show a USD estimate next to the latency.
- **Detail pane** for a `tools/call` row includes the raw SSE events and the
  parsed JSON-RPC result, side-by-side.

*(Screenshot description — no image is committed: the header shows the
green "http" transport pill, "session: 1" pill, and an "est. spend" chip;
below it, two `tools/call` rows for `add` and `slow_echo` each show a tiny
USD badge.)*

## Use a custom pricing file

The default pricing tables ship with the proxy. To override per-model rates,
pass a YAML file:

```bash
./run.sh                        # defaults
# or:
npx -y @adityachilka/mcp-devtools proxy \
  --transport http \
  --upstream http://localhost:5555/mcp \
  --model claude-sonnet-4-6 \
  --pricing-file ./pricing.yaml
```

`pricing.yaml` schema (one entry per model id):

```yaml
claude-sonnet-4-6:
  input_per_million_usd: 3.00
  output_per_million_usd: 15.00
```

## Custom headers

The HTTP transport also accepts repeatable `--header 'Name: value'` flags,
forwarded to the upstream on every POST. Useful if your real upstream sits
behind an auth proxy:

```bash
npx -y @adityachilka/mcp-devtools proxy \
  --transport http \
  --upstream https://mcp.example.com/mcp \
  --header 'Authorization: Bearer $TOKEN' \
  --header 'X-Tenant: acme' \
  --model claude-sonnet-4-6
```

## Next steps

- Read the [`mcp-devtools` HTTP transport docs](https://github.com/adityachilka1/mcp-devtools#http-transport).
- Read the [cost attribution docs](https://github.com/adityachilka1/mcp-devtools#cost-attribution).
- Point `--upstream` at your real MCP server and watch real cost roll up.

Back to [the index](../README.md).
