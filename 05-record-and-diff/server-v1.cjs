#!/usr/bin/env node
// Baseline MCP server (v1).
// stdio JSON-RPC. Two tools: `add(a,b)` and `multiply(a,b)`.
// Pair with server-v2.cjs to see what `mcp-devtools diff` surfaces when the
// tool surface changes between releases.
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
    name: "multiply",
    description: "Returns a * b.",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
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
      } else if (name === "multiply") {
        send({
          jsonrpc: "2.0",
          id: req.id,
          result: { content: [{ type: "text", text: String(Number(args.a) * Number(args.b)) }] },
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
