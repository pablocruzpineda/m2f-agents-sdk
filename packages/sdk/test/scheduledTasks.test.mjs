// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

const client = (payload, calls) => new M2FClient({
  apiKey: 'rest_test',
  baseUrl: 'http://api.test/api/v1',
  fetch: async (url, init) => {
    calls.push([init.method, url.replace('http://api.test/api/v1', '')]);
    return new Response(JSON.stringify({ status: 200, payload }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
});

test('executions return each run with the agent reply as text', async () => {
  const calls = [];
  const reply = 'Weekly summary: ' + 'x'.repeat(20_000);
  const m2f = client({ executions: [{ id: 'e1', taskId: 't1', status: 'ok', startedAt: '2026-11-18T10:00:00Z', durationMs: 4200, response: reply, error: null }] }, calls);
  const runs = await m2f.scheduledTasks.executions('t1', { limit: 1 });
  assert.deepEqual(calls, [['GET', '/scheduled-tasks/t1/executions?limit=1']]);
  assert.equal(runs[0].response, reply);
  assert.equal(runs[0].response.length, reply.length);
});

test('run returns the reply text', async () => {
  const calls = [];
  const m2f = client({ result: { response: 'Done.', error: null } }, calls);
  const result = await m2f.scheduledTasks.run('t1');
  assert.deepEqual(calls, [['POST', '/scheduled-tasks/t1/run']]);
  assert.equal(result.response, 'Done.');
});
