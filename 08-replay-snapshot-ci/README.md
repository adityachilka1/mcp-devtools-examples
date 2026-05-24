## 08 — replay-driven snapshot tests in CI

Spinning up a real MCP server in CI is fragile: network flakes, model
latency, vendor SDK churn, secrets management — all of it leaks into your
client tests. **`mcp-devtools serve --replay <trace>`** ([mcp-devtools#60](https://github.com/adityachilka1/mcp-devtools/pull/60))
turns a previously-recorded `.mcptrace` into a fake MCP server that talks
plain JSON-RPC over stdio, with zero upstream dependency. Record the
session once with `mcp-devtools record`, commit the trace as a fixture,
and from then on your CI client tests run against a known, deterministic
backend — same as a video-tape mock, but at the protocol layer.

The rough loop:

```bash
# 1. Record a real session once (against your actual MCP server).
npx -y @adityachilka/mcp-devtools record \
  --upstream "node ./my-server.js" \
  --out ./fixture.mcptrace

# 2. Commit the trace.
git add fixture.mcptrace && git commit -m "chore: refresh replay fixture"

# 3. In CI, replay it as a fake server. Your client tests connect via stdio
#    just like they would to the real thing.
npx -y @adityachilka/mcp-devtools serve --replay ./fixture.mcptrace
```

Inside the replay process, every recorded `(method, response)` pair is
queued in trace order; when the client sends a request, the next
matching response is shipped back with the client's id swapped in. Same
method called twice → two responses queued → consumed in order. Unknown
methods get a clean JSON-RPC `-32601` so the client sees a fast protocol
error instead of a hang.

## What's in the box

- **`fixture.mcptrace`** — an 8-frame recorded session: `initialize`,
  `tools/list`, `tools/call add(2,3)`, `tools/call echo("hello replay")`.
  Hand-crafted as gzipped JSONL (matching the on-disk format `record`
  writes — see [`trace-store.ts`](https://github.com/adityachilka1/mcp-devtools/blob/main/src/trace-store.ts)
  in mcp-devtools). `_make-fixture.mjs` is the generator we used; it
  ships only as documentation of the fixture's provenance.
- **`client-test.mjs`** — a plain Node test using the official
  `@modelcontextprotocol/sdk` `Client` over stdio. Spawns the replay
  server, calls the same sequence the trace covers, asserts each
  response matches expectations. No vitest dep; exit 0 on pass, 1 on
  fail.
- **`.github-actions-example.yml`** — the workflow. **Rename it to
  `.github/workflows/replay-snapshot.yml` in your real repo to enable
  it.** Triggers on PR + push to `main`, sets up Node 22, installs
  `@adityachilka/mcp-devtools` + `@modelcontextprotocol/sdk`, runs
  `client-test.mjs`.
- **`run-locally.sh`** — runs the same client test locally so you can
  verify before pushing. Same exit-code contract as the workflow.
  Idempotent; trap on EXIT cleans up the spawned child.
- **`expected-output.txt`** — what `run-locally.sh` prints on a happy
  path.

## Prerequisites

- **Node 22+** (matches the workflow). Node 20 works for local runs.
- `@adityachilka/mcp-devtools` with `serve --replay`. The CLI ships in
  the version after `0.1.0`; if the published `^0.1.0` on npm hasn't
  rolled forward yet, install a local build the same way examples 05,
  06, and 07 do:
  ```bash
  # in your mcp-devtools checkout:
  npm pack
  # back in this example:
  MCP_DEVTOOLS_PKG='file:/path/to/adityachilka-mcp-devtools-0.1.x.tgz' ./run-locally.sh
  ```
- `@modelcontextprotocol/sdk` for the client side — `run-locally.sh`
  installs it on first run.

## Run it locally

```bash
./run-locally.sh
```

You'll see something like:

```
[1/2] starting replay server and client ...
[client-test] spawning replay server: node .../dist/cli.js serve --replay ./fixture.mcptrace --quiet
  PASS  initialize returns the fixture serverInfo
  PASS  tools/list returns 2 tools in trace order
  PASS  every tool carries description + inputSchema
  PASS  tools/call add(2,3) replays '5'
  PASS  tools/call echo replays the recorded text

==> all assertions passed against the replayed trace.

[2/2] client exit code: 0
==> snapshot test passed. Safe to push.
```

Exit code is **0** on a green run, **1** when any assertion fails.

## Wire it into your CI

```bash
mkdir -p .github/workflows
cp 08-replay-snapshot-ci/.github-actions-example.yml .github/workflows/replay-snapshot.yml
```

Drop your own recorded trace in place of `fixture.mcptrace`, update the
assertions in `client-test.mjs` to match the conversation you care
about, and commit. From then on, every PR re-runs the same recorded
conversation against your client code.

## When the fixture has to change

The trace is a snapshot of the contract between your client and your
MCP server. When the server adds a tool, renames an argument, or returns
a new field, you re-record:

```bash
npx -y @adityachilka/mcp-devtools record \
  --upstream "node ./my-server.js" \
  --out ./fixture.mcptrace
```

Update the assertions in `client-test.mjs` to match the new shape and
commit the two together. This is the same review surface as a snapshot
file in a typical testing library — diffs in `fixture.mcptrace` (and
the matching code change) are the thing the reviewer is signing off on.

## Why this matters

Live MCP servers in CI are the wrong abstraction for client tests. The
client doesn't care that the upstream is real — it cares that the wire
shape is what it expects. A recorded trace + `serve --replay` gives you
exactly that boundary: deterministic, fast, vendor-free, runnable
offline.

Pair this with example [`05-record-and-diff`](../05-record-and-diff) for
the server-side regression story: `diff` catches drift in what the
**server** sends; replay snapshots catch drift in what the **client**
does with it. Together they cover both halves of the contract.

Back to [the index](../README.md).
