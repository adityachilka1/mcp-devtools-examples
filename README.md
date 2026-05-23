<div align="center">

# mcp-devtools-examples

**Runnable examples for [`mcp-devtools`](https://github.com/adityachilka1/mcp-devtools).**

Each example is a self-contained directory you can `cd` into and run in under a minute.

[![mcp-devtools](https://img.shields.io/badge/mcp--devtools-v0.1+-000?style=flat-square)](https://github.com/adityachilka1/mcp-devtools)
[![license](https://img.shields.io/badge/license-MIT-000?style=flat-square)](./LICENSE)

</div>

---

## Examples

| Directory | What it shows |
|---|---|
| [`01-proxy-basic`](./01-proxy-basic) | The 60-second tour. Spin up a fake MCP echo-server, proxy it, see frames stream into the inspector. |
| [`02-record-and-share`](./02-record-and-share) | Capture a session to `.mcptrace` and reopen it as a shareable bug-report artifact. |
| [`03-embed-in-server`](./03-embed-in-server) | Bake the inspector into your own MCP server using the `mcp-devtools/embed` API. |
| [`04-http-transport-with-cost`](./04-http-transport-with-cost) | Proxy a Streamable-HTTP + SSE MCP server and watch per-call USD cost attribution roll up. |
| [`05-record-and-diff`](./05-record-and-diff) | Record a baseline session, record a session against a regressed server, and `diff` the two `.mcptrace` files to catch protocol-level breakage. |
| [`06-embed-mode-walkthrough`](./06-embed-mode-walkthrough) | Use `devtools.wrap(transport)` to bake the inspector into your own MCP server in-process — same observability as the proxy, no child process, no stdio dance. |

## Quick start

```bash
git clone https://github.com/adityachilka1/mcp-devtools-examples
cd mcp-devtools-examples/01-proxy-basic
pnpm install   # or npm / bun
pnpm start
```

Each example has its own `README.md` with the full walkthrough.

## What you'll learn

- The wire-level model of MCP — what the JSON-RPC envelopes actually look like for `tools/list`, `tools/call`, notifications.
- How to integrate the inspector into your existing dev loop with zero changes to your server code.
- How to use recorded sessions as bug-report artifacts that don't require screenshots.
- How to think about protocol-level testing for an LLM agent stack.

## Related projects

- [`mcp-devtools`](https://github.com/adityachilka1/mcp-devtools) — the inspector itself.
- [`skillforge`](https://github.com/adityachilka1/skillforge) — CLI + registry for Claude Skills.
- [`agentbench`](https://github.com/adityachilka1/agentbench) — snapshot tests for AI agent traces.

## License

[MIT](./LICENSE) © 2026 Aditya Chilka.
