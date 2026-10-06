// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { M2FClient, M2FError, verifyPanelWebhook } from '../dist/esm/index.js';

const signed = (secret, timestamp, body) => `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
const now = () => String(Math.floor(Date.now() / 1000));

function clientWith(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined, apiKey: init.headers['x-api-key'] });
    const { status = 200, json } = respond(calls.at(-1));
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { m2f: new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch }), calls };
}

test('subscribe PUTs the url and returns the subscription', async () => {
  const subscription = { deviceId: 'dev1', url: 'https://crm.example/hook', secret: 'whsec_abc', events: ['message.received'], mode: 'inbox', agent: null };
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: subscription } }));
  assert.deepEqual(await m2f.panels.subscribe('dev1', 'https://crm.example/hook'), subscription);
  assert.deepEqual(calls[0], { url: 'http://api.test/api/v1/panels/devices/dev1/webhook', method: 'PUT', body: { url: 'https://crm.example/hook' }, apiKey: 'rest_test' });
});

test('getSubscription returns null when the device has none', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: null } }));
  assert.equal(await m2f.panels.getSubscription('dev1'), null);
  assert.equal(calls[0].method, 'GET');
});

test('unsubscribe DELETEs the subscription', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: null } }));
  await m2f.panels.unsubscribe('dev1');
  assert.deepEqual([calls[0].method, calls[0].url], ['DELETE', 'http://api.test/api/v1/panels/devices/dev1/webhook']);
});

test('sendMessage posts the message and hands back the gateway answer', async () => {
  const { m2f, calls } = clientWith(() => ({ status: 201, json: { status: 201, message: 'Message sent successfully', payload: { key: { id: 'WAMID1' } } } }));
  const result = await m2f.panels.sendMessage('dev1', { phoneNumber: '5215512345678', message: 'hola' });
  assert.deepEqual(result, { messageType: 'text', payload: { key: { id: 'WAMID1' } } });
  assert.deepEqual(calls[0].body, { phoneNumber: '5215512345678', message: 'hola' });
});

test('a refused send surfaces as M2FError with the server status', async () => {
  const { m2f } = clientWith(() => ({ status: 409, json: { status: 409, message: 'More than 24 hours have passed', code: 'OUTSIDE_24H_WINDOW' } }));
  await assert.rejects(m2f.panels.sendMessage('dev1', { phoneNumber: '1', message: 'x' }), (e) => e instanceof M2FError && e.status === 409);
});

test('pausing and resuming an agent sets its status', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: { agent: { id: 'ag1', name: 'Ventas', status: 'inactive' } } } }));
  await m2f.agents.pause('ag1');
  await m2f.agents.resume('ag1');
  assert.deepEqual(calls.map((call) => [call.method, call.url, call.body]), [
    ['PATCH', 'http://api.test/api/v1/agents/ag1', { status: 'inactive' }],
    ['PATCH', 'http://api.test/api/v1/agents/ag1', { status: 'active' }],
  ]);
});

test('verifyPanelWebhook accepts a genuine delivery and nothing else', async () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ type: 'message.received', deviceId: 'dev1' });
  const timestamp = now();
  const signature = signed(secret, timestamp, body);

  assert.equal(await verifyPanelWebhook({ secret, body, signature, timestamp }), true);
  assert.equal(await verifyPanelWebhook({ secret, body: body + ' ', signature, timestamp }), false, 'tampered body');
  assert.equal(await verifyPanelWebhook({ secret: 'whsec_other', body, signature, timestamp }), false, 'wrong secret');
  assert.equal(await verifyPanelWebhook({ secret, body, signature: signature.slice(0, -1) + '0', timestamp }), false, 'wrong signature');
  assert.equal(await verifyPanelWebhook({ secret, body, signature: null, timestamp }), false, 'missing signature');
  assert.equal(await verifyPanelWebhook({ secret, body, signature, timestamp: 'abc' }), false, 'malformed timestamp');
});

test('verifyPanelWebhook rejects replays outside the tolerance', async () => {
  const secret = 'whsec_test';
  const body = '{}';
  const old = String(Math.floor(Date.now() / 1000) - 3600);
  assert.equal(await verifyPanelWebhook({ secret, body, signature: signed(secret, old, body), timestamp: old }), false);
  assert.equal(await verifyPanelWebhook({ secret, body, signature: signed(secret, old, body), timestamp: old, toleranceSeconds: 7200 }), true);
});

test('the CommonJS build exposes the same surface', async () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.equal(typeof cjs.verifyPanelWebhook, 'function');
  assert.equal(typeof new cjs.M2FClient({ apiKey: 'rest_x' }).panels.subscribe, 'function');
  const timestamp = now();
  assert.equal(await cjs.verifyPanelWebhook({ secret: 's', body: 'b', signature: signed('s', timestamp, 'b'), timestamp }), true);
});
