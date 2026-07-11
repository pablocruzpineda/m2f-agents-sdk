# Getting started

## 1. Get an API key

1. Log in at [app.mind2flow.io](https://app.mind2flow.io)
2. Navigate to **Developers → API**
3. Click **Create New REST API Key**
4. Pick the scopes you need (see [Authentication & scopes](authentication.md))
5. Copy the `rest_...` key — it is shown **only once**

## 1b. Add your LLM provider key (dashboard, one time)

New accounts include a trial: **50 free credits** and a **50-episode
knowledge allowance** run on the platform's AI keys, so your first agent and
first ingestion work with no key configured. Beyond that, anything that runs
AI needs an LLM key on your account, added under **Profile → API & Model
Configuration** in the dashboard (there is no API for this). Agent execution
uses your configured provider's key; the **knowledge graph requires an OpenAI
key** specifically (extraction + embeddings). LLM usage bills to your own
provider account (BYOK) — separately from platform credits, which are
deducted per API request (see
[Authentication & scopes](authentication.md#credits)). Topping up credits
after the trial does not re-enable the platform keys — bring your own.

## 2. Install

```bash
# SDK for your app
npm install @mind2flow/agents-sdk

# CLI for your terminal
npm install -g @mind2flow/cli
```

Node.js 18 or newer is required.

## 3. First agent in 60 seconds (SDK)

```ts
import { M2FClient } from '@mind2flow/agents-sdk';

const m2f = new M2FClient({ apiKey: process.env.M2F_API_KEY! });

// 1. Create
const agent = await m2f.agents.create({
  name: 'FAQ Bot',
  description: 'Answers questions about my product',
  systemPrompt: 'You answer questions about Acme Corp concisely and accurately.',
});

// 2. Execute — blocks until the agent answers (default timeout 120s)
const { result } = await m2f.agents.execute(agent.id, {
  input: 'How do I reset my password?',
});

console.log(result);
```

## 4. First agent in 60 seconds (CLI)

```bash
m2f login                                  # paste your rest_ key
m2f agents create --name "FAQ Bot" \
  --system-prompt "You answer questions about Acme Corp."
m2f agents list
m2f agents run <agentId> --input "How do I reset my password?"
```

## 5. Point at a self-hosted backend (optional)

Everything defaults to `https://api.mind2flow.io/api/v1`. To use your own
instance:

```bash
export M2F_BASE_URL=http://localhost:3002/api/v1
```

or pass `baseUrl` to `M2FClient` / `--base-url` to `m2f login`.

## Next steps

- [Crews — chain agents into workflows](crews.md)
- [Custom Python tools — give agents new abilities](tools.md)
- [Scheduled tasks — run agents on a schedule](scheduled-tasks.md)
- [MCP — use your agents from Cursor and Claude](mcp.md)
