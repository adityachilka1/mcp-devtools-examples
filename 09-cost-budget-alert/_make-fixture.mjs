#!/usr/bin/env node
// One-shot generator for ./fixture.mcptrace.
//
// Same hand-build approach example 08 uses — we can't run `mcp-devtools
// record` inside this repo's CI, so we synthesize the trace using the
// documented `.mcptrace` on-disk format (gzipped JSONL, one StoredFrame
// envelope per line; see `trace-store.ts` in mcp-devtools).
//
// The conversation here is deliberately small (8 frames: initialize +
// tools/list + 3 × tools/call) so the trace is cheap to ship as a fixture
// AND so the priced cost stays low — letting us demonstrate both the
// happy path (BUDGET_USD=0.05) and the failure path (BUDGET_USD=0.000001)
// without needing different traces.
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
    name: "search",
    description: "Pretend full-text search over an internal corpus.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
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
        clientInfo: { name: "budget-alert-fixture", version: "0.0.1" },
        capabilities: {},
      },
    },
  },
  // 2. initialize response
  {
    id: 2,
    direction: "in",
    ts: ts0 + 8,
    frame: {
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        serverInfo: { name: "budget-alert-fixture-server", version: "0.0.1" },
        capabilities: { tools: {} },
      },
    },
  },
  // 3. tools/list request
  {
    id: 3,
    direction: "out",
    ts: ts0 + 16,
    frame: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  },
  // 4. tools/list response
  {
    id: 4,
    direction: "in",
    ts: ts0 + 24,
    frame: { jsonrpc: "2.0", id: 2, result: { tools } },
  },
  // 5. tools/call add(2, 3)
  {
    id: 5,
    direction: "out",
    ts: ts0 + 32,
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
    ts: ts0 + 44,
    frame: {
      jsonrpc: "2.0",
      id: 3,
      result: { content: [{ type: "text", text: "5" }] },
    },
  },
  // 7. tools/call search("mcp inspector")
  {
    id: 7,
    direction: "out",
    ts: ts0 + 56,
    frame: {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "search", arguments: { query: "mcp inspector" } },
    },
  },
  // 8. tools/call search -> a small results blob
  {
    id: 8,
    direction: "in",
    ts: ts0 + 92,
    frame: {
      jsonrpc: "2.0",
      id: 4,
      result: {
        content: [
          {
            type: "text",
            text: "1. mcp-devtools — chrome devtools for MCP\n2. inspector pane — protocol traffic\n3. cost annotator — usd per tools/call",
          },
        ],
      },
    },
  },
];

const jsonl = `${frames.map((f) => JSON.stringify(f)).join("\n")}\n`;
writeFileSync("./fixture.mcptrace", gzipSync(Buffer.from(jsonl, "utf8")));
console.log(`wrote fixture.mcptrace (${frames.length} frames)`);
