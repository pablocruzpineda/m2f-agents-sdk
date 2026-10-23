# Crews (multi-agent workflows)

A **crew** runs several agents as one flow: steps in order, `if` and `switch`
branches, **teams** (an orchestrator that decides which members to ask), and
steps that send results out by API or WhatsApp. Every run is recorded and can
be listed.

## Create a crew from a blueprint

A blueprint describes the crew in plain terms. The server compiles it into the
same flow and diagram the dashboard builder draws, so the crew opens in the
builder ready to edit. You never write node ids, handles or step numbers.

```ts
const crew = await m2f.crews.createFromBlueprint({
  name: 'Front desk',
  input: 'api',                         // or 'whatsapp' with inputDeviceId
  steps: [
    {
      switch: 'Is the guest asking for a hotel service or something general?',
      cases: [
        { value: 'service', steps: [
          { team: { lead: conciergeId, members: [housekeepingId, maintenanceId, toursId],
                    task: 'Solve the guest request with the right areas', maxQuestions: 4 } },
        ] },
      ],
      default: [{ agent: generalId }],
    },
    { agent: writerId, task: 'Write the final reply in the guest\'s language' },
    { apiSend: { method: 'POST', url: 'https://crm.example/notes',
                 body: { guest: '{{sender}}', note: '{{previous_output}}' } } },
  ],
  settings: { onError: 'retry', retries: 1, stepTimeoutSeconds: 120 },
});
```

A crew that is a single team has a shortcut:

```ts
await m2f.crews.createTeam({
  name: 'Concierge',
  lead: conciergeId,                       // decides whom to ask, writes the answer
  members: [housekeepingId, maintenanceId, toursId],   // 1–5 agents
  task: 'Help hotel guests',
});
```

### Steps

| Step | Shape | Notes |
|---|---|---|
| Agent | `{ agent, task?, interactive?, humanExpert?, doneKeywords? }` | `interactive` keeps asking the user until done; `humanExpert` (a phone) makes a person answer the step |
| Team | `{ team: { lead, members, task?, maxQuestions?, parallel? } }` | 1–5 members, the lead not among them; `maxQuestions` 1–12; `parallel` (default true) asks independent questions at the same time |
| If | `{ if, then?, else? }` | the condition is evaluated by the crew; empty branches go straight on |
| Switch | `{ switch, cases: [{ value, description?, steps? }], default? }` | case values must be distinct |
| API send | `{ apiSend: { method?, url, headers?, body?, responseMapping?, wait? } }` | right after an agent step; `GET`/`POST`/`PUT`/`PATCH`/`DELETE` |
| WhatsApp send | `{ whatsappSend: { to, message } }` | right after an agent step; needs a connected WhatsApp input device |

Branches join again at the step after the `if` / `switch`. A nested `if` or
`switch` must be the last step of its branch.

URLs, bodies and messages accept variables: `{{previous_output}}` (what the
last step returned), `{{original_message}}`, `{{sender}}` (phone number, or the
API caller) and `{{step_N}}` (what step N returned). An unknown name is sent as
written, so typos are visible.

The team's lead thinks with its agent's **Thinking** model (set in the agent's
Advanced Model Routing); without one it uses the account's Thinking model, then
the standard one.

### Validate first

`dryRun` checks and compiles the blueprint without creating anything, and
returns what would be created. A blueprint with problems throws an `M2FError`
whose `errors` lists all of them at once:

```ts
try {
  await m2f.crews.createFromBlueprint(blueprint, { dryRun: true });
} catch (e) {
  if (e instanceof M2FError) console.error(e.errors);
  // ['Main step 2: the lead cannot also be a team member', ...]
}
```

### Change a crew

`updateFromBlueprint` replaces a crew's steps, diagram, agents and settings
(also with `dryRun`):

```ts
await m2f.crews.updateFromBlueprint(crewId, blueprint);
```

## Running

`execute` runs the crew and waits for it (up to about 5 minutes). Its `result`
holds the answer, every step and, for a team, whom the lead asked and what they
answered:

```ts
const run = await m2f.crews.execute(crewId, { message: 'The AC in 204 is not cooling' });

run.result?.status;            // 'completed' | 'failed' | 'paused'
run.result?.finalOutput;       // the crew's answer
for (const step of run.result?.steps ?? []) {
  for (const d of step.delegations ?? []) console.log(d.agentName, d.task, d.output);
}
```

A run that stops on a question (an interactive step or a human expert) comes
back `paused` with `currentQuestion`, `waitingFor` (`'user'` or `'expert'`) and
`notified`.

Past runs:

```ts
const { executions } = await m2f.crews.executions(crewId, { limit: 20 });
const one = await m2f.crews.getExecution(crewId, executions[0].id);
```

## Other operations

```ts
const crews = await m2f.crews.list();
const crew  = await m2f.crews.get(id);
await m2f.crews.update(id, { description: 'Updated' });
await m2f.crews.delete(id);
await m2f.crews.assignDevice(crewId, deviceId);   // answer on a WhatsApp device
```

`crews.create` takes the raw builder format (`executionFlow`, `workflowLayout`);
prefer blueprints.

## CLI

```bash
m2f crews blueprint crew.json --dry-run          # validate; prints every problem
m2f crews blueprint crew.json                    # create
m2f crews blueprint crew.json --crew <crewId>    # replace a crew's flow
m2f crews create-team --name Concierge --lead <id> --member <id> <id> --task "Help guests"
m2f crews run <crewId> --input "The AC in 204 is not cooling"   # steps, delegations, answer
m2f crews run <crewId> --input "..." --json      # raw execution
m2f crews executions <crewId>
m2f crews execution <crewId> <executionId>
```

## MCP

The MCP server has the same tools: `create_crew_from_blueprint` and
`update_crew_from_blueprint` (with `dryRun`), and `execute_crew`.

## Required scopes

`crews:read` for reads, `crews:write` for writes and runs
(see [Authentication](authentication.md)).
