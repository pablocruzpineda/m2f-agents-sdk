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

Resources: `agents`, `crews`, `devices`, `tools`, `scheduledTasks`, `knowledge` (GraphOS temporal knowledge graph), `account`.

Requires Node 18+ (uses built-in `fetch`).

**Prerequisites** (one-time, in the [dashboard](https://app.mind2flow.io)): create a
REST API key (Developers → API) and add your LLM provider key (Profile → API &
Model Configuration — the knowledge graph needs an OpenAI key). API usage
deducts platform credits per request; LLM usage bills to your own key (BYOK).

Full docs: https://github.com/pablocruzpineda/m2f-agents-sdk
