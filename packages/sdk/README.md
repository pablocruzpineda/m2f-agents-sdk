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

Resources: `agents`, `crews`, `devices`, `tools`, `scheduledTasks`, `account`.

Requires Node 18+ (uses built-in `fetch`). Full docs:
https://github.com/pablocruzpineda/m2f-agents-sdk
