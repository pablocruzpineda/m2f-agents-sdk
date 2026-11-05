// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

test('export/import, models and LLM keys hit their routes', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push([init.method, url.replace('http://api.test/api/v1', ''), init.body ? JSON.parse(init.body) : undefined]);
    return new Response(JSON.stringify({ status: 200, payload: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  await m2f.agents.export('a1');
  await m2f.agents.import({ exportType: 'agent', data: { name: 'x' } });
  await m2f.models.providers();
  await m2f.models.list('openai', { search: 'mini' });
  await m2f.account.llmKeys();
  await m2f.account.llmKeyStatus();
  await m2f.account.saveLlmKey('openai', 'sk-x');
  await m2f.account.deleteLlmKey('k1', { confirm: true });
  assert.deepEqual(calls, [
    ['GET', '/agents/a1/export', undefined],
    ['POST', '/agents/import', { exportData: { exportType: 'agent', data: { name: 'x' } } }],
    ['GET', '/models/providers', undefined],
    ['GET', '/models/openai?search=mini', undefined],
    ['GET', '/account/llm-keys', undefined],
    ['GET', '/account/llm-keys/status', undefined],
    ['PUT', '/account/llm-keys', { provider: 'openai', key: 'sk-x' }],
    ['DELETE', '/account/llm-keys/k1', { confirm: true }],
  ]);
});
