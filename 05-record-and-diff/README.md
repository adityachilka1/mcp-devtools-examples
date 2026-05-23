## 05 — record + diff

Regression-test your MCP server's tool surface. Capture a baseline session
with **`mcp-devtools record`**, capture a current session against a newer
build, then **`mcp-devtools diff`** the two traces. Any drift on the wire —
renamed tool, dropped parameter, schema tweak — shows up as a frame-level
diff with a non-zero exit code, so you can fail a CI job on protocol
regressions.

## What's in the box

- `server-v1.cjs` — baseline stdio MCP server. Two tools: `add(a, b)` and
  `multiply(a, b)`. No deps.
- `server-v2.cjs` — same shape, but with a **deliberate regression**:
  `multiply(a, b)` is renamed to `product(x, y)` (different tool name,
  different parameter names). The kind of break that slips through
  unit tests but ships to agents.
- `fixtures/requests.jsonl` — canned JSON-RPC requests: `initialize`,
  `tools/list`, `tools/call add`. Drives both recordings identically so
  the diff is apples-to-apples.
- `run.sh` — records both traces and diffs them.
- `expected-diff-output.txt` — snapshot of what `diff` prints, so a reader
  can preview the output without running.

## Prerequisites

- **Node 20+**.
- A working `npx` (the CLI is fetched on-demand via
  `npx -y @adityachilka/mcp-devtools` — no global install needed).

## Run it

```bash
./run.sh        # or: npm start
```

That script:

1. Removes any previous `.mcptrace` files (idempotent).
2. Records a session against **v1** to `baseline.mcptrace`:
   ```
   mcp-devtools record --upstream "node ./server-v1.cjs" --out baseline.mcptrace < fixtures/requests.jsonl
   ```
3. Records the same fixture against **v2** to `current.mcptrace`.
4. Runs `mcp-devtools diff baseline.mcptrace current.mcptrace` and exits
   with the diff's exit code.

## What `record` produces

A gzipped JSONL file. Each line is a `{ id, ts, direction, frame }`
envelope: `direction` is `"out"` (client → server) or `"in"`
(server → client), `frame` is the raw JSON-RPC message. Grep-able after
`gunzip -c`:

```bash
gunzip -c baseline.mcptrace | jq -c '{direction, method: .frame.method}'
```

## What `diff` shows

`diff` walks the two frame lists in lockstep. For each pair it compares
direction, JSON-RPC method, error flag, and — when those match — the full
frame body. The output is one line per divergent frame:

```
✗ 1 differences across 6 → 6 frames:
  · frame #4 body differs
```

Frame `#4` in this demo is the inbound `tools/list` response — the new tool
surface. Exit code is **0** when identical, **1** when divergent, which is
exactly what you want in CI.

See `expected-diff-output.txt` for the full snapshot.

## Why this matters

The MCP wire surface *is* your API. An agent caller that hard-codes a tool
name or an argument key breaks the moment the upstream renames a field.
Unit tests on the server side won't catch this — the server still works,
it just talks a different protocol. Wire-level diffing closes that gap:

- **CI gate**: check `baseline.mcptrace` into your repo, re-record on each
  build, fail on non-zero exit.
- **Bisect-friendly**: a one-line diff output tells you exactly which frame
  drifted; no log spelunking.
- **No mocks**: the baseline is a real recorded session, not a hand-written
  expectation.

## Override the CLI

By default `run.sh` uses `npx -y @adityachilka/mcp-devtools`. Point at a
local build (e.g. a development checkout) with:

```bash
MCP_DEVTOOLS='node /path/to/mcp-devtools/dist/cli.js' ./run.sh
```

## Next steps

- Read the [`mcp-devtools` diff docs](https://github.com/adityachilka1/mcp-devtools#diff).
- Pair this with example [`02-record-and-share`](../02-record-and-share) —
  every `.mcptrace` you share already works as a diff baseline.

Back to [the index](../README.md).
