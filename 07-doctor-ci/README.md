## 07 — `mcp-devtools doctor` in CI

MCP servers drift. A schema field gets renamed in a refactor, `tools/list`
quietly starts returning `{}` instead of `{ tools: [...] }`, a tool drops
its `description` because the type was loosened — all of these break agent
callers but pass server-side unit tests. **`mcp-devtools doctor`** is the
protocol-compliance probe that catches them. This example shows how to
bolt it onto an existing GitHub Actions pipeline so the build goes red the
moment any of the 9 baseline checks regresses.

The checks (as of `mcp-devtools` v0.1.2):

| # | Check |
|---|---|
| 1 | server responds to `initialize` |
| 2 | `initialize.result` has `protocolVersion` |
| 3 | `initialize.result` has `serverInfo` |
| 4 | `initialize.result` has `capabilities` |
| 5 | `tools/list` responds with a `tools` array |
| 6 | every tool has `name` + `description` + `inputSchema` |
| 7 | unknown method returns a JSON-RPC error envelope |
| 8 | request `id`s are echoed back correctly |
| 9 | no malformed JSON-RPC frames on the wire |

When `summary.failed > 0`, the workflow fails with a clear message naming
which check(s) broke — no log grepping, no flaky regex matching.

## What's in the box

- `server.cjs` — a tiny known-good stdio MCP server. Two tools: `add(a, b)`
  and `ping()`. Passes all 9 doctor checks; serves as the subject under
  test for both the workflow and `run-locally.sh`.
- `.github-actions-example.yml` — the workflow file. **Rename it to
  `.github/workflows/mcp-conformance.yml` in your real repo to enable it.**
  Triggers on PR + push to `main`, sets up Node 22, installs
  `@adityachilka/mcp-devtools`, spawns the server, pipes `doctor --json`
  through `jq`, and fails the job on `summary.failed > 0`.
- `run-locally.sh` — runs the same `doctor --json | jq` pipeline locally
  so you can verify before committing. Same exit-code contract as the
  workflow. Idempotent; cleans up after itself via `trap` on EXIT.
- `expected-output.txt` — what `run-locally.sh` prints on a happy server.

## Prerequisites

- **Node 22+** (matches the workflow). Earlier versions work for local
  runs but the workflow pins 22.
- `jq` on the runner (Ubuntu runners ship it; `brew install jq` locally).
- `@adityachilka/mcp-devtools` with `doctor --json`. The CLI ships in
  v0.1.2; if the published `^0.1.0` on npm hasn't rolled forward yet,
  install a local build the same way example 05 and 06 do:
  ```bash
  # in your mcp-devtools checkout:
  npm pack
  # back in this example:
  MCP_DEVTOOLS_PKG='file:/path/to/adityachilka-mcp-devtools-0.1.x.tgz' ./run-locally.sh
  ```

## Run it locally

```bash
./run-locally.sh        # default: probes ./server.cjs via npx -y @adityachilka/mcp-devtools
```

You'll see something like:

```
[1/2] running doctor ...
[2/2] parsing report ...

upstream: node ./server.cjs
version:  0.1.0
summary:  9/9 passed (0 failed)

  PASS  initialize responds
  ...
  PASS  no malformed JSON-RPC frames

==> all checks passed. Safe to push.
```

Exit code is **0** on a clean run, **1** when any check fails.

## Wire it into your CI

```bash
mkdir -p .github/workflows
cp 07-doctor-ci/.github-actions-example.yml .github/workflows/mcp-conformance.yml
```

Tweak the `--upstream "node ./server.cjs"` argument to point at your
server's actual launch command (e.g.
`--upstream "node dist/server.js"`,
`--upstream "python -m my_mcp_server"`,
`--upstream "go run ./cmd/server"`).
The rest of the workflow is server-agnostic.

## The JSON envelope `doctor --json` emits

A single line on stdout — designed to be the only thing the workflow has
to parse:

```json
{
  "version": "0.1.0",
  "upstream": "node ./server.cjs",
  "summary": { "passed": 9, "failed": 0, "total": 9 },
  "checks": [
    { "name": "initialize responds", "passed": true },
    { "name": "tools/list responds with tools array", "passed": true, "message": "2 tools" },
    ...
  ]
}
```

Stable shape. The exit-code logic is one `jq` expression:

```bash
FAILED=$(jq -r '.summary.failed' doctor-report.json)
[ "${FAILED}" -gt 0 ] && exit 1
```

## See the failure path

Temporarily break one check in `server.cjs` — e.g. replace
`result: { tools: TOOLS }` with `result: { notTools: TOOLS }` — and
re-run `./run-locally.sh`:

```
summary:  7/8 passed (1 failed)
  FAIL  tools/list responds with tools array — missing or non-array tools field
  ...
==> doctor reported 1 failing check(s):
      - tools/list responds with tools array — missing or non-array tools field
==> CI would fail here. Fix the regressions above before pushing.
```

Then revert. This is exactly the experience your contributors get when
their PR breaks the wire surface.

## Why this matters

Tool listings and JSON-RPC envelopes are the contract between your
server and every agent caller on the planet. Unit tests on the
server-side won't catch a renamed argument or a missing field — the
server still functions, the test still passes, but every downstream agent
breaks. `doctor` probes the same surface those agents do.

Pair this with example [`05-record-and-diff`](../05-record-and-diff) for
the full regression story: `doctor` catches **spec-level** drift (is
this still a valid MCP server at all?); `diff` catches **payload-level**
drift (did the responses change in a way the agent will notice?). Run
both in CI for maximum coverage.

Back to [the index](../README.md).
