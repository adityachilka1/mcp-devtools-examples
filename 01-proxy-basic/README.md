# 01 — proxy a fake echo server

The 60-second tour. Start a tiny MCP server that responds to `tools/list`, point the proxy at it, and watch the frames stream into the inspector.

## Run it

```bash
pnpm install
pnpm start
```

That launches three things in one terminal:

1. **`echo-server.js`** — a stripped-down MCP server with one tool (`ping`).
2. **`mcp-devtools proxy`** — wraps the echo server.
3. **A driver script** that pipes a couple of JSON-RPC requests into the proxy.

When everything boots, the inspector at `http://localhost:7456/inspect` opens automatically. Click around — every frame in both directions is there.

## What you should see

```
→ initialize
← result · capabilities
→ tools/list
← result · 1 tool (ping)
→ tools/call · ping · { "msg": "hello" }
← result · "pong: hello"
```

## What's in the directory

- `echo-server.js` — 30 lines. Read it first; it's a complete minimal MCP server.
- `driver.js` — sends two requests to the proxy. Replace this with a real MCP client (Claude Desktop, Cursor, your own agent).
- `package.json` — wires it all together.

## Next steps

- Edit `echo-server.js` to add another tool. The inspector updates live.
- Try [example 02](../02-record-and-share) to capture the session to a `.mcptrace` file.
