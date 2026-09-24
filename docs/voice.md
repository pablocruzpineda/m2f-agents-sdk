# Voice — phone calls with your agents

An agent can answer a phone number and place calls, with the same prompt,
knowledge graph and tools it uses in chat. Calls run on **your own Twilio
account** (Twilio ConversationRelay): Twilio bills minutes and numbers to you,
and Mind2Flow charges credits for the AI talk time.

## One-time setup (in the console)

1. **AI Agents → your agent → step 2 → Voice** (or the *Phone calls* step of
   the Active Panel).
2. **Connect Twilio** with your Account SID and Auth Token (Twilio Console home,
   *Account Info*). Not an API key (SK…): the Auth Token is what proves that
   calls really come from Twilio.
3. Accept the *Predictive and Generative AI/ML Features Addendum* in Twilio
   Console → Voice → Settings. Calls fail without it.
4. **Pick or buy a number.** US numbers need no paperwork; local numbers in most
   countries (Mexico included) need your business documents approved in Twilio first.
5. Pick a voice and a greeting. Save.

Transfer to a person, after-call actions (WhatsApp summary, CRM note, signed
webhook) and the outbound call purpose are also set in the console.

Everything below works once the agent has a line.

## Pricing

```bash
m2f voice pricing
# 1 credit(s) every 15 s of AI talk time (≈ 4/min).
```

- Billed on **AI talk time**, inbound and outbound; a started block counts in full.
- Not billed: ringing, unanswered outbound calls, time with a person after a transfer.
- Before answering or dialing, the account needs credits for at least one block;
  without them the call is refused (HTTP 402 for API calls).

## SDK

```ts
import { M2FClient } from '@mind2flow/agents-sdk';
const m2f = new M2FClient({ apiKey: process.env.M2F_API_KEY! });

// Which agents answer calls
const lines = await m2f.voice.lines();

// The agent calls someone. Variables reach it as call context.
const { callSid } = await m2f.voice.call({
  agentId,
  to: '+525512345678',
  variables: { nombre: 'Ana', cita: 'martes 10:00' },
});

// Wait for the end: outcome, summary, credits, transcript.
const call = await m2f.voice.waitForCall(callSid);
console.log(call.outcome, call.summary, call.credits);

// Recent calls (no transcripts) and one call (with transcript)
await m2f.voice.listCalls(agentId, { limit: 20 });
await m2f.voice.getCall(callSid);

// Voice, greeting, pause / resume
await m2f.voice.voices();                                  // catalog
await m2f.voice.updateLine(agentId, { voice: 'Cristina', greeting: 'Hola, gracias por llamar.' });
await m2f.voice.pause(agentId);                            // callers hear "not available"
await m2f.voice.resume(agentId);
```

`voice` takes a catalog id (`el-cristina`), a name (`Cristina`, accents
optional) or any ElevenLabs library voice id.

## CLI

```
m2f voice lines [--json]
m2f voice line <agentId>
m2f voice set <agentId> [--voice <id|name>] [--greeting <text>] [--number <e164>]
m2f voice pause <agentId>
m2f voice resume <agentId>
m2f voice call <agentId> <to> [--var key=value ...] [--wait] [--json]
m2f voice calls <agentId> [--limit <n>] [--json]
m2f voice show <callSid> [--json]
m2f voice voices [--json]
m2f voice pricing
```

```bash
m2f voice call cmxxx +525512345678 --var nombre=Ana --var "cita=martes 10:00" --wait
```

## REST API

| Method | Path | Scope |
| --- | --- | --- |
| `POST` | `/voice/calls` `{ agentId, to, variables? }` | `agents:write` |
| `GET` | `/voice/calls/{callSid}` | `agents:read` |
| `GET` | `/voice/lines` | `agents:read` |
| `GET` | `/voice/agents/{agentId}` | `agents:read` |
| `PATCH` | `/voice/agents/{agentId}` `{ enabled?, voice?, greeting?, phoneNumber? }` | `agents:write` |
| `GET` | `/voice/agents/{agentId}/calls?limit=` | `agents:read` |
| `GET` | `/voice/voices` | `agents:read` |
| `GET` | `/voice/pricing` | `agents:read` |

Schemas: `VoiceLine`, `VoiceCall`, `Voice`, `VoicePricing` in
[openapi/v1.json](../openapi/v1.json).

A call's `status` is `processing` while it is live. Twilio's hang-up and the
agent's summary arrive separately, so `outcome` and `summary` can appear a
few seconds after `status` changes — `waitForCall` handles that.

## MCP

Three read-only tools, listed only to accounts with Twilio connected:
`list_voice_lines`, `list_voice_calls`, `get_voice_call`. Placing a call is a
real-world action that costs money, so it is not an MCP tool: use the SDK,
the CLI or the REST API.

## Calling from a CRM without code

The console's Voice section (*Outbound calls*) gives each agent a secret
trigger URL. A CRM workflow's "Webhook" action posting a contact to it makes
the agent call that contact — the standard payload of CRMs like GoHighLevel
(phone, first_name, customData…) works as is. That URL is never returned by
the API: anyone holding it can place calls.
