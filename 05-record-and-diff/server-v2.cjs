#!/usr/bin/env node
// Regressed MCP server (v2).
// Same wire shape as server-v1.cjs except `multiply(a, b)` was renamed to
// `product(x, y)` — a small but realistic breaking change that the next
// `tools/list` round-trip should make obvious. `mcp-devtools diff` against a
// v1 trace surfaces this as a body diff on the `tools/list` frame.
const readline = require("node:readline");

const rl = readline.createInterface({ input: process.stdin, terminal: false });
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

const TOOLS = [
  {
    name: "add",
    description: "Returns a + b.",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    // REGRESSION: renamed from `multiply` and the parameter names changed
    // from (a, b) to (x, y). A caller that hard-coded `multiply` or that
    // passed `{ a, b }` will break.
    name: "product",
    description: "Returns x * y.",
    inputSchema: {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" } },
      required: ["x", "y"],
    },
  },
];

rl.on("line", (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  switch (req.method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: { name: "calc-server", version: "1.0.0" },
          capabilities: { tools: {} },
        },
      });
      break;

    case "tools/list":
      send({ jsonrpc: "2.0", id: req.id, result: { tools: TOOLS } });
      break;

    case "tools/call": {
      const name = req.params?.name;
      const args = req.params?.arguments ?? {};
      if (name === "add") {
        send({
          jsonrpc: "2.0",
          id: req.id,
          result: { content: [{ type: "text", text: String(Number(args.a) + Number(args.b)) }] },
        });
      } else if (name === "product") {
        send({
          jsonrpc: "2.0",
          id: req.id,
          result: { content: [{ type: "text", text: String(Number(args.x) * Number(args.y)) }] },
        });
      } else {
        send({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32601, message: `unknown tool: ${name}` },
        });
      }
      break;
    }

    default:
      if (req.id != null) {
        send({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32601, message: `unknown method: ${req.method}` },
        });
      }
  }
});

rl.on("close", () => process.exit(0));
