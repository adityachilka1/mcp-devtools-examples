#!/usr/bin/env node
// Demonstrates `mcp-devtools/embed` v0.1.1+ with the new `devtools.wrap()` API.
//
// The wrap() function takes any MCP-SDK-compatible transport and returns the
// same object with `send`/`onMessage` instrumented. Pass the wrapped transport
// to `server.connect(transport)` — the SDK Server's onMessage assignment is
// intercepted by our getter/setter and routed through the inspector.
//
// Run:
//   pnpm install
//   pnpm start          # in one shell
//   pnpm drive          # in another
//   open http://localhost:7456/inspect
import readline from "node:readline";
import { devtools } from "@adityachilka/mcp-devtools/embed";

// A minimal MCP transport. The real `@modelcontextprotocol/sdk` ships
// StdioServerTransport / StreamableHTTPServerTransport; this is a structurally
// equivalent shim so the example runs without the SDK as a dep.
class StdioTransportShim {
  constructor() {
    /** @type {((msg:unknown)=>void) | undefined} */
    this.onMessage = undefined;
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        this.onMessage?.(JSON.parse(line));
      } catch {
        /* malformed line — ignore in this demo */
      }
    });
    rl.on("close", () => process.exit(0));
  }
  send(msg) {
    process.stdout.write(JSON.stringify(msg) + "\n");
  }
}

// Wrap the transport BEFORE handing it to your server.
const transport = await devtools.wrap(new StdioTransportShim(), { port: 7456 });
process.stderr.write("inspector → http://localhost:7456/inspect\n");

// Minimal MCP server that uses the wrapped transport.
transport.onMessage = (req) => {
  if (req.method === "initialize") {
    transport.send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "embed-example", version: "0.0.1" },
        capabilities: { tools: {} },
      },
    });
  } else if (req.method === "tools/list") {
    transport.send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        tools: [{ name: "echo", description: "Returns its input", inputSchema: { type: "object" } }],
      },
    });
  } else if (req.method === "tools/call") {
    transport.send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        content: [{ type: "text", text: JSON.stringify(req.params?.arguments ?? {}) }],
      },
    });
  } else if (req.id != null) {
    transport.send({
      jsonrpc: "2.0",
      id: req.id,
      error: { code: -32601, message: `unknown method: ${req.method}` },
    });
  }
};
