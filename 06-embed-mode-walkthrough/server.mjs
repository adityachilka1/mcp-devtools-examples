#!/usr/bin/env node
// 06 — embed-mode walkthrough.
//
// This server lives inside the same process as its inspector. It uses
// `devtools.wrap(transport)` from `@adityachilka/mcp-devtools/embed` to
// instrument the transport — no proxy child process, no stdio redirection.
//
// `wrap()` mutates the transport in place: it replaces `send` with a
// recording wrapper and installs an `onMessage` getter/setter so the SDK
// Server's own handler assignment is captured. After `wrap()`, anything
// the server sends or receives flows through the inspector at
// http://localhost:7456/inspect.
//
// The transport here is a small in-process pair shim. The real
// `@modelcontextprotocol/sdk` ships `StdioServerTransport`,
// `SSEServerTransport`, and `StreamableHTTPServerTransport`; embed.wrap
// works with any of them and any custom transport with the same
// `{ send, onMessage }` surface.
//
// Run:
//   ./run.sh
//   open http://localhost:7456/inspect
import { devtools } from "@adityachilka/mcp-devtools/embed";

/**
 * In-process transport pair. The "server" end is what the MCP server uses;
 * the "client" end is what client.mjs uses. Frames written to one end's
 * `send` are delivered to the other end's `onMessage`. Structurally
 * identical to the official SDK transports for the purposes of
 * `devtools.wrap()`.
 */
export function createInProcessTransportPair() {
  const serverEnd = {
    /** @type {((msg: unknown) => void) | undefined} */
    onMessage: undefined,
    /** @param {unknown} msg */
    send(msg) {
      queueMicrotask(() => clientEnd.onMessage?.(msg));
    },
  };
  const clientEnd = {
    /** @type {((msg: unknown) => void) | undefined} */
    onMessage: undefined,
    /** @param {unknown} msg */
    send(msg) {
      queueMicrotask(() => serverEnd.onMessage?.(msg));
    },
  };
  return { serverEnd, clientEnd };
}

const PORT = Number(process.env.PORT ?? 7456);

/** Tiny MCP server. Two tools: `add` and `echo`. */
function attachServerHandlers(transport) {
  transport.onMessage = (req) => {
    if (req.method === "initialize") {
      transport.send({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: { name: "embed-mode-walkthrough", version: "0.0.1" },
          capabilities: { tools: {} },
        },
      });
      return;
    }
    if (req.method === "tools/list") {
      transport.send({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          tools: [
            {
              name: "add",
              description: "Add two numbers.",
              inputSchema: {
                type: "object",
                properties: {
                  a: { type: "number" },
                  b: { type: "number" },
                },
                required: ["a", "b"],
              },
            },
            {
              name: "echo",
              description: "Return the input text verbatim.",
              inputSchema: {
                type: "object",
                properties: { text: { type: "string" } },
                required: ["text"],
              },
            },
          ],
        },
      });
      return;
    }
    if (req.method === "tools/call") {
      const name = req.params?.name;
      const args = req.params?.arguments ?? {};
      if (name === "add") {
        const sum = Number(args.a) + Number(args.b);
        transport.send({
          jsonrpc: "2.0",
          id: req.id,
          result: { content: [{ type: "text", text: String(sum) }] },
        });
        return;
      }
      if (name === "echo") {
        transport.send({
          jsonrpc: "2.0",
          id: req.id,
          result: { content: [{ type: "text", text: String(args.text ?? "") }] },
        });
        return;
      }
      transport.send({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `unknown tool: ${name}` },
      });
      return;
    }
    if (req.id != null) {
      transport.send({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `unknown method: ${req.method}` },
      });
    }
  };
}

/**
 * Boot the server + inspector. Returns the (wrapped) client end of the
 * transport pair so client.mjs can drive the server in-process.
 */
export async function bootServer({ port = PORT } = {}) {
  const { serverEnd, clientEnd } = createInProcessTransportPair();

  // ── the line that matters ────────────────────────────────────────────────
  // Wrap BEFORE assigning onMessage / wiring up handlers. wrap() installs
  // the getter/setter that intercepts the SDK Server's onMessage assignment.
  const wrapped = await devtools.wrap(serverEnd, { port });

  attachServerHandlers(wrapped);

  process.stderr.write(`inspector -> http://localhost:${port}/inspect\n`);
  return { clientEnd, wrappedServerEnd: wrapped };
}

// When executed directly (rather than imported), just boot and hold open.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await bootServer();
  // Park the event loop. SIGINT (Ctrl-C) tears the whole process down.
  setInterval(() => {}, 1 << 30);
}
