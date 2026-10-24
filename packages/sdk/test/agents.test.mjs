// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

function clientWith(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    const { status = 200, json } = respond(calls.at(-1));
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { m2f: new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch }), calls };
}

const done = { json: { status: 200, payload: { executionId: 'e1', agentId: 'a1', result: { response: 'ok' } } } };

test('execute sends sessionId and sender beside the input, so each person keeps their own memory', async () => {
  const { m2f, calls } = clientWith(() => done);
  await m2f.agents.execute('a1', { input: 'hola', sessionId: 'customer-123', sender: '5218111111111' });
  assert.deepEqual([calls[0].method, calls[0].url], ['POST', 'http://api.test/api/v1/agents/a1/executions']);
  assert.deepEqual(calls[0].body, { input: 'hola', sessionId: 'customer-123', sender: '5218111111111' });
});

test('execute without them sends what it always did', async () => {
  const { m2f, calls } = clientWith(() => done);
  const res = await m2f.agents.execute('a1', { input: 'hola' });
  assert.deepEqual(calls[0].body, { input: 'hola' });
  assert.equal(res.executionId, 'e1');
});
