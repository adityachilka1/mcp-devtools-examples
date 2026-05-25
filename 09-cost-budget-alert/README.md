## 09 — cost-budget alert in CI

As an agent stack matures, two things creep in lockstep: prompt templates
grow (someone adds another system-message section, a few-shot example, an
extra schema field) and tool-call volume creeps up (a new retry loop, a
fallback chain, an additional planning round-trip). Each individual
change is fine in review; the aggregate is a slow-motion regression
where every recorded conversation costs 1.4× what it did last quarter
and nobody can point at the commit that did it.

**`mcp-devtools summary <trace> --model <id> --json`** ([mcp-devtools#62](https://github.com/adityachilka1/mcp-devtools/pull/62))
emits a stable one-line envelope with `cost.totalUsd` for any recorded
session. Commit a representative `.mcptrace` as a fixture, run `summary`
in CI, gate on the dollar number — and the moment a PR drifts the cost
past a chosen ceiling, the build goes red with the exact cost and budget
in the failure message.

The rough loop:

```bash
# 1. Record a representative session once (against your real MCP server).
npx -y @adityachilka/mcp-devtools record \
  --upstream "node ./my-server.js" \
  --out ./fixture.mcptrace

# 2. Commit the trace, pick a budget you'd be unhappy to exceed.
git add fixture.mcptrace && git commit -m "chore: refresh cost-budget fixture"

# 3. In CI, summarise it and gate on cost.totalUsd.
npx -y @adityachilka/mcp-devtools summary ./fixture.mcptrace \
  --model gpt-4o-mini --json \
  | jq -e '.cost.totalUsd <= 0.01'
```

When the recorded conversation legitimately grows — new tool, longer
prompt, intentional extra round-trip — re-record the fixture and bump
`BUDGET_USD` in the same commit. The PR review then includes the
intentional cost change as a first-class diff, not a number buried in a
log somewhere.

## What's in the box

- **`fixture.mcptrace`** — an 8-frame recorded session: `initialize`,
  `tools/list`, `tools/call add(2,3)`, `tools/call search("mcp inspector")`.
  Hand-crafted as gzipped JSONL (matching the on-disk format `record`
  writes — see [`trace-store.ts`](https://github.com/adityachilka1/mcp-devtools/blob/main/src/trace-store.ts)
  in mcp-devtools). `_make-fixture.mjs` is the generator we used; it
  ships only as documentation of the fixture's provenance.
- **`check-budget.sh`** — runs `summary --json`, parses
  `.cost.totalUsd` with `jq`, compares against `BUDGET_USD` (default
  `0.05`), exits 0 if under, 1 if over. Clear failure message names
  both the cost AND the budget. Also fails fast on
  `cost.totalUsd == null` (which means the `--model` flag didn't match
  the pricing table — silently passing would defeat the gate).
- **`.github-actions-example.yml`** — the workflow. **Rename it to
  `.github/workflows/cost-budget.yml` in your real repo to enable it.**
  Triggers on PR + push to `main`, sets up Node 22, installs
  `@adityachilka/mcp-devtools`, runs `check-budget.sh` with
  `BUDGET_USD: 0.01`, uploads `summary-report.json` as a build artifact.
- **`run-locally.sh`** — runs the same check locally so you can verify
  before pushing. Same exit-code contract as the workflow. Idempotent;
  trap on EXIT scrubs the report and any straggling child.
- **`expected-output.txt`** — what `run-locally.sh` prints on a happy
  path.

## Prerequisites

- **Node 22+** (matches the workflow). Earlier versions work for local
  runs but the workflow pins 22.
- `jq` on the runner (Ubuntu runners ship it; `brew install jq` locally).
- `@adityachilka/mcp-devtools` with `summary --model --json`. The CLI
  ships in v0.1.x; if the published `^0.1.0` on npm hasn't rolled
  forward yet, install a local build the same way examples 05, 06, 07,
  and 08 do:
  ```bash
  # in your mcp-devtools checkout:
  npm pack
  # back in this example:
  MCP_DEVTOOLS_PKG='file:/path/to/adityachilka-mcp-devtools-0.1.x.tgz' ./run-locally.sh
  ```

## Run it locally

```bash
./run-locally.sh                       # default budget = $0.05
BUDGET_USD=0.01 ./run-locally.sh       # tighter ceiling
BUDGET_USD=0.000001 ./run-locally.sh   # demo the failure path
```

You'll see something like:

```
[1/2] running check-budget.sh ...
[1/3] summarising trace: ./fixture.mcptrace
       model: gpt-4o-mini
      budget: $0.05
[2/3] parsing cost from report ...
[3/3] comparing against budget ...

  total cost      : $0.0000492
  budget          : $0.05
  priced calls    : 2 / 2
  basis           : cloud-tokens

==> under budget: $0.0000492 <= $0.05. Safe to push.

[2/2] check-budget exit code: 0
==> budget gate passed. Safe to push.
```

Exit code is **0** on a green run, **1** when the cost exceeds the
budget (or the trace can't be priced).

## Wire it into your CI

```bash
mkdir -p .github/workflows
cp 09-cost-budget-alert/.github-actions-example.yml .github/workflows/cost-budget.yml
```

Drop your own recorded trace in place of `fixture.mcptrace`, adjust
`BUDGET_USD` in the workflow `env` block to a number you'd be unhappy to
exceed, and commit. From then on, every PR re-prices the same recorded
conversation and fails the build the moment it crosses the line.

## The JSON envelope `summary --json` emits

A single line on stdout — designed to be the only thing the gate has to
parse:

```json
{
  "path": "./fixture.mcptrace",
  "totalFrames": 8,
  "wallClockMs": 92,
  "pairedRequests": 4,
  "errorCount": 0,
  "byMethod": [
    { "method": "tools/call", "count": 2, "p95Ms": 36, "errorRate": 0 },
    ...
  ],
  "slowest": [ ... ],
  "cost": {
    "totalUsd": 0.0000492,
    "modelId": "gpt-4o-mini",
    "pricedCalls": 2,
    "pricedWithCost": 2,
    "bases": ["cloud-tokens"]
  }
}
```

The exit-code logic is one `jq` expression:

```bash
TOTAL=$(jq -r '.cost.totalUsd' summary-report.json)
jq -n --argjson a "${TOTAL}" --argjson b "${BUDGET_USD}" '$a > $b' \
  | grep -q true && exit 1
```

`check-budget.sh` wraps this with a `null`-check (no priced calls = the
gate is meaningless, fail loud) and a friendlier error message.

## See the failure path

Re-run with a budget tighter than the fixture's cost:

```bash
BUDGET_USD=0.000001 ./run-locally.sh
```

```
  total cost      : $0.0000492
  budget          : $0.000001
  priced calls    : 2 / 2
  basis           : cloud-tokens

==> OVER BUDGET: $0.0000492 > $0.000001
==> CI would fail here. Investigate which tools/call(s) blew the budget,
    or raise BUDGET_USD intentionally and commit the new ceiling.

[2/2] check-budget exit code: 1
==> budget gate FAILED. CI would fail here.
```

Exit code is **1**. This is exactly the experience your contributors get
when their PR pushes the recorded session over the line.

## Why this matters

The three regression vectors an agent stack actually drifts on:

| Vector | Caught by |
|---|---|
| Wire-shape / protocol drift | [`07-doctor-ci`](../07-doctor-ci) (`mcp-devtools doctor`) |
| Client-side output drift | [`08-replay-snapshot-ci`](../08-replay-snapshot-ci) (`serve --replay`) |
| Cost / volume drift | **this example** (`summary --model`) |

Run all three together. `doctor` catches the day the server breaks the
contract; `replay` catches the day the client breaks its half of it;
`summary` catches the slow burn that doesn't trip either of the first
two — the build that's still green but is quietly costing 3× what it
used to.

Back to [the index](../README.md).
