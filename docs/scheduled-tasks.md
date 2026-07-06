# Scheduled tasks

Run an agent automatically on a schedule: cron, fixed interval, or once at a
specific time. Each run sends a configured message to the agent.

## Schedule types

| Type | Fields | Example |
| --- | --- | --- |
| `cron` | `cronExpression`, optional `timezone` | `0 9 * * 1-5` — weekdays at 09:00 |
| `interval` | `intervalMs` | `3600000` — hourly |
| `once` | `runAt` (ISO 8601) | `2026-08-01T09:00:00Z` |

## SDK

```ts
const task = await m2f.scheduledTasks.create({
  agentId,
  name: 'Daily digest',
  scheduleType: 'cron',
  cronExpression: '0 8 * * *',
  timezone: 'Europe/Madrid',
  message: 'Compile and send the daily news digest.',
});

await m2f.scheduledTasks.toggle(task.id);        // enable/disable
await m2f.scheduledTasks.run(task.id);           // run right now
const history = await m2f.scheduledTasks.executions(task.id);
```

## CLI

```bash
m2f tasks create --agent-id <id> --name "Daily digest" \
  --cron "0 8 * * *" --timezone Europe/Madrid \
  --message "Compile and send the daily news digest."

m2f tasks list --agent-id <id>
m2f tasks toggle <taskId>
m2f tasks run <taskId>
m2f tasks executions <taskId>
```

## Scopes

Scheduled tasks belong to agents, so they use `agents:read` / `agents:write`.
