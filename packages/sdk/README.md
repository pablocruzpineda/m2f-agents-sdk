# @mind2flow/agents-sdk

Typed, zero-dependency TypeScript client for the Mind2Flow AI agents platform.

```bash
npm install @mind2flow/agents-sdk
```

```ts
import { M2FClient } from '@mind2flow/agents-sdk';

const m2f = new M2FClient({ apiKey: process.env.M2F_API_KEY! });

const agent = await m2f.agents.create({ name: 'Bot', systemPrompt: '…' });
const { result } = await m2f.agents.execute(agent.id, { input: 'Hello!' });
```

Resources: `agents`, `crews`, `devices`, `tools`, `scheduledTasks`, `knowledge` (GraphOS temporal knowledge graph), `account`, `organization` (TENANT/ADMIN reporting).

### Analyse your agents (new in 0.3.0)

```ts
// Exact figures, from the database. Read `notes` alongside them.
const s = await m2f.agents.summary(agentId, { from: '2026-08-01', bucket: 'week' });

// Which conversations mention these terms? Customers' messages by default.
const hits = await m2f.agents.searchConversations(agentId, { terms: ['drill', 'paint'] });

// Whole threads, never cut mid-conversation.
const threads = await m2f.agents.conversations(agentId, { sessionIds: hits.terms[0].sessionIds });

// Ask anything; you define the fields. Runs an LLM on YOUR key — it costs tokens.
const a = await m2f.agents.analyzeConversations(agentId, {
  question: 'What did the customer want, and did it end in a sale?',
  fields: [{ name: 'products', description: 'each product asked for by name' }],
});

// Why did it stop working? Live checks, with `issues` and `notes`.
await m2f.agents.integrations(agentId);
await m2f.agents.channels(agentId);
```

`summary` is exact; `analyzeConversations` reads text with a model and can be
wrong — keep the two apart when you report them.

Requires Node 18+ (uses built-in `fetch`).

**Prerequisites** (one-time, in the [dashboard](https://app.mind2flow.io)): create a
REST API key (Developers → API) and add your LLM provider key (Profile → API &
Model Configuration — the knowledge graph needs an OpenAI key). API usage
deducts platform credits per request; LLM usage bills to your own key (BYOK).

Full docs: https://github.com/pablocruzpineda/m2f-agents-sdk
