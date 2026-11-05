import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

test('crew organisation list, export and import', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push([init.method, url.replace('http://api.test/api/v1', ''), init.body ? JSON.parse(init.body) : undefined]);
    const payload = url.endsWith('/organization') ? { crews: [{ id: 'c1' }] } : { exportType: 'crew' };
    return new Response(JSON.stringify({ status: 200, payload }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  assert.deepEqual(await m2f.crews.listOrganization(), [{ id: 'c1' }]);
  const exp = await m2f.crews.export('c1');
  await m2f.crews.import(exp);
  assert.deepEqual(calls, [
    ['GET', '/crews/organization', undefined],
    ['GET', '/crews/c1/export', undefined],
    ['POST', '/crews/import', { exportData: { exportType: 'crew' } }],
  ]);
});

test('crew get and blueprint create carry the input webhook', async () => {
  const fetch = async (url, init) => new Response(JSON.stringify({ status: 200, payload: { crew: { id: 'c1', name: 'x' }, inputWebhookUrl: 'https://hook/input-webhook-from-ui/c1' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  assert.equal((await m2f.crews.get('c1')).inputWebhookUrl, 'https://hook/input-webhook-from-ui/c1');
  assert.equal((await m2f.crews.createFromBlueprint({ name: 'x', steps: [{ agent: 'a1', interactionType: 'user-input' }] })).inputWebhookUrl, 'https://hook/input-webhook-from-ui/c1');
});

test('signup link options and own model defaults', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push(`${init.method} ${url.replace('http://api.test/api/v1', '')}`); return new Response(JSON.stringify({ status: 200, payload: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  await m2f.tenant.signupLink({ lang: 'en', theme: 'dark' });
  await m2f.account.modelDefaults();
  await m2f.account.setModelDefaults({ provider: 'openai', models: { standard: 'gpt-5' } });
  assert.deepEqual(calls, ['GET /tenant/signup-link?lang=en&theme=dark', 'GET /account/model-defaults', 'PUT /account/model-defaults']);
});

test('a crew read back as a blueprint', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push(`${init.method} ${url.replace('http://api.test/api/v1', '')}`); return new Response(JSON.stringify({ status: 200, payload: { crewId: 'c1', blueprint: { name: 'x', steps: [{ agent: 'a1' }] }, exact: true, differences: [], note: '' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  const got = await m2f.crews.getBlueprint('c1');
  assert.equal(got.exact, true);
  assert.deepEqual(calls, ['GET /crews/c1/blueprint']);
});

test('imports pass activate', async () => {
  const bodies = [];
  const fetch = async (url, init) => { bodies.push([url.replace('http://api.test/api/v1', ''), JSON.parse(init.body)]); return new Response(JSON.stringify({ status: 201, payload: { importedAsInactive: false, next: '', agentIds: [] } }), { status: 201, headers: { 'Content-Type': 'application/json' } }); };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  await m2f.crews.import({ exportType: 'crew' }, { activate: true });
  await m2f.agents.import({ exportType: 'agent' });
  assert.deepEqual(bodies, [['/crews/import', { exportData: { exportType: 'crew' }, activate: true }], ['/agents/import', { exportData: { exportType: 'agent' } }]]);
});
