# 02 — record a session, share it, reopen it

When you file an MCP bug report today, you usually paste a screenshot of a log. That loses the structure. With `mcp-devtools record` you can attach the full wire-level transcript — every frame, in order, with timing — as a single gzipped file.

## Run it

```bash
pnpm install
pnpm capture     # records a session to ./out/session.mcptrace
pnpm view        # reopens the recording in the inspector
```

## What's happening

`pnpm capture` runs:

```bash
mcp-devtools record \
  --upstream "node ../01-proxy-basic/echo-server.js" \
  --out ./out/session.mcptrace < ./fixtures/requests.jsonl
```

`fixtures/requests.jsonl` contains a few canned requests that drive the echo server. In a real workflow this would be your MCP client (Claude Desktop, Cursor, etc.) producing the requests.

The output is a gzipped JSONL file — about 1 KB for a small session, scales linearly. It's grep-able after gunzip and reproducibly replays in the inspector.

## Inspecting the trace without the UI

```bash
gunzip -c out/session.mcptrace | jq -s 'group_by(.direction) | map({direction:.[0].direction, count:length})'
```

That prints how many frames went in each direction. Useful for CI assertions.

## When to use this

- **Bug reports**: attach `.mcptrace` instead of a screenshot.
- **Regression tests**: check a `.mcptrace` into your repo and re-run periodically.
- **Sharing**: send to a teammate so they see the exact session you saw.

Next: [example 03 — embed the inspector into your own server](../03-embed-in-server).
