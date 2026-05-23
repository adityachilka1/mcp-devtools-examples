#!/usr/bin/env node
// Known-good stdio MCP server used as the subject under test for
// `mcp-devtools doctor`. Two tools: `add(a, b)` and `ping()`. The shape is
// minimal on purpose — just enough to pass every check in the doctor
// baseline (initialize/result.protocolVersion + serverInfo + capabilities,
// tools/list with a tools array where every entry has name + description +
// inputSchema, and a JSON-RPC error envelope for an unknown method).
//
// If you tweak this server in a way that drops one of those checks, the
// `run-locally.sh` script (and the matching GitHub Actions workflow) will
// fail with a clear "summary.failed > 0" message — which is the point of
// the example.
const readline = require("node:readline");

const rl = readline.createInterface({ input: process.stdin, terminal: false });
const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);

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
    name: "ping",
    description: "Returns the string 'pong'. Smoke-test tool.",
    inputSchema: {
      type: "object",
      properties: {},
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
          serverInfo: { name: "doctor-ci-example", version: "0.0.1" },
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
          result: {
            content: [{ type: "text", text: String(Number(args.a) + Number(args.b)) }],
          },
        });
      } else if (name === "ping") {
        send({
          jsonrpc: "2.0",
          id: req.id,
          result: { content: [{ type: "text", text: "pong" }] },
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
      // Doctor specifically probes this branch with `this/definitely-does-not-exist`.
      // Returning a JSON-RPC error envelope (not a result) is what makes the
      // "unknown method returns JSON-RPC error envelope" check pass.
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
