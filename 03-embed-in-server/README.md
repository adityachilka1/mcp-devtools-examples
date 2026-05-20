# 03 — embed the inspector into your own MCP server

If you author the MCP server, you don't need the proxy at all. Five lines of code wires the inspector directly into your server process.

## Run it

```bash
pnpm install
pnpm start
# server starts, inspector lives at http://localhost:7456/inspect
```

In another terminal, drive it:

```bash
node ./drive.js
```

Watch the inspector tab; the requests show up live.

## The code that matters

In `server.js`:

```js
import { createServer } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { devtools } from "mcp-devtools/embed";

const server = createServer({ name: "my-server", version: "1.0.0" });
// ... register tools normally ...

const transport = new StdioServerTransport();
await server.connect(transport);

// One line. Inspector now sees everything the server sends and receives.
await devtools.attach(server, { port: 7456 });
```

The `devtools.attach` call wraps the server's transport hooks so every `onMessage` and `send` is recorded.

## When to use embed vs proxy

| Use **embed** when… | Use **proxy** when… |
|---|---|
| You author the server | You're debugging someone else's server |
| You want the inspector to follow the server's lifecycle automatically | You want zero changes to the server |
| You're shipping a server SDK / template | You're integrating with Claude Desktop, Cursor, etc. |

Both modes write the same `.mcptrace` format, so recordings made one way replay in the other.

Next: example 04 ([replay + diff](../04-replay-and-diff)) — coming in mcp-devtools v0.2.
