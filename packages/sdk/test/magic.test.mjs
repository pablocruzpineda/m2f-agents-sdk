import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

function client() {
  const calls = [];
  const fetch = async (url, init) => { calls.push([init.method, url.replace('http://api.test/api/v1', ''), init.body ? JSON.parse(init.body) : undefined]); return new Response(JSON.stringify({ status: 200, payload: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  return { calls, m2f: new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch }) };
}

test('magic calls map to /magic', async () => {
  const { calls, m2f } = client();
  await m2f.magic.createPackage({ name: 'Kit', items: [{ resourceType: 'agent', agentId: 'a1' }] });
  await m2f.magic.reorderItems('p1', ['i2', 'i1']);
  await m2f.magic.createLink('p1', { customLabel: 'IG' });
  await m2f.magic.deleteLink('l1', { confirm: true });
  assert.deepEqual(calls, [
    ['POST', '/magic/packages', { name: 'Kit', items: [{ resourceType: 'agent', agentId: 'a1' }] }],
    ['PUT', '/magic/packages/p1/items/order', { itemIds: ['i2', 'i1'] }],
    ['POST', '/magic/packages/p1/links', { customLabel: 'IG' }],
    ['DELETE', '/magic/links/l1', { confirm: true }],
  ]);
});

test('profile and read-only billing map to /account', async () => {
  const { calls, m2f } = client();
  await m2f.account.updateProfile({ company: 'Acme' });
  await m2f.account.payments();
  await m2f.account.subscription();
  await m2f.account.creditPricing();
  assert.deepEqual(calls.map(([m, u]) => `${m} ${u}`), ['PATCH /account/profile', 'GET /account/payments', 'GET /account/subscription', 'GET /account/credits/pricing']);
});
