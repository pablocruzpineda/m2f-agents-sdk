# Agents

An **agent** is a configured AI assistant: a system prompt, an LLM model
configuration, optional tools, and optional device (channel) assignments.

## CRUD

```ts
const agents = await m2f.agents.list();
const agent  = await m2f.agents.get(id);

const created = await m2f.agents.create({
  name: 'Sales Assistant',
  systemPrompt: 'You qualify inbound leads …',
  modelProvider: 'openai',            // optional, uses account default otherwise
  temperature: 0.3,
});

await m2f.agents.update(id, { systemPrompt: 'New prompt' });
await m2f.agents.delete(id);
```

CLI equivalents: `m2f agents list | get | create | delete`.

## Executing an agent

```ts
const { executionId, result } = await m2f.agents.execute(agentId, {
  input: 'Summarize my last order',   // string or structured object
  timeout: 60_000,                    // optional, ms (max 300000)
});
```

The call blocks until the agent finishes or the timeout elapses.

Status codes you may see as `M2FError`:

- `404` — agent not found (or not yours)
- `409` — the agent is already executing; retry after the current run
- `504` — execution timed out (the agent may still complete internally)

CLI: `m2f agents run <agentId> --input "..."` or `--input-file payload.json`.

> **How it works:** execution runs through a synced "shadow" copy of your
> agent so live channel traffic (e.g. WhatsApp) is never disturbed by API
> runs. The shadow is created automatically on first execution and re-synced
> whenever you update the original agent.

## Activity history

```ts
const { activities } = await m2f.agents.activities(agentId, { limit: 50 });
```

## Devices (channels)

Connect a WhatsApp/SMS/Email/Web device to an agent so it answers real
traffic:

```ts
await m2f.agents.assignDevice(agentId, deviceId);
await m2f.agents.unassignDevice(agentId, deviceId);
```

CLI: `m2f agents assign-device <agentId> <deviceId>`.
