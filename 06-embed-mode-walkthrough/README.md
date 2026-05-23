## 06 — embed-mode walkthrough

The proxy mode (examples [`01`](../01-proxy-basic) and [`04`](../04-http-transport-with-cost))
runs the inspector as a child process between your agent and an MCP server.
**Embed mode** does the same observability — frames, costs, replay — but
**in-process**, with no proxy, no stdio redirection, no extra spawn. You
import `@adityachilka/mcp-devtools/embed`, call `devtools.wrap(transport)`
before `server.connect(transport)`, and you're done.

This example is the full picture: a tiny MCP server, a tiny in-process
client driving it, and `wrap()` quietly recording every frame to the
inspector at <http://localhost:7456/inspect>.

## When to reach for embed vs proxy

| Use **embed** when… | Use **proxy** when… |
|---|---|
| You author the MCP server | You're debugging someone else's server |
| You want zero spawn overhead in tests | You can't modify the server |
| You're shipping a server SDK or template | You're hooking into Claude Desktop, Cursor, etc. |
| You want the inspector tied to the server's lifecycle | You need a transport bridge (stdio → HTTP) |

Frame format is identical to proxy mode, so a recording made in embed mode
replays in the proxy and vice-versa.

## What's in the box

- **`server.mjs`** — a tiny MCP server. Two tools, `add(a, b)` and
  `echo(text)`. Uses a small in-process transport pair (same `{ send,
  onMessage }` shape as the official SDK transports) so the example runs
  without a stdio dance.
- **`client.mjs`** — boots the server, walks through `initialize`,
  `tools/list`, `tools/call add`, `tools/call echo`, then curls
  `/api/frames` to confirm everything was recorded.
- **`run.sh`** — `npm install`s deps and runs the client; the inspector
  serves at `:7456` until Ctrl-C.
- **`expected-output.txt`** — what you see in the terminal at the end.

## Prerequisites

- **Node 20+** (top-level `await`, native `fetch`).
- A free TCP port at `7456` for the inspector.
- `@adityachilka/mcp-devtools` with the `devtools.wrap()` API. The
  published `^0.1.0` ships `devtools.attach(server)`; `wrap()` is the
  v0.2 successor. Until v0.2 lands on npm, install a local build:
  ```bash
  # in your mcp-devtools checkout:
  npm pack
  # back in this example:
  MCP_DEVTOOLS_PKG='file:/path/to/adityachilka-mcp-devtools-0.1.0.tgz' ./run.sh
  ```

## Run it

```bash
./run.sh        # or: npm start
```

You'll see something like:

```
[client] driving the embed-mode server in-process ...

[client] initialize -> { name: 'embed-mode-walkthrough', version: '0.0.1' }
[client] tools/list -> add, echo
[client] add(21, 21) -> 42
[client] echo(...) -> frames captured by mcp-devtools.embed

[client] 8 frames captured by the inspector.
[client] open http://localhost:7456/inspect to browse them.
[client] Ctrl-C to shut down.
```

That **`8 frames captured`** line is the proof that `wrap()` did its
job: 4 client→server requests (`initialize`, `tools/list`, two
`tools/call`s) + 4 server→client responses = 8 wire frames the inspector
now holds.

## The five lines that matter

In `server.mjs`:

```js
import { devtools } from "@adityachilka/mcp-devtools/embed";
// ... build your transport however you normally would ...
const transport = await devtools.wrap(serverEnd, { port: 7456 });
// ... wire up server handlers on the wrapped transport ...
```

`wrap()` returns the same transport object (mutated). The mutation is
two-part:

1. **`transport.send`** — replaced with a wrapper that records each
   outgoing frame and forwards to the original.
2. **`transport.onMessage`** — `Object.defineProperty` getter/setter
   installed. The SDK Server assigns `transport.onMessage = handler`
   inside `connect()`; our setter stores it, and the getter returns a
   wrapped handler that records each incoming frame before invoking the
   user's handler.

No SDK dependency. Works with `StdioServerTransport`,
`SSEServerTransport`, `StreamableHTTPServerTransport`, or any custom
transport that exposes `{ send, onMessage }` (like the in-process pair
shim in this example).

## Verify the frames programmatically

The inspector exposes its trace store at `/api/frames?since=<id>`. Useful
for snapshot tests and CI assertions:

```bash
curl -s 'http://localhost:7456/api/frames?since=0' | jq length
# 10
```

Each frame is `{ id, ts, direction, frame, cost? }` where `direction` is
`"in"` (server → client) or `"out"` (client → server) and `frame` is the
raw JSON-RPC envelope.

## Next steps

- Pair this with example [`02-record-and-share`](../02-record-and-share):
  embed mode happily writes the same `.mcptrace` format.
- Compare with example [`03-embed-in-server`](../03-embed-in-server) —
  same `wrap()` API, briefer scope; this example is the fuller
  walkthrough.
- Read the [`mcp-devtools` embed docs](https://github.com/adityachilka1/mcp-devtools#embed).

Back to [the index](../README.md).
