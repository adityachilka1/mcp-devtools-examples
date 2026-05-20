#!/usr/bin/env node
// A minimal MCP server. Speaks JSON-RPC over stdio per the protocol spec.
// One tool: `ping`. Exists only so the proxy has something real to talk to.
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin, terminal: false });

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

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
          serverInfo: { name: "echo-server", version: "0.0.1" },
          capabilities: { tools: {} },
        },
      });
      break;

    case "tools/list":
      send({
        jsonrpc: "2.0",
        id: req.id,
        result: {
          tools: [
            {
              name: "ping",
              description: "Echoes its argument back as 'pong: <msg>'.",
              inputSchema: {
                type: "object",
                properties: { msg: { type: "string" } },
                required: ["msg"],
              },
            },
          ],
        },
      });
      break;

    case "tools/call":
      if (req.params?.name === "ping") {
        send({
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [{ type: "text", text: `pong: ${req.params?.arguments?.msg ?? ""}` }],
          },
        });
      } else {
        send({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32601, message: `unknown tool: ${req.params?.name}` },
        });
      }
      break;

    default:
      // Notifications have no id; just ignore unknown methods.
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
