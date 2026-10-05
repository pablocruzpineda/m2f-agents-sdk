# Mind2Flow Agents SDK & CLI

Build, manage and execute AI agents on the [Mind2Flow](https://app.mind2flow.io) platform — from TypeScript, your terminal, CI pipelines, or an AI coding assistant.

| Package | What it is | Install |
| --- | --- | --- |
| [`@mind2flow/agents-sdk`](packages/sdk) | Typed, **zero-dependency** TypeScript client for the Mind2Flow REST API v1 | `npm install @mind2flow/agents-sdk` |
| [`@mind2flow/cli`](packages/cli) | The `m2f` command-line interface, built on the SDK | `npm install -g @mind2flow/cli` |

Both cover the full platform surface: **AI agents, multi-agent crews, devices (WhatsApp/SMS/email/web), phone calls, custom Python tools, scheduled tasks, and the GraphOS knowledge graph.**

## Contents

- [Prerequisites & billing](#prerequisites--billing)
- [Getting an API key](#getting-an-api-key)
- [SDK](#sdk)
- [CLI](#cli)
- [CLI command reference](#cli-command-reference)
- [Analysing your agents](#analysing-your-agents)
- [Phone calls (voice)](#phone-calls-voice)
- [Panels (CRMs and inboxes)](#panels-crms-and-inboxes)
- [Knowledge graph (GraphOS)](#knowledge-graph-graphos)
- [Using the CLI from AI coding assistants](#using-the-cli-from-ai-coding-assistants)
- [MCP server](#mcp-server)
- [REST API](#rest-api)
- [Self-hosted backends](#self-hosted-backends)

## Prerequisites & billing

Two one-time steps in the [dashboard](https://app.mind2flow.io) before the SDK/CLI work — neither can be done via the API:

1. **Create a REST API key** under **Developers → API** (details below). This authenticates every SDK/CLI call.
2. **Add your LLM provider key** under **Profile → API & Model Configuration** — needed beyond the trial: agent execution uses your configured provider's key, and the **knowledge graph specifically requires an OpenAI key** (extraction + embeddings). Verify from code with `m2f.knowledge.keyStatus()`.

**Trial included**: new accounts start with **50 free credits** and a **50-episode knowledge allowance** running on the platform's AI keys — so your first agents and first knowledge ingestion work before you configure any LLM key. Once the trial is consumed, both require your own key (topping up credits alone is not enough).

After that, everything in this repo works from your terminal or IDE.

**How you're charged — two separate meters:**

| Meter | What | Who bills you |
| --- | --- | --- |
| **Platform credits** | Every successful API/MCP request deducts credits from your account (flat per-request rate) | Mind2Flow — top up in the dashboard; check with `m2f credits` |
| **LLM usage** | Model tokens for agent runs and knowledge extraction/search (BYOK) | Your LLM provider (e.g. OpenAI) directly, on your own key |

If your credit balance runs out, API access is suspended until you top up (you'll get an email first as the balance gets low). Knowledge-graph LLM spend is visible per month with `m2f knowledge usage`, and you can cap it with `m2f knowledge usage --set-limit <n>`.

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

m2f agents summary <agentId> [--from <date>] [--to <date>] [--bucket day|week|month] [--json]
m2f agents conversations <agentId> [--from <date>] [--to <date>] [--limit <n>]
                                   [--session-ids <a,b>] [--contact <name|phone>] [--full] [--json]
m2f agents search <agentId> <term1,term2> [--role customer|agent|any] [--from <date>] [--to <date>] [--json]
m2f agents analyze <agentId> "<question>" --field name:description [--field ...]
                                          [--max <n>] [--json]
m2f agents integrations <agentId> [--json]
m2f agents channels <agentId> [--json]

m2f org summary [--agent <agentId>] [--from <date>] [--to <date>] [--bucket <b>] [--json]
m2f org activities [--agent <agentId>] [--limit <n>] [--json]

m2f crews list|get|create|delete [--json]
m2f crews run <crewId> --input <text> [--input-file <file>]
m2f crews executions <crewId> [--limit <n>]
m2f crews execution <crewId> <executionId>

m2f devices list [--available] [--json]
m2f devices get|create|delete
m2f panels subscribe <deviceId> <url> | show | unsubscribe | send <deviceId> <phone> <message>

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

m2f voice lines [--json]
m2f voice line <agentId>
m2f voice set <agentId> [--voice <id|name>] [--greeting <text>] [--number <e164>]
m2f voice pause|resume <agentId>
m2f voice call <agentId> <to> [--var key=value ...] [--wait] [--json]
m2f voice calls <agentId> [--limit <n>] [--json]
m2f voice show <callSid> [--json]
m2f voice voices [--json]
m2f voice pricing

m2f mcp setup [--mcp-key <mcp_...>] [--url <url>] [--name <name>]   # writes ~/.cursor/mcp.json
m2f mcp claude-command [--mcp-key <mcp_...>] [--url <url>]          # prints the claude mcp add command
```

Every command and subcommand also answers `--help`.

## Analysing your agents

Four things you could not do before: measure what an agent did, read what people
actually said, find the conversations that matter, and check that the agent's
wiring still works.

**The figures are exact. The analysis is not.** `summary` is computed from the
database; `analyze` reads transcripts with a language model and can be wrong or
miss things. Keep the two apart when you report them.

Every response carries a `notes` array, and it is the part people skip. It says
when messages could not be attributed to a person, when only a subset was
analysed, or when a check did not run. A count without its caveat is the one
that ends up in a slide.

```ts
// How did it do last month, week by week?
const s = await client.agents.summary(agentId, { from: '2026-08-01', bucket: 'week' });
console.log(s.totals.incoming, s.people.distinct, s.responseTimeMs?.p50);
s.notes.forEach((n) => console.warn(n));

// Which conversations mention these products? Several terms, one call.
// Searches only what CUSTOMERS wrote by default (`role: 'agent' | 'any'` to
// change it), so the agent saying "we only carry drills" does not count as
// someone asking for a drill. Matching is ACCENT-SENSITIVE: pass both spellings.
const hits = await client.agents.searchConversations(agentId, {
  terms: ['berberina', 'espirulina', 'cúrcuma', 'curcuma'],
});
// `matches.length` is the de-duplicated conversation count; per-term counts
// double-count a conversation that matched two terms.

// A specific customer's conversation, by name or phone. Names are not in the
// message text, so search cannot find a person: use `contact`.
const rosa = await client.agents.conversations(agentId, { contact: 'Rosa Vega' });

// Read only what matched, whole threads, never cut mid-conversation.
const threads = await client.agents.conversations(agentId, {
  sessionIds: hits.terms[0].sessionIds,
});

// Ask anything. You supply the question AND the shape of the answer.
const analysis = await client.agents.analyzeConversations(agentId, {
  question: 'What did the customer want, and did it end in a sale?',
  fields: [
    { name: 'products', description: 'each product asked for by name' },
    { name: 'outcome', description: 'quoted, bought, or only asked' },
  ],
  maxConversations: 40,
});
console.log(analysis.aggregates.products); // value → conversations, a frequency table

// Why is it not saving to Sheets? Why did it stop answering?
// `issues` holds real problems; `notes` holds caveats about the checks
// themselves (Composio unreachable, live WhatsApp probe could not run).
const apps = await client.agents.integrations(agentId);
const channels = await client.agents.channels(agentId);   // WhatsApp checked live
```

`analyzeConversations` is the only call here that **spends money**. It runs an
LLM on your own account's key — or the trial key while that is active — and
fails with 402 rather than billing anyone else. Narrow with `searchConversations`
first and keep `maxConversations` to what the question needs.

Organization-wide reporting (`client.organization`) needs the TENANT or ADMIN
role. The role is checked against the database, not against your key's scopes,
and every row is confined to your own customer.

### What the agent's apps actually did (new in 0.4.0)

Every tool call an agent makes — create a contact in the CRM, add a row to a
sheet, book an event, search its knowledge — is recorded with the app's real
answer: ok or the error, and the ids it created.

```ts
const acts = await client.agents.actions(agentId, { from: '2026-09-01' });
for (const t of acts.tools) console.log(t.tool, t.calls, t.errors, t.topErrors[0]?.error);
acts.notes.forEach((n) => console.warn(n));
```

"ok" means the app's API accepted the call, not what the app did afterwards (a
CRM workflow, say). Calls are recorded from the day logging was deployed —
`loggingSince` says where the record starts, and no record is not the same as
no errors.

### Testing an agent, for real (new in 0.4.0)

```ts
const run = await client.agents.runTests(agentId, {
  identity: { name: 'Prueba', email: 'me@mycompany.com' },
  cases: [
    { name: 'Books an appointment', turns: ['Hi, I am {{name}}, I want an appointment Tuesday at 10', 'my email is {{email}}'],
      expected: 'Books Tuesday 10:00 in the calendar and confirms it' },
  ],
});
// The results fill in an artifact, case by case.
let a = await client.artifacts.get(run.artifactId);
while (a.status === 'running') { await new Promise((r) => setTimeout(r, 4000)); a = await client.artifacts.get(run.artifactId); }
```

Nothing is simulated: each case runs on a temporary copy of the agent — its
replies go to no channel and do not count in its figures — but **its connected
apps run for real**. Use a test identity you control. Every app action is in the
results with the ids it created, so they can be found and removed. A language
model on your key grades each answer.

### Artifacts: reports as documents (new in 0.4.0)

Reports, test runs and prompt changes are **artifacts**: versioned documents
built from typed blocks, whose figures the server resolves from the database —
never numbers someone typed.

```ts
// The monthly operation report of an agent (default: last calendar month).
const report = await client.artifacts.create({ template: 'operation_report', agentId, lang: 'en' });

// Or your own: declare data sources, point blocks into them.
const mine = await client.artifacts.create({
  title: 'Weekly volume',
  agentId,
  sources: { s: { tool: 'operation_summary', args: { agentId, bucket: 'week' } } },
  blocks: [
    { type: 'kpis', items: [{ label: 'Messages', source: { ref: 's', path: 'totals.incoming' } }] },
    { type: 'chart', kind: 'bar', x: 'bucket', y: ['incoming'], source: { ref: 's', path: 'series' } },
  ],
});

await client.artifacts.refresh(mine.id);            // same blocks, fresh data, new version
const { token } = await client.artifacts.share(mine.id); // <app>/a/<token>
```

A public link shows the latest version without signing in. Internal ids are
always removed from it; end customers' names, phones and emails are replaced
unless you pass `redact: false`.

## Phone calls (voice)

*New in 0.5.0.* An agent can answer a phone number and place calls, with the
same prompt, knowledge and tools it uses in chat, on **your own Twilio
account**. Connect Twilio and pick the number once in the console (AI Agents →
agent → Voice); after that:

```ts
const { callSid } = await client.voice.call({ agentId, to: '+525512345678', variables: { nombre: 'Ana' } });
const call = await client.voice.waitForCall(callSid);   // outcome, summary, credits, transcript

await client.voice.updateLine(agentId, { voice: 'Cristina', greeting: 'Hola, gracias por llamar.' });
await client.voice.pause(agentId);
```

```bash
m2f voice call <agentId> +525512345678 --var nombre=Ana --wait
m2f voice calls <agentId>
```

Credits are charged per started 15 s of AI talk time (`m2f voice pricing`);
Twilio bills minutes and numbers to your Twilio account. Details:
[docs/voice.md](docs/voice.md).

## Panels (CRMs and inboxes)

*New in 0.6.0.* Build your own CRM or shared inbox on a WhatsApp device: receive everything
the device receives and sends through a signed webhook, and send through it.
The agent assigned to the device keeps answering as usual.

```ts
const { secret } = await m2f.panels.subscribe(deviceId, 'https://crm.example.com/webhooks/mind2flow');
await m2f.panels.sendMessage(deviceId, { phoneNumber: '5215512345678', message: 'Hola 👋' });

// in your webhook
const genuine = await verifyPanelWebhook({ secret, body, signature, timestamp });
```

Event format, delivery guarantees and the send options:
[docs/panels.md](docs/panels.md).

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
