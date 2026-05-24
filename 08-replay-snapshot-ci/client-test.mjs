#!/usr/bin/env node
// Snapshot test: spawn `mcp-devtools serve --replay ./fixture.mcptrace` and
// drive it with the official @modelcontextprotocol/sdk client over stdio.
//
// What's load-bearing here:
//   - The replay server is fully deterministic. The fixture defines the
//     conversation; the client just walks it. If a future version of the
//     SDK, or the replay server, changes the wire shape, this test fails
//     with a clear assertion.
//   - We exit 0 on success, 1 on any assertion failure. CI keys off the
//     exit code; no log parsing.
//
// Usage:
//   node client-test.mjs                 # uses npx -y @adityachilka/mcp-devtools
//   MCP_DEVTOOLS_PKG='file:/path/to/...0.1.x.tgz' node client-test.mjs
//                                         # installs the tarball into ./node_modules
//                                         # and runs against the local build.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TRACE = join(HERE, "fixture.mcptrace");

if (!existsSync(TRACE)) {
  console.error(`[client-test] fixture missing: ${TRACE}`);
  process.exit(1);
}

// Prefer the locally-installed tarball if `run-locally.sh` set it up, so we
// pick up `serve --replay` even before v0.1.x with replay ships on npm.
const localCli = join(HERE, "node_modules", "@adityachilka", "mcp-devtools", "dist", "cli.js");
const useLocal = existsSync(localCli);

const command = useLocal ? "node" : "npx";
const args = useLocal
  ? [localCli, "serve", "--replay", TRACE, "--quiet"]
  : ["-y", "@adityachilka/mcp-devtools", "serve", "--replay", TRACE, "--quiet"];

console.log(`[client-test] spawning replay server: ${command} ${args.join(" ")}`);

const transport = new StdioClientTransport({ command, args });
const client = new Client({ name: "replay-snapshot-test", version: "0.0.1" }, {});

let failures = 0;
const expect = (label, fn) => {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${label}`);
    console.log(`        ${err.message}`);
  }
};

try {
  await client.connect(transport);
  // After connect(), the SDK has already exchanged initialize and stored the
  // server's reported info. That's our first snapshot assertion.
  const info = client.getServerVersion();
  expect("initialize returns the fixture serverInfo", () => {
    assert.deepEqual(info, { name: "replay-snapshot-fixture", version: "0.0.1" });
  });

  const { tools } = await client.listTools();
  expect("tools/list returns 2 tools in trace order", () => {
    assert.equal(tools.length, 2, `got ${tools.length} tools`);
    assert.equal(tools[0].name, "add");
    assert.equal(tools[1].name, "echo");
  });
  expect("every tool carries description + inputSchema", () => {
    for (const t of tools) {
      assert.ok(t.description, `${t.name} missing description`);
      assert.ok(t.inputSchema, `${t.name} missing inputSchema`);
    }
  });

  const addResult = await client.callTool({
    name: "add",
    arguments: { a: 2, b: 3 },
  });
  expect("tools/call add(2,3) replays '5'", () => {
    assert.equal(addResult.content?.[0]?.text, "5");
  });

  const echoResult = await client.callTool({
    name: "echo",
    arguments: { text: "hello replay" },
  });
  expect("tools/call echo replays the recorded text", () => {
    assert.equal(echoResult.content?.[0]?.text, "hello replay");
  });
} catch (err) {
  failures += 1;
  console.log(`  FAIL  unexpected error`);
  console.log(`        ${err.stack || err.message}`);
} finally {
  await client.close().catch(() => {});
}

if (failures > 0) {
  console.log(`\n==> ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(`\n==> all assertions passed against the replayed trace.`);
process.exit(0);
