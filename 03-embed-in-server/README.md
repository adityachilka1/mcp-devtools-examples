# 03 — embed the inspector into your own MCP server

If you author the MCP server, you don't need the proxy at all. The new `devtools.wrap()` API instruments your transport in five lines and works with the official `@modelcontextprotocol/sdk` Server.

## Run it

```bash
pnpm install
pnpm start
# server starts, inspector lives at http://localhost:7456/inspect
```

In another terminal:

```bash
pnpm drive
```

Watch the inspector tab; requests show up live.

## The code that matters

In `server.js`:

```js
import { createServer } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { devtools } from "@adityachilka/mcp-devtools/embed";

const server = createServer({ name: "my-server", version: "1.0.0" });
// ... register tools normally ...

// Wrap the transport BEFORE passing it to connect().
const transport = await devtools.wrap(new StdioServerTransport(), { port: 7456 });
await server.connect(transport);
```

That's it. `wrap()` returns the same transport object (mutated) — anything you do with it afterwards flows through the inspector.

### What `wrap()` actually does

1. **`transport.send`** — replaced with a wrapper that records the outgoing frame and forwards to the original.
2. **`transport.onMessage`** — `Object.defineProperty` getter/setter installed. The SDK Server assigns `transport.onMessage = handler` inside `connect()`; our setter stores it. When the underlying transport's read loop calls `this.onMessage(msg)`, the call flows through our recorder before reaching the user's handler.

No SDK dependency. Works with `StdioServerTransport`, `SSEServerTransport`, `StreamableHTTPServerTransport`, or any custom transport with `{ send, onMessage }`.

## When to use embed vs proxy

| Use **embed** when… | Use **proxy** when… |
|---|---|
| You author the server | You're debugging someone else's server |
| You want the inspector to follow the server's lifecycle | You want zero changes to the server |
| You're shipping a server SDK / template | You're integrating with Claude Desktop, Cursor, etc. |

Both modes write the same `.mcptrace` format, so recordings made one way replay in the other.

## Backward compatibility

The legacy `devtools.attach(server)` API still works for v0.1.x but is `@deprecated` — switch to `wrap()` whenever you can. It's removed in v0.2.

Next: example 04 — replay + diff — coming in mcp-devtools v0.2.
