#!/usr/bin/env node
// Drives the embed-mode server in-process. Boots the server (which boots
// the inspector), sends 4 JSON-RPC requests through the shared transport
// pair, prints each response, and exits cleanly when done.
//
// In a real app the "client" would be the MCP client SDK; the point of
// this script is to generate frames so you can see them light up in the
// inspector at http://localhost:7456/inspect.
import { bootServer } from "./server.mjs";

const PORT = Number(process.env.PORT ?? 7456);

const { clientEnd } = await bootServer({ port: PORT });

let nextId = 1;
/** @type {Map<number, (msg: any) => void>} */
const pending = new Map();

clientEnd.onMessage = (msg) => {
  if (msg && typeof msg === "object" && "id" in msg) {
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg);
    }
  }
};

/** @param {string} method @param {object} [params] */
function request(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    clientEnd.send({ jsonrpc: "2.0", id, method, params: params ?? {} });
  });
}

console.log("[client] driving the embed-mode server in-process ...\n");

const init = await request("initialize", {
  protocolVersion: "2025-03-26",
  clientInfo: { name: "embed-mode-client", version: "0.0.1" },
});
console.log("[client] initialize ->", init.result.serverInfo);

const list = await request("tools/list");
console.log("[client] tools/list ->", list.result.tools.map((t) => t.name).join(", "));

const addResult = await request("tools/call", {
  name: "add",
  arguments: { a: 21, b: 21 },
});
console.log("[client] add(21, 21) ->", addResult.result.content[0].text);

const echoResult = await request("tools/call", {
  name: "echo",
  arguments: { text: "frames captured by mcp-devtools.embed" },
});
console.log("[client] echo(...) ->", echoResult.result.content[0].text);

// Poll the inspector's frames API to confirm everything was recorded.
const res = await fetch(`http://localhost:${PORT}/api/frames?since=0`);
const frames = await res.json();
console.log(`\n[client] ${frames.length} frames captured by the inspector.`);
console.log(`[client] open http://localhost:${PORT}/inspect to browse them.`);
console.log("[client] Ctrl-C to shut down.");
