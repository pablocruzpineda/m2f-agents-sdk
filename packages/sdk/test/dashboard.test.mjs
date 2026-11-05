import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

test('dashboard calls hit /dashboard with their filters', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push([init.method, url.replace('http://api.test/api/v1', '')]); return new Response(JSON.stringify({ status: 200, payload: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  await m2f.dashboard.consumption({ accountId: 'a1', startDate: '2026-10-01' });
  await m2f.dashboard.agentConsumption('ag1', { groupBy: 'week' });
  await m2f.dashboard.tokenUsage({ tz: 'America/Mexico_City' });
  await m2f.dashboard.organizationAgents();
  assert.deepEqual(calls, [
    ['GET', '/dashboard/consumption?accountId=a1&startDate=2026-10-01'],
    ['GET', '/dashboard/consumption/agents/ag1?groupBy=week'],
    ['GET', '/dashboard/token-usage?tz=America%2FMexico_City'],
    ['GET', '/dashboard/organization/agents'],
  ]);
});
