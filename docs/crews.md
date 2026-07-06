# Crews (multi-agent workflows)

A **crew** chains multiple agents into a workflow with ordering and
conditional logic. Crews have first-class, database-backed executions you can
poll.

## CRUD

```ts
const crews = await m2f.crews.list();
const crew  = await m2f.crews.get(id);

const created = await m2f.crews.create({
  name: 'Content pipeline',
  description: 'Research → write → review',
  agents: [ /* crew agent configuration */ ],
  workflow: { /* steps and conditionals */ },
});

await m2f.crews.update(id, { description: 'Updated' });
await m2f.crews.delete(id);
```

The easiest way to learn the `agents`/`workflow` shape is to build a crew in
the dashboard, then `m2f crews get <id>` and use that JSON as a template
(`m2f crews create --from crew.json`).

## Executing

```ts
const execution = await m2f.crews.execute(crewId, { topic: 'Q3 report' });
console.log(execution.status);          // pending | running | completed | failed

// Poll until done
const done = await m2f.crews.getExecution(crewId, execution.id);
```

CLI:

```bash
m2f crews run <crewId> --input "Q3 report"
m2f crews executions <crewId>
m2f crews execution <crewId> <executionId>
```

## Devices

Like agents, crews can be attached to devices:

```ts
await m2f.crews.assignDevice(crewId, deviceId);
```

## Required scopes

`crews:read` for reads, `crews:write` for writes and execution
(see [Authentication](authentication.md)).
