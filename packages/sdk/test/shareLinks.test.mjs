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

test('share link and embed calls hit their routes', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: {} } }));
  await m2f.agents.getShareLink('ag1');
  await m2f.agents.createShareLink('ag1', { maxRequests: 100, regenerate: true });
  await m2f.agents.updateShareLink('ag1', { isActive: false });
  await m2f.agents.revokeShareLink('ag1');
  await m2f.agents.embedCode('ag1', { mode: 'inline', color: '#112233' });
  await m2f.voice.updateLine('ag1', { webCall: { enabled: true } });
  assert.deepEqual(calls.map((c) => [c.method, c.url, c.body]), [
    ['GET', 'http://api.test/api/v1/agents/ag1/share-link', undefined],
    ['POST', 'http://api.test/api/v1/agents/ag1/share-link', { maxRequests: 100, regenerate: true }],
    ['PATCH', 'http://api.test/api/v1/agents/ag1/share-link', { isActive: false }],
    ['DELETE', 'http://api.test/api/v1/agents/ag1/share-link', undefined],
    ['GET', 'http://api.test/api/v1/agents/ag1/embed?mode=inline&color=%23112233', undefined],
    ['PATCH', 'http://api.test/api/v1/voice/agents/ag1', { webCall: { enabled: true } }],
  ]);
});

test('creating over an existing link without regenerate is a 409', async () => {
  const { m2f } = clientWith(() => ({ status: 409, json: { status: 409, message: 'This agent already has a shared link.' } }));
  await assert.rejects(m2f.agents.createShareLink('ag1'), (e) => e instanceof M2FError && e.status === 409);
});
