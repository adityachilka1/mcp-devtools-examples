#!/usr/bin/env node
// Drives the embed-example server. Connects to it over stdio via a spawned
// child and pushes a few requests. Real clients won't look like this — they'd
// connect via the MCP SDK's client transport.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const child = spawn("node", [resolve(here, "server.js")], { stdio: ["pipe", "pipe", "inherit"] });

const requests = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", clientInfo: { name: "drive", version: "0.0.1" } } },
  { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: { text: "hello from drive.js" } } },
];

for (const r of requests) child.stdin.write(JSON.stringify(r) + "\n");

child.stdout.on("data", (chunk) => process.stdout.write(chunk));

setTimeout(() => {
  child.stdin.end();
  child.kill();
}, 1500);
