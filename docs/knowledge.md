# Knowledge graph (GraphOS)

GraphOS is your account's temporal knowledge graph. You feed it documents and
data sources; it extracts entities and facts (with validity in time), and your
agents query it automatically at runtime. The SDK/CLI give you the same power
programmatically: ingest, query, and manage knowledge from code or CI.

**Prerequisites**

- Your API key needs the `knowledge:read` scope (queries, browsing) and/or
  `knowledge:write` (sources, ingestion, manual facts).
- The account needs its own **OpenAI API key** configured in the dashboard
  (Profile → API Configuration) — extraction and search bill to it (BYOK).
  New accounts get a **50-episode trial allowance** on the platform's key
  first (lifetime, not monthly). Check with:

```ts
const { hasKey } = await m2f.knowledge.keyStatus();
```

## Query the graph

Facts come back with temporal validity — `invalid_at` in the future means a
validity window end (e.g. a promo), in the past means superseded.

```ts
const facts = await m2f.knowledge.query('What does the dental cleaning cost?');
// [{ fact: 'Dental cleaning costs $1,500', valid_at: '2026-06-01...', invalid_at: null }, ...]
```

CLI:

```bash
m2f knowledge query "What does the dental cleaning cost?"
```

## Ingest documents

```ts
const source = await m2f.knowledge.createSource({ type: 'file', name: 'Company docs' });
// upload via the CLI (multipart), then poll the job:
```

```bash
m2f knowledge upload <sourceId> ./services-catalog.pdf
m2f knowledge jobs
```

Each new document becomes graph episodes; **every episode is one LLM
extraction run billed to the account's OpenAI key**. Unchanged documents are
skipped on re-sync (content-hash dedup).

## Connect live sources

```ts
// REST endpoint with auth
await m2f.knowledge.createSource({
  type: 'rest',
  name: 'Product catalog',
  config: {
    url: 'https://api.example.com/v1/products?active=true',
    items_path: 'data.items',
    auth_type: 'bearer',
    auth_token: process.env.CATALOG_TOKEN,
  },
});
```

Source types: `file`, `rest` (bearer / api_key / basic auth), `sql`
(read-only Postgres/MySQL), `composio` (read via a Composio tool).
Credentials are encrypted at rest and masked in responses.

Sync on your schedule (e.g. from CI or cron):

```bash
m2f knowledge sources sync <sourceId>
```

## Declare facts directly

For promos, rules and announcements — no document needed, and validity windows
expire automatically:

```ts
await m2f.knowledge.addManual({
  statement: '20% discount on teeth whitening for new patients',
  valid_from: '2026-07-15T00:00:00Z',
  valid_until: '2026-08-31T23:59:59Z',
});
```

CLI: `m2f knowledge add-fact "20% discount on teeth whitening" --from 2026-07-15 --until 2026-08-31`

## Correct the graph

```ts
const facts = await m2f.knowledge.query('teeth whitening price');
await m2f.knowledge.invalidateFact(facts[0].uuid!); // agents stop using it; history preserved
```

## Explore the graph

```ts
const graph = await m2f.knowledge.getGraph({ limit: 50 });          // top-connected entities
const results = await m2f.knowledge.getGraph({ q: 'Acme' });        // search by name
const detail = await m2f.knowledge.getEntity(graph.nodes[0].id);    // fact timeline
```

## Usage & cost control

```ts
const usage = await m2f.knowledge.getUsage();
// usage.this_month → { episodes, queries }, usage.totals → documents, storage...

await m2f.knowledge.setMonthlyLimit(500);  // cap extraction spend; null clears
```

When the cap is reached, ingestion jobs stop with a clear error until the
month rolls over or the limit is raised. Queries are never blocked.

CLI:

```bash
m2f knowledge usage
m2f knowledge usage --set-limit 500
m2f knowledge usage --clear-limit
```

## Destructive operations

`deleteSource` / `m2f knowledge sources rm` **purges the source's episodes and
derived knowledge from the graph** — it is not just unregistering. The CLI
requires `--yes` to confirm.
