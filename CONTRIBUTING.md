# Contributing

Thanks for your interest in improving the Mind2Flow SDK & CLI!

## Development setup

```bash
git clone https://github.com/pablocruzpineda/m2f-agents-sdk.git
cd m2f-agents-sdk
npm install
npm run build
```

Node 18+ is required (the SDK uses the built-in `fetch`).

## Repository layout

- `packages/sdk` — `@mind2flow/agents-sdk`, a zero-dependency typed client
- `packages/cli` — `@mind2flow/cli`, the `m2f` command built on the SDK
- `docs/` — developer guides
- `examples/` — runnable examples
- `openapi/v1.json` — the API contract the SDK is written against

## Making changes

1. Fork and create a feature branch.
2. Keep the SDK zero-dependency; the CLI may only depend on the SDK and `commander`.
3. `npm run typecheck` and `npm run build` must pass.
4. If you change any endpoint usage, check it against `openapi/v1.json` — that
   file mirrors the server and is the source of truth for the contract.
5. Open a PR with a clear description of the change and motivation.

## Testing against a live backend

Set the environment and run any example:

```bash
export M2F_API_KEY=rest_xxx
export M2F_BASE_URL=http://localhost:3002/api/v1   # optional, defaults to production
npx ts-node examples/basic-agent.ts
```

## Reporting issues

Include the SDK/CLI version, Node version, the request you made (redact your
API key!) and the full error output.
