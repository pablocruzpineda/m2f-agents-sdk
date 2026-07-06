# Error handling

Every non-2xx response throws an `M2FError`:

```ts
import { M2FClient, M2FError } from '@mind2flow/agents-sdk';

try {
  await m2f.agents.execute(agentId, { input: 'hi' });
} catch (error) {
  if (error instanceof M2FError) {
    console.error(error.status);         // HTTP status (0 = network/timeout)
    console.error(error.message);        // server-provided message
    console.error(error.body);           // full parsed response body

    if (error.isAuthError)        { /* 401 — bad/expired key */ }
    if (error.isPermissionError)  { /* 403 — missing scope or IP blocked */ }
    if (error.isNotFound)         { /* 404 */ }
    if (error.isRateLimited)      { /* 429 — back off and retry */ }
    if (error.requiredScope)      { console.error(`Add scope: ${error.requiredScope}`); }
  }
}
```

## Common statuses

| Status | Meaning | What to do |
| --- | --- | --- |
| 400 | Validation error | Check the `message` for the missing/invalid field |
| 401 | Invalid, expired or missing API key | Re-check the key; create a new one if revoked |
| 403 | Missing scope or IP not whitelisted | `error.requiredScope` tells you which scope to add |
| 404 | Resource not found (or owned by another account) | Verify the id |
| 409 | Conflict (duplicate name, agent already executing) | Retry later / rename |
| 429 | Rate limit exceeded | Respect `retryAfter`; see `X-RateLimit-*` headers |
| 504 | Agent execution timed out | Increase `timeout` (max 300000 ms) or simplify the task |

## Response envelope

All endpoints return the same JSON envelope, which the SDK unwraps for you:

```json
{ "status": 200, "message": "…", "payload": { } }
```
