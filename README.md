# Mind2Flow Agents SDK & CLI

Build, manage and execute AI agents on the [Mind2Flow](https://app.mind2flow.io) platform — from TypeScript, your terminal, CI pipelines, or an AI coding assistant.

| Package | What it is | Install |
| --- | --- | --- |
| [`@mind2flow/agents-sdk`](packages/sdk) | Typed, **zero-dependency** TypeScript client for the Mind2Flow REST API v1 | `npm install @mind2flow/agents-sdk` |
| [`@mind2flow/cli`](packages/cli) | The `m2f` command-line interface, built on the SDK | `npm install -g @mind2flow/cli` |

Both cover the full platform surface: **AI agents, multi-agent crews, devices (WhatsApp/SMS/email/web), custom Python tools, scheduled tasks, and the GraphOS knowledge graph.**

## Contents

- [Getting an API key](#getting-an-api-key)
- [SDK](#sdk)
- [CLI](#cli)
- [CLI command reference](#cli-command-reference)
- [Knowledge graph (GraphOS)](#knowledge-graph-graphos)
- [Using the CLI from AI coding assistants](#using-the-cli-from-ai-coding-assistants)
- [MCP server](#mcp-server)
- [REST API](#rest-api)
- [Self-hosted backends](#self-hosted-backends)

## Getting an API key

1. Log in at [app.mind2flow.io](https://app.mind2flow.io)
2. Go to **Developers → API**
3. Create a REST API key (`rest_...`) with the scopes you need
4. Store it securely — it is shown only once

Scopes follow `resource:action` (e.g. `agents:execute`, `knowledge:read`); a wildcard `agents:*` grants every action on the resource. Keys can also carry a rate limit and an IP whitelist.

Keys are for **backend/CLI use only**. Never ship them in browser or mobile code.

## SDK

Requires Node 18+ (uses built-in `fetch`). No runtime dependencies. Full TypeScript types for every request and response.

```bash
npm install @mind2flow/agents-sdk
```

```ts
import { M2FClient } from '@mind2flow/agents-sdk';

const m2f = new M2FClient({ apiKey: process.env.M2F_API_KEY! });

// Create an agent
const agent = await m2f.agents.create({
  name: 'Support Bot',
  systemPrompt: 'You are a friendly customer support agent.',
});

// Run it and get the result
const { result } = await m2f.agents.execute(agent.id, {
  input: 'What are your opening hours?',
});
console.log(result);
```

The client exposes one resource per platform area:

| Resource | Highlights |
| --- | --- |
| `m2f.agents` | `list` · `get` · `create` · `update` · `delete` · `execute` · `activities` · device assignment |
| `m2f.crews` | multi-agent workflows: CRUD, `execute`, execution history |
| `m2f.devices` | WhatsApp / SMS / email / web channels |
| `m2f.tools` | custom Python tools: CRUD, `executePython` (sandbox) |
| `m2f.scheduledTasks` | cron / interval / one-shot schedules for agents |
| `m2f.knowledge` | GraphOS knowledge graph — see [below](#knowledge-graph-graphos) |
| `m2f.account` | `me()` · `credits()` — introspect the key, its scopes, remaining credits |

Errors throw a typed `M2FError` with `status` and the server message:

```ts
import { M2FError } from '@mind2flow/agents-sdk';

try {
  await m2f.agents.execute(agentId, { input: 'Hi' });
} catch (err) {
  if (err instanceof M2FError && err.status === 403) {
    // key lacks the agents:execute scope
  }
}
```

Per-resource guides live in [`docs/`](docs): [agents](docs/agents.md) · [crews](docs/crews.md) · [tools](docs/tools.md) · [scheduled tasks](docs/scheduled-tasks.md) · [knowledge](docs/knowledge.md) · [authentication & scopes](docs/authentication.md) · [errors](docs/errors.md) · [MCP](docs/mcp.md). Runnable examples in [`examples/`](examples).

## CLI

```bash
npm install -g @mind2flow/cli

m2f login          # paste your rest_ API key (or use --api-key)
m2f whoami         # verify identity + scopes
m2f agents list
```

Configuration lives in `~/.m2f/config.json`. Environment variables override it — set `M2F_API_KEY` (and optionally `M2F_BASE_URL`) in CI instead of running `login`.

Conventions that make the CLI scriptable:

- Every `list` / `get` / read command accepts **`--json`** for raw, machine-readable output.
- Destructive commands accept **`--yes`** to skip interactive confirmation.
- Inputs can come from files: `--input-file result.json`, `--system-prompt @prompt.txt`, `--from agent.json`.
- Non-zero exit code on failure, with the API error message on stderr.

```bash
m2f agents list --json | jq -r '.[] | "\(.id)\t\(.name)"'
```

## CLI command reference

```
m2f login [--api-key <rest_...>] [--base-url <url>]
m2f logout | whoami | credits

m2f agents list [--json]
m2f agents get <agentId> [--json]
m2f agents create --name <name> [--system-prompt <text>|@file] [--description <text>]
                  [--model-provider <openai|anthropic|...>] [--from <agent.json>]
m2f agents run <agentId> --input <text> [--input-file <file>] [--timeout <ms>]
m2f agents activities <agentId> [--limit <n>] [--json]
m2f agents assign-device <agentId> <deviceId>     (and unassign-device)
m2f agents delete <agentId> [--yes]

m2f crews list|get|create|delete [--json]
m2f crews run <crewId> --input <text> [--input-file <file>]
m2f crews executions <crewId> [--limit <n>]
m2f crews execution <crewId> <executionId>

m2f devices list [--available] [--json]
m2f devices get|create|delete

m2f tools list [--public] [--json]
m2f tools push <file.py> --description <text> [--name <name>] [--tool-id <id>]
               [--category <cat>] [--public]
m2f tools exec <file.py> [--timeout <seconds>]     # run in the sandbox without saving
m2f tools get|delete <toolId>

m2f tasks list [--agent-id <id>] [--json]
m2f tasks create --agent-id <id> --name <name> --message <text>
                 (--cron "<expr>" [--timezone <tz>] | --interval <ms> | --at <iso>)
m2f tasks toggle|run|delete <taskId>
m2f tasks executions <taskId> [--limit <n>]

m2f knowledge query "<question>" [-n <results>] [--json]
m2f knowledge graph [--q <entity>] [--limit <n>] [--json]
m2f knowledge sources list [--json]
m2f knowledge sources add "<name>" --type <file|rest|sql|composio> [--config <json>]
m2f knowledge sources sync <sourceId>
m2f knowledge sources rm <sourceId> [--yes]        # also removes its facts from the graph
m2f knowledge upload <sourceId> <file>             # PDF, Word, Excel, CSV, MD, TXT, HTML
m2f knowledge jobs [--json]
m2f knowledge add-fact "<statement>" [--from <iso>] [--until <iso>]
m2f knowledge invalidate <factUuid>
m2f knowledge usage [--json] [--set-limit <n>] [--clear-limit]

m2f mcp setup [--mcp-key <mcp_...>] [--url <url>] [--name <name>]   # writes ~/.cursor/mcp.json
m2f mcp claude-command [--mcp-key <mcp_...>] [--url <url>]          # prints the claude mcp add command
```

Every command and subcommand also answers `--help`.

## Knowledge graph (GraphOS)

GraphOS is the account's **temporal knowledge graph**: feed it documents and data sources, it extracts entities and facts (each with validity in time), and your agents query it automatically at runtime. The SDK/CLI expose the same capabilities programmatically.

```bash
# Ingest
m2f knowledge sources add "Company docs" --type file
m2f knowledge upload src_abc ./price-list.pdf
m2f knowledge jobs                                  # watch ingestion progress

# Query — facts carry valid_at / invalid_at timestamps
m2f knowledge query "What does the dental cleaning cost?"

# Declare a fact with an expiry (a promo that turns itself off)
m2f knowledge add-fact "20% discount on teeth whitening" --from 2026-07-15 --until 2026-08-31

# Cost visibility & control (extraction bills to the account's own OpenAI key)
m2f knowledge usage
m2f knowledge usage --set-limit 500
```

```ts
const facts = await m2f.knowledge.query('What does the dental cleaning cost?');
const usage = await m2f.knowledge.getUsage();   // episodes, queries, est. LLM spend per month
```

Requires the `knowledge:read` / `knowledge:write` scopes, and the account must have an **OpenAI key** configured in the dashboard (check with `m2f.knowledge.keyStatus()`). Full guide: [docs/knowledge.md](docs/knowledge.md).

## Using the CLI from AI coding assistants

The CLI is designed to be operated by agents (Claude Code, Cursor, etc.) as well as humans:

- **Discoverable** — `m2f --help` and `m2f <group> --help` describe every command and flag; the reference above is the complete surface.
- **Deterministic I/O** — `--json` gives parseable output; `--yes` removes interactive prompts; exit codes signal success/failure.
- **Stateless auth** — set `M2F_API_KEY` in the environment; no login flow needed.

A prompt as simple as *"Use the `m2f` CLI to create a support agent with the knowledge graph attached, then ask it a test question"* is enough for a coding agent to execute end-to-end. For deeper integration (the assistant calling the platform as tools rather than shelling out), use the [MCP server](#mcp-server).

## MCP server

Mind2Flow also exposes an **MCP (Model Context Protocol) server** with 87 tools covering agents, crews, devices, custom tools, tenant management, scheduled tasks, project management and the knowledge graph. This lets AI assistants operate your Mind2Flow account directly.

MCP uses its own key type (`mcp_...`, created under **Developers → MCP Keys**, same scope model):

```bash
m2f mcp setup --mcp-key mcp_xxx            # Cursor
m2f mcp claude-command --mcp-key mcp_xxx   # Claude Code / Desktop
```

Details: [docs/mcp.md](docs/mcp.md).

## REST API

Everything the SDK does is plain HTTPS + JSON underneath:

- Base URL: `https://api.mind2flow.io/api/v1`
- Auth: `Authorization: Bearer rest_...`
- Envelope: every response is `{ status, message, payload }`
- Contract: [openapi/v1.json](openapi/v1.json) — also served live at `/api/v1/openapi.json`

```bash
curl https://api.mind2flow.io/api/v1/account/me \
  -H "Authorization: Bearer rest_your_key"
```

## Self-hosted backends

Point the SDK/CLI at your own instance:

```ts
new M2FClient({ apiKey, baseUrl: 'http://localhost:3002/api/v1' });
```

```bash
m2f login --base-url http://localhost:3002/api/v1
# or: export M2F_BASE_URL=http://localhost:3002/api/v1
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](LICENSE)
