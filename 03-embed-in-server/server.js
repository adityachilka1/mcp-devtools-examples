#!/usr/bin/env node
// Demonstrates `mcp-devtools/embed` — five extra lines attach the inspector
// to an MCP server you author. The rest of the file is a stock MCP server
// that lists one tool and answers it.
//
// NOTE: this example references the @modelcontextprotocol/sdk API surface.
// The exact import paths shift between SDK versions; if yours differs,
// check the SDK README. The `devtools.attach()` call is the only line
// specific to mcp-devtools.
import readline from "node:readline";
import { devtools } from "mcp-devtools/embed";

// ─── Minimal MCP server (stdio, JSON-RPC) ──────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, terminal: false });
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");

// We expose a structural "server" object so devtools.attach can wrap it
// without depending on the SDK class shape. In a real SDK-based server,
// you'd pass the SDK's Server instance directly.
const fakeTransport = {
  onMessage: (msg) => handle(msg),
  send: (msg) => send(msg),
};
const server = { _transport: fakeTransport };

function handle(req) {
  if (req.method === "initialize") {
    fakeTransport.send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "embed-example", version: "0.0.1" },
        capabilities: { tools: {} },
      },
    });
  } else if (req.method === "tools/list") {
    fakeTransport.send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        tools: [
          { name: "echo", description: "Returns its input", inputSchema: { type: "object" } },
        ],
      },
    });
  } else if (req.method === "tools/call") {
    fakeTransport.send({
      jsonrpc: "2.0",
      id: req.id,
      result: { content: [{ type: "text", text: JSON.stringify(req.params?.arguments ?? {}) }] },
    });
  } else if (req.id != null) {
    fakeTransport.send({
      jsonrpc: "2.0",
      id: req.id,
      error: { code: -32601, message: `unknown method: ${req.method}` },
    });
  }
}

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    fakeTransport.onMessage(JSON.parse(line));
  } catch {
    /* malformed input — log and ignore */
  }
});

// ─── The whole point of this example ───────────────────────────────────────
await devtools.attach(server, { port: 7456 });
process.stderr.write("inspector → http://localhost:7456/inspect\n");
