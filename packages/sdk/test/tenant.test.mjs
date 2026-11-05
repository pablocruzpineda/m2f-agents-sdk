// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

test('tenant calls hit /tenant routes with the bodies the API expects', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push([init.method, url.replace('http://api.test/api/v1', ''), init.body ? JSON.parse(init.body) : undefined]);
    return new Response(JSON.stringify({ status: 200, payload: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  const yes = { confirm: true };
  await m2f.tenant.settings();
  await m2f.tenant.transferCredits({ userId: 'u1', credits: 5, ...yes });
  await m2f.tenant.createClient({ name: 'Clínica Norte' });
  await m2f.tenant.addUser('a1', 's1', { name: 'Ana', email: 'ana@x.mx' });
  await m2f.tenant.deleteClient('a1', yes);
  await m2f.tenant.logExport();
  await m2f.tenant.logExport('a1');
  await m2f.tenant.updatePricing({ requestCost: 2 });
  await m2f.tenant.adminAdjustCredits('t1', { operation: 'add', credits: 100, ...yes });
  assert.deepEqual(calls, [
    ['GET', '/tenant/settings', undefined],
    ['POST', '/tenant/credits/transfer', { userId: 'u1', credits: 5, confirm: true }],
    ['POST', '/tenant/clients', { name: 'Clínica Norte' }],
    ['POST', '/tenant/clients/a1/subaccounts/s1/users', { name: 'Ana', email: 'ana@x.mx' }],
    ['DELETE', '/tenant/clients/a1', { confirm: true }],
    ['GET', '/tenant/log-export', undefined],
    ['GET', '/tenant/clients/a1/log-export', undefined],
    ['PATCH', '/tenant/pricing', { requestCost: 2 }],
    ['POST', '/tenant/admin/tenants/t1/credits', { operation: 'add', credits: 100, confirm: true }],
  ]);
});
