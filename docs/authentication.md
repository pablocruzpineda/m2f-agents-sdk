# Authentication & scopes

## API keys

The API authenticates with REST API keys created in the dashboard
(**Developers → API**). Keys start with `rest_` and are sent as either:

```
x-api-key: rest_xxx
Authorization: Bearer rest_xxx
```

The SDK and CLI handle this for you.

> ⚠️ Keys are secrets for **server-side / CLI** use. Never embed them in
> browsers or mobile apps.

## Scopes

Each key carries a list of scopes. Every endpoint requires one; requests with
a missing scope get `403` with a `requiredScope` field in the body.

| Scope | Grants |
| --- | --- |
| `agents:read` | List/get agents, activities, scheduled tasks |
| `agents:write` | Create/update/delete/execute agents, manage scheduled tasks |
| `crews:read` | List/get crews and their executions |
| `crews:write` | Create/update/delete/execute crews |
| `devices:read` | List/get devices |
| `devices:write` | Create/update/delete devices, connection status |
| `tools:read` | List/get custom tools, discover public tools |
| `tools:write` | Create/update/delete custom tools |
| `tools:execute` | Run Python code in the sandbox |
| `tenant:read` | Account info, credit balance |
| `agents:*`, `crews:*`, … | All operations on that resource |
| `*` | Everything |

## Rate limits

Each key has a **requests-per-minute** limit (configured at creation, default
100). The server returns these headers on every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1730000000
```

Exceeding the limit returns `429` with a `retryAfter` (seconds) field.

## IP whitelist

Optionally restrict a key to specific IPs at creation time. Requests from
other addresses get `403`.

## Expiration & revocation

Keys can carry an expiration date and can be deactivated at any time from the
dashboard. Expired/revoked keys get `401`.

## Credits

Every successful API/MCP request deducts platform credits from your account
(flat per-request rate). Check your balance with `m2f credits` or
`client.account.credits()`; top up in the dashboard. If the balance runs out,
API access is suspended until you top up — a low-balance email is sent before
that happens.

LLM usage (agent runs, knowledge extraction/search) is **not** charged in
credits: it bills directly to your own provider key (BYOK). For the knowledge
graph, monitor it with `m2f knowledge usage` and cap it with
`m2f knowledge usage --set-limit <n>`.
