#!/usr/bin/env node
// A minimal Streamable-HTTP MCP server demo. No external deps.
//
// - POST /mcp accepts a JSON-RPC request envelope.
// - For `tools/call` it responds with `text/event-stream` (SSE) so the proxy
//   exercises the streaming code path. Everything else is plain `application/json`.
// - `Mcp-Session-Id` is minted on `initialize` and echoed back; subsequent
//   requests must replay the same id (the proxy does this automatically).
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 5555);
const sessions = new Set();

const TOOLS = [
  {
    name: "add",
    description: "Adds two numbers and returns the sum.",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    name: "slow_echo",
    description: "Echoes `text` back after a ~200ms delay (useful for cost timing).",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
];

function handle(req) {
  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2025-03-26",
          serverInfo: { name: "http-demo", version: "0.0.1" },
          capabilities: { tools: {} },
        },
      };
    case "tools/list":
      return { jsonrpc: "2.0", id: req.id, result: { tools: TOOLS } };
    case "tools/call":
      return null; // handled async below
    default:
      if (req.id != null) {
        return {
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32601, message: `unknown method: ${req.method}` },
        };
      }
      return undefined;
  }
}

async function runTool(req) {
  const name = req.params?.name;
  const args = req.params?.arguments ?? {};
  if (name === "add") {
    return { content: [{ type: "text", text: String(Number(args.a) + Number(args.b)) }] };
  }
  if (name === "slow_echo") {
    await new Promise((r) => setTimeout(r, 200));
    return { content: [{ type: "text", text: `echo: ${args.text ?? ""}` }] };
  }
  return { isError: true, content: [{ type: "text", text: `unknown tool: ${name}` }] };
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/mcp") {
    res.writeHead(404).end("not found");
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    res.writeHead(400).end("bad json");
    return;
  }

  let sessionId = req.headers["mcp-session-id"];
  if (body.method === "initialize") {
    sessionId = randomUUID();
    sessions.add(sessionId);
  }
  const headers = { "Mcp-Session-Id": sessionId ?? "" };

  if (body.method === "tools/call") {
    res.writeHead(200, { ...headers, "Content-Type": "text/event-stream" });
    const result = await runTool(body);
    const frame = { jsonrpc: "2.0", id: body.id, result };
    res.write(`data: ${JSON.stringify(frame)}\n\n`);
    res.end();
    return;
  }

  const reply = handle(body);
  if (reply === undefined) {
    res.writeHead(202, headers).end();
    return;
  }
  res.writeHead(200, { ...headers, "Content-Type": "application/json" });
  res.end(JSON.stringify(reply));
});

server.listen(PORT, () => {
  console.error(`http-demo MCP server listening on http://localhost:${PORT}/mcp`);
});
