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

Resources: `agents`, `crews`, `devices`, `tools`, `scheduledTasks`, `knowledge` (GraphOS temporal knowledge graph), `account`, `organization` (TENANT/ADMIN reporting), `artifacts` (reports, test runs, prompt changes).

### Analyse your agents (new in 0.3.0)

```ts
// Exact figures, from the database. Read `notes` alongside them.
const s = await m2f.agents.summary(agentId, { from: '2026-08-01', bucket: 'week' });

// Every agent at once: `agents` splits the same figures by agent (0.6.4).
const org = await m2f.organization.summary({ from: '2026-10-01' });
for (const a of org.agents ?? []) console.log(a.agentName, a.messages, a.errors);

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

### Actions, test runs and artifacts (new in 0.4.0)

```ts
// What its apps actually answered: calls, errors, ids created.
await m2f.agents.actions(agentId);

// Test conversations, played for real (its connected apps DO run).
const run = await m2f.agents.runTests(agentId, { cases: [{ name: 'Price', turns: ['How much is the drill?'], expected: 'Quotes 1,890' }] });

// Reports as versioned, shareable documents.
const report = await m2f.artifacts.create({ template: 'operation_report', agentId });
const { token } = await m2f.artifacts.share(report.id);
```

### Phone calls (new in 0.5.0)

```ts
// Twilio and the number are set up once in the console (AI Agents → agent → Voice).
const { callSid } = await m2f.voice.call({ agentId, to: '+525512345678', variables: { nombre: 'Ana' } });
const call = await m2f.voice.waitForCall(callSid);   // outcome, summary, credits, transcript
await m2f.voice.updateLine(agentId, { voice: 'Cristina', greeting: 'Hola, gracias por llamar.' });
await m2f.voice.pause(agentId);
```

### Panels — your own CRM or inbox on a WhatsApp device (new in 0.6.0)

```ts
import { verifyPanelWebhook, type PanelEvent } from '@mind2flow/agents-sdk';

const { secret } = await m2f.panels.subscribe(deviceId, 'https://crm.example.com/webhooks/mind2flow');
await m2f.panels.sendMessage(deviceId, { phoneNumber: '+525512345678', message: 'Hola 👋' });

// in your webhook: verify on the raw body, then parse
if (await verifyPanelWebhook({ secret, body, signature, timestamp })) {
  const event = JSON.parse(body) as PanelEvent; // message.received | message.sent | message.status | connection.update
}
```

Full guide: [docs/panels.md](https://github.com/pablocruzpineda/m2f-agents-sdk/blob/main/docs/panels.md).

Requires Node 18+ (uses built-in `fetch`).

**Prerequisites** (one-time, in the [dashboard](https://app.mind2flow.io)): create a
REST API key (Developers → API) and add your LLM provider key (Profile → API &
Model Configuration — the knowledge graph needs an OpenAI key). API usage
deducts platform credits per request; LLM usage bills to your own key (BYOK).

Full docs: https://github.com/pablocruzpineda/m2f-agents-sdk
