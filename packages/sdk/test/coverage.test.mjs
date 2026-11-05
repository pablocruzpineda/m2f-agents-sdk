import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

test('graph namespaces/summary, app setup and own OAuth app, model capabilities', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push([init.method, url.replace('http://api.test/api/v1', ''), init.body ? JSON.parse(init.body) : undefined]); return new Response(JSON.stringify({ status: 200, payload: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  await m2f.knowledge.listNamespaces();
  await m2f.knowledge.graphSummary({ agentId: 'ag1' });
  await m2f.apps.setup('highlevel');
  await m2f.apps.registerOAuthApp('highlevel', { client_id: 'id', client_secret: 'sec' });
  await m2f.apps.removeOAuthApp('highlevel', { confirm: true });
  await m2f.models.capabilities(['gpt-5']);
  await m2f.tenant.setLogExport({ redactContent: true, redactInDb: true });
  assert.deepEqual(calls, [
    ['GET', '/knowledge/graph/namespaces', undefined],
    ['GET', '/knowledge/graph/summary?agentId=ag1', undefined],
    ['GET', '/apps/highlevel/setup', undefined],
    ['PUT', '/apps/highlevel/oauth-app', { client_id: 'id', client_secret: 'sec' }],
    ['DELETE', '/apps/highlevel/oauth-app', { confirm: true }],
    ['POST', '/models/capabilities', { models: ['gpt-5'] }],
    ['PUT', '/tenant/log-export', { redactContent: true, redactInDb: true }],
  ]);
});

test('knowledge.forAgent puts agentId on every call, also uploads', async () => {
  const urls = [];
  const fetch = async (url) => { urls.push(url.replace('http://api.test/api/v1', '')); return new Response(JSON.stringify({ status: 200, payload: { id: 's1', jobId: 'j1' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  const ag = m2f.knowledge.forAgent('ag1');
  await ag.createSource({ type: 'file', name: 'Catálogo' });
  await ag.syncSource('s1');
  await m2f.knowledge.listSources();
  assert.deepEqual(urls, ['/knowledge/sources?agentId=ag1', '/knowledge/sources/s1/sync?agentId=ag1', '/knowledge/sources']);
});

test('saving an LLM key sends the default models with it', async () => {
  const bodies = [];
  const fetch = async (url, init) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ status: 200, payload: { id: 'k', provider: 'openai', isValid: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
  const m2f = new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch });
  await m2f.account.saveLlmKey('openai', 'sk-x', { models: { standard: 'gpt-5' } });
  assert.deepEqual(bodies[0], { provider: 'openai', key: 'sk-x', models: { standard: 'gpt-5' } });
});
