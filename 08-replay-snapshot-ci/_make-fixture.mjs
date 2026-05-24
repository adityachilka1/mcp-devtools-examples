#!/usr/bin/env node
// One-shot generator for ./fixture.mcptrace.
//
// We can't easily run `mcp-devtools record` inside CI here, so we hand-build
// the trace using the documented `.mcptrace` format (gzipped JSONL, one
// StoredFrame envelope per line — see `trace-store.ts` in mcp-devtools).
// The frames below are the exact shape `record` would have written if pointed
// at a tiny upstream that exposes `add` and `echo`.
//
// Run once: `node _make-fixture.mjs` -> writes ./fixture.mcptrace.
// Commit the resulting binary; this generator is kept only as documentation
// of how the fixture was produced.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const ts0 = 1_700_000_000_000;
const tools = [
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
    name: "echo",
    description: "Returns the input string unchanged.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
];

const frames = [
  // 1. initialize request (client -> server)
  {
    id: 1,
    direction: "out",
    ts: ts0,
    frame: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        clientInfo: { name: "fixture-client", version: "0.0.1" },
        capabilities: {},
      },
    },
  },
  // 2. initialize response (server -> client)
  {
    id: 2,
    direction: "in",
    ts: ts0 + 10,
    frame: {
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "replay-snapshot-fixture", version: "0.0.1" },
        capabilities: { tools: {} },
      },
    },
  },
  // 3. tools/list request
  {
    id: 3,
    direction: "out",
    ts: ts0 + 20,
    frame: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  },
  // 4. tools/list response
  {
    id: 4,
    direction: "in",
    ts: ts0 + 30,
    frame: { jsonrpc: "2.0", id: 2, result: { tools } },
  },
  // 5. tools/call add(2, 3)
  {
    id: 5,
    direction: "out",
    ts: ts0 + 40,
    frame: {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "add", arguments: { a: 2, b: 3 } },
    },
  },
  // 6. tools/call add -> "5"
  {
    id: 6,
    direction: "in",
    ts: ts0 + 50,
    frame: {
      jsonrpc: "2.0",
      id: 3,
      result: { content: [{ type: "text", text: "5" }] },
    },
  },
  // 7. tools/call echo("hello replay")
  {
    id: 7,
    direction: "out",
    ts: ts0 + 60,
    frame: {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "echo", arguments: { text: "hello replay" } },
    },
  },
  // 8. tools/call echo -> "hello replay"
  {
    id: 8,
    direction: "in",
    ts: ts0 + 70,
    frame: {
      jsonrpc: "2.0",
      id: 4,
      result: { content: [{ type: "text", text: "hello replay" }] },
    },
  },
];

const jsonl = `${frames.map((f) => JSON.stringify(f)).join("\n")}\n`;
writeFileSync("./fixture.mcptrace", gzipSync(Buffer.from(jsonl, "utf8")));
console.log(`wrote fixture.mcptrace (${frames.length} frames)`);
