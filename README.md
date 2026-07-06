# Mind2Flow Agents SDK & CLI

Build, manage and execute AI agents on the [Mind2Flow](https://app.mind2flow.io) platform — from TypeScript or your terminal.

| Package | Description |
| --- | --- |
| [`@mind2flow/agents-sdk`](packages/sdk) | Typed TypeScript client for the Mind2Flow REST API v1 |
| [`@mind2flow/cli`](packages/cli) | `m2f` command-line interface built on the SDK |

## Quick start (SDK)

```bash
npm install @mind2flow/agents-sdk
```

```ts
import { M2FClient } from '@mind2flow/agents-sdk';

const m2f = new M2FClient({ apiKey: process.env.M2F_API_KEY! });

// Create an agent
const agent = await m2f.agents.create({
  name: 'Support Bot',
  systemPrompt: 'You are a friendly customer support agent.',
});

// Run it and get the result
const { result } = await m2f.agents.execute(agent.id, {
  input: 'What are your opening hours?',
});
console.log(result);
```

## Quick start (CLI)

```bash
npm install -g @mind2flow/cli

m2f login                       # paste your rest_ API key
m2f agents list
m2f agents run <agentId> --input "Hello!"
m2f tools push ./my_tool.py --description "Fetches FX rates"
```

## Getting an API key

1. Log in at [app.mind2flow.io](https://app.mind2flow.io)
2. Go to **Developers → API**
3. Create a REST API key (`rest_...`) with the scopes you need
4. Store it securely — it is shown only once

Keys are for **backend/CLI use only**. Never ship them in browser or mobile code.

## Documentation

- [Getting started](docs/getting-started.md)
- [Authentication & scopes](docs/authentication.md)
- [Agents](docs/agents.md)
- [Crews (multi-agent workflows)](docs/crews.md)
- [Custom Python tools](docs/tools.md)
- [Scheduled tasks](docs/scheduled-tasks.md)
- [MCP server (Cursor / Claude)](docs/mcp.md)
- [Error handling](docs/errors.md)
- [OpenAPI contract](openapi/v1.json) — also served live at `/api/v1/openapi.json`

## Local development against a self-hosted backend

Point the SDK/CLI at your own instance:

```ts
new M2FClient({ apiKey, baseUrl: 'http://localhost:3002/api/v1' });
```

```bash
m2f login --base-url http://localhost:3002/api/v1
# or: export M2F_BASE_URL=http://localhost:3002/api/v1
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](LICENSE)
