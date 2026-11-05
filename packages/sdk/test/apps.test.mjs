// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient, M2FError } from '../dist/esm/index.js';

function clientWith(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    const { status = 200, json } = respond(calls.at(-1));
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { m2f: new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch }), calls };
}

test('apps: search, actions, connections, connect, token, rename, disconnect hit their routes', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: {} } }));
  await m2f.apps.search('send invoices', { limit: 5 });
  await m2f.apps.actions('gmail', ['GMAIL_SEND_EMAIL']);
  await m2f.apps.connections(['gmail', 'slack']);
  await m2f.apps.connect('googlesheets');
  await m2f.apps.connectWithToken('tavily', { generic_api_key: 'k' });
  await m2f.apps.rename('ca 1', 'Clínica Norte');
  await m2f.apps.disconnect('ca_1');
  assert.deepEqual(calls.map((c) => [c.method, c.url, c.body]), [
    ['GET', 'http://api.test/api/v1/apps/catalog?q=send+invoices&limit=5', undefined],
    ['GET', 'http://api.test/api/v1/apps/gmail/actions?actions=GMAIL_SEND_EMAIL', undefined],
    ['GET', 'http://api.test/api/v1/apps/connections?toolkits=gmail%2Cslack', undefined],
    ['POST', 'http://api.test/api/v1/apps/connect', { toolkit: 'googlesheets' }],
    ['POST', 'http://api.test/api/v1/apps/connect-token', { toolkit: 'tavily', credentials: { generic_api_key: 'k' } }],
    ['PATCH', 'http://api.test/api/v1/apps/connections/ca%201', { alias: 'Clínica Norte' }],
    ['DELETE', 'http://api.test/api/v1/apps/connections/ca_1', undefined],
  ]);
});

test('agents.setApps PUTs the apps and returns warnings and the live check', async () => {
  const payload = { apps: { toolkits: ['gmail'] }, warnings: [], integrations: { toolkits: ['gmail'] } };
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload } }));
  assert.deepEqual(await m2f.agents.setApps('ag1', { toolkits: ['gmail'], pinned: [{ toolkit: 'gmail', connectedAccountId: 'ca_1' }] }), payload);
  assert.deepEqual([calls[0].method, calls[0].url, calls[0].body], ['PUT', 'http://api.test/api/v1/agents/ag1/apps', { toolkits: ['gmail'], pinned: [{ toolkit: 'gmail', connectedAccountId: 'ca_1' }] }]);
});

test('an app that needs its own OAuth app surfaces as a 409 with the code', async () => {
  const { m2f } = clientWith(() => ({ status: 409, json: { status: 409, message: 'needs its own OAuth app', code: 'needs_own_app' } }));
  await assert.rejects(m2f.apps.connect('highlevel'), (e) => e instanceof M2FError && e.status === 409 && e.body.code === 'needs_own_app');
});
