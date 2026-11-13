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

## Prompt version history

Every save of a different system prompt — from the console, this SDK, the
MCP, the in-app Copilot, crews or an import — is kept as a version: when, who
and from where. Nothing is ever deleted (the versions go with the agent when it
is deleted), and restoring an old version saves it as a new one.

```ts
const { versions } = await m2f.agents.promptVersions(agentId);   // newest first
const v3 = await m2f.agents.promptVersion(agentId, 3);           // with its text
const diff = await m2f.agents.comparePromptVersions(agentId, 3); // v3 → current prompt
console.log(`+${diff.added} −${diff.removed}`, diff.lines);
await m2f.agents.restorePromptVersion(agentId, 3);               // becomes a new version
```

```
m2f agents prompt-history <agentId>
m2f agents prompt-show <agentId> <version>
m2f agents prompt-diff <agentId> <from> [to]
m2f agents prompt-restore <agentId> <version> --yes
```

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
