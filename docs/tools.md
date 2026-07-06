# Custom Python tools

Custom tools are Python scripts your agents can call at runtime — API
lookups, calculations, database queries, anything expressible in Python. They
run in Mind2Flow's sandboxed execution service.

## Create a tool

```ts
const tool = await m2f.tools.create({
  name: 'fx_rates',
  description: 'Fetches the current EUR/USD exchange rate',
  code: `
import json, urllib.request
data = json.load(urllib.request.urlopen('https://api.exchangerate.host/latest?base=EUR&symbols=USD'))
print(json.dumps({'eur_usd': data['rates']['USD']}))
`,
  examples: ['What is the euro worth right now?'],
  isPublic: false,
});
```

CLI — push a local file:

```bash
m2f tools push ./fx_rates.py --description "Fetches EUR/USD rate"
# update later:
m2f tools push ./fx_rates.py --description "..." --tool-id <toolId>
```

## Test code in the sandbox

Requires the `tools:execute` scope.

```ts
const run = await m2f.tools.executePython({ code: 'print(2 + 2)' });
console.log(run.stdout);   // "4"
```

CLI: `m2f tools exec ./script.py --timeout 30`

## Attach a tool to an agent

Set `customToolId` when creating/updating an agent:

```ts
await m2f.agents.update(agentId, { customToolId: tool.id });
```

## Discover public tools

```ts
const community = await m2f.tools.listPublic({ limit: 20 });
```

CLI: `m2f tools list --public`
