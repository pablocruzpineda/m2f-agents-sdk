# Panels — build a CRM or inbox on top of a WhatsApp device

A *panel* is any application of yours that shows and continues the
conversations of a WhatsApp number connected to Mind2Flow: a CRM, a shared
inbox, a support desk. The panel does two things:

- **receives** everything that happens on the device, through a signed webhook;
- **sends** messages through the device.

Mind2Flow keeps doing its part exactly as before — the agent assigned to the
device answers, activity is logged, credits are charged. The panel gets a copy
of the traffic; it is not in its path.

## Two ways a number works

A WhatsApp number in Mind2Flow is either answered by people or by an agent —
never both arrangements at once — and a panel can work with both:

| | People answer (`inbox`) | An agent answers (`agent`) |
| --- | --- | --- |
| In Mind2Flow | the device has no agent | the device is assigned to an agent |
| Who replies to contacts | your users, through the panel | the agent; your users can also write |
| What the panel does | receives and sends | follows the conversation, sends, pauses the agent |

Which one applies is decided by the device at the moment you subscribe, and
`subscribe()` tells you (`mode`). A device subscribed as `inbox` is reserved
for the panel: it shows as taken in Mind2Flow (by an agent named
`[Panels] <device>`), and it cannot be assigned to a real agent until you
unsubscribe. To put an agent on that number: unsubscribe, assign the device to
the agent in Mind2Flow, subscribe again.

## Before you start

1. Connect a WhatsApp number to a device in the console (QR, or the official
   Cloud API). `m2f.devices.list()` shows your devices and whether they are
   connected.
2. Create an API key with the scopes `devices:read` and `devices:write` —
   plus `agents:write` if the panel will pause and resume agents.

## Subscribe

```ts
import { M2FClient } from '@mind2flow/agents-sdk';

const m2f = new M2FClient({ apiKey: process.env.M2F_API_KEY! });

const { secret, mode, agent } = await m2f.panels.subscribe(deviceId, 'https://crm.example.com/webhooks/mind2flow');
// Store `secret` on your server. It verifies every delivery and stays the same
// for the device, also when you subscribe again with a new URL.
// mode === 'inbox'  → people answer through your panel
// mode === 'agent'  → `agent.name` answers; your panel follows along
```

A device has one subscription. `m2f.panels.getSubscription(deviceId)` reads it
back (or `null`), `m2f.panels.unsubscribe(deviceId)` stops the feed.

The URL must be public `https`.

## Receive

Every delivery is a `POST` with a JSON `PanelEvent` and these headers:

| Header | Meaning |
| --- | --- |
| `X-M2F-Event` | `message.received`, `message.sent`, `message.status` or `connection.update` |
| `X-M2F-Delivery` | Id of this delivery, the same on every retry — use it to ignore duplicates |
| `X-M2F-Timestamp` | Unix seconds when it was signed |
| `X-M2F-Signature` | `sha256=` + HMAC-SHA256 of `<timestamp>.<raw body>` with your secret |

Verify before parsing, on the raw body:

```ts
import { verifyPanelWebhook, type PanelEvent } from '@mind2flow/agents-sdk';

export async function handler(req: Request): Promise<Response> {
  const body = await req.text();
  const genuine = await verifyPanelWebhook({
    secret: process.env.M2F_PANEL_SECRET!,
    body,
    signature: req.headers.get('x-m2f-signature'),
    timestamp: req.headers.get('x-m2f-timestamp'),
  });
  if (!genuine) return new Response('invalid signature', { status: 401 });

  const event = JSON.parse(body) as PanelEvent;
  switch (event.type) {
    case 'message.received': // a contact wrote
    case 'message.sent':     // the agent, your panel or the phone itself replied
      await saveMessageOnce(event.deviceId, event.message!); // keyed by message.id
      break;
    case 'message.status':   // sent → delivered → read, or failed
      await updateStatus(event.status!.messageId, event.status!.state);
      break;
    case 'connection.update':
      await setDeviceState(event.deviceId, event.connection!.state);
      break;
  }
  return new Response('ok');
}
```

`verifyPanelWebhook` runs wherever Web Crypto exists: Node 18+, Deno, edge
functions.

Answer with a 2xx quickly, and do slow work after answering. Anything else is
retried twice (after 1 s and 5 s); a 4xx other than 429 is not retried.

### What a message looks like

```jsonc
{
  "type": "message.received",
  "deviceId": "cm…",
  "channel": "baileys",            // "baileys" (QR) or "cloud" (official Cloud API)
  "occurredAt": "2026-10-05T18:00:00.000Z",
  "message": {
    "id": "3EB0…",                 // WhatsApp message id; message.status events refer to it
    "fromMe": false,
    "contact": { "jid": "5215512345678@s.whatsapp.net", "phone": "5215512345678", "name": "Ana", "isGroup": false },
    "type": "image",               // text, image, video, audio, document, sticker, location, contact, reaction, unknown
    "text": "caption, or the text of a text message",
    "media": { "base64": "…", "mimeType": "image/jpeg", "width": 1280, "height": 720 },
    "quotedMessageId": "3EB0…",    // when it replies to another message
    "timestamp": 1790000000
  },
  "raw": { }                       // the gateway's original payload, without the media bytes
}
```

- `contact` is always the other party: who wrote, or who the message was sent to.
- `contact.phone` is `null` when WhatsApp only identifies the contact by an
  internal id (`…@lid`); `contact.jid` is always set and is the stable key.
- Media comes inline as base64. Files over ~15 MB arrive with
  `media.omitted: true` and no bytes. A message that was sent by URL carries
  `media.url` instead of the bytes.
- A type the panel does not know yet arrives as `unknown`; its content is in `raw`.
- Group messages are delivered too (`contact.isGroup`); ignore them if your
  panel is one-to-one.

### Delivery guarantees

**Messages arrive at least once.** Normally a message reaches you once, live.
After a gap — Mind2Flow or the WhatsApp gateway restarted, or it is the very
first event of a device you just subscribed — the messages you missed are
recovered and delivered with `"replayed": true`. A recovered message can be
one you already received, so **store messages by `message.id` and ignore the
ones you already have**.

Two things are not recovered after a gap:

- `message.status` and `connection.update` events;
- media *received* on an official Cloud API number while the feed was down
  (text and everything you send are recovered; on QR numbers everything is).

A recovery reaches back 30 minutes at most.

## Send

```ts
await m2f.panels.sendMessage(deviceId, { phoneNumber: '+525512345678', message: 'Hola 👋' });

await m2f.panels.sendMessage(deviceId, {
  phoneNumber: '+525512345678',
  messageType: 'image',            // image, video, audio, document
  mediaUrl: 'https://…/photo.jpg', // or mediaData: '<base64>'
  mimeType: 'image/jpeg',
  message: 'optional caption',
});
```

`phoneNumber` goes in international format **with its `+`**. The `+` is what
says the country code is already there: without it only Mexican, Brazilian and
+1 numbers are understood, and any other is refused as
`Invalid phone number format`. An incoming `contact.phone` is the number as
WhatsApp names it, digits only — put a `+` in front to answer. One exception:
WhatsApp names Mexican mobiles `521` + 10 digits, and they are written to as
`+52` + the same 10 digits.


What you send comes back through the webhook as a `message.sent` event with
its WhatsApp id, followed by its `message.status` updates.

Things to know:

- **Official Cloud API numbers**: a free-form message only reaches a contact
  within 24 hours of their last message. Outside that window the call fails
  with `M2FError` status 409 (`body.code === 'OUTSIDE_24H_WINDOW'`); send an
  approved template instead:
  `{ phoneNumber, messageType: 'template', template: { name, language, values } }`.
- **Rate limit**: 20 messages per minute per device (status 429).
- **Billing**: each sent message costs one credit, like any other outgoing
  message, on top of the credit every API request costs.
- Locations, stickers, reactions and quoted replies can be received but not
  sent yet.

## Pausing the agent of a number

In `agent` mode the agent keeps answering while your users write from the
panel. To let a person take over, pause it — it stops answering every contact
of that number until you resume it:

```ts
await m2f.agents.pause(agent.id);
await m2f.agents.resume(agent.id);
```

Pausing for a single contact is not available.

## REST

The same surface without the SDK (`x-api-key: rest_…`):

```
PUT    /api/v1/panels/devices/{deviceId}/webhook    { "url": "https://…" }
GET    /api/v1/panels/devices/{deviceId}/webhook
DELETE /api/v1/panels/devices/{deviceId}/webhook
POST   /api/v1/panels/devices/{deviceId}/messages   { "phoneNumber": "…", "message": "…" }
```

Schemas: `PanelSubscription`, `PanelEvent` and `PanelMessageSend` in
[`openapi/v1.json`](../openapi/v1.json).
