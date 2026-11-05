// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient, M2FError } from '../dist/esm/index.js';

function clientWith(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    const isForm = init.body instanceof FormData;
    calls.push({ url, method: init.method, headers: init.headers, form: isForm ? init.body : undefined });
    const { status = 200, json } = respond(calls.at(-1));
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { m2f: new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch }), calls };
}

test('uploadDocument posts the file as multipart to the agent', async () => {
  const payload = { document: { id: 'd1', name: 'menu.pdf', ingestStatus: 'pending' }, usage: { totalSize: 3 } };
  const { m2f, calls } = clientWith(() => ({ status: 201, json: { status: 201, payload } }));
  assert.deepEqual(await m2f.agents.uploadDocument('ag 1', new Uint8Array([1, 2, 3]), 'menu.pdf'), payload);
  assert.equal(calls[0].url, 'http://api.test/api/v1/agents/ag%201/documents');
  assert.equal(calls[0].headers['Content-Type'], undefined);
  assert.equal(calls[0].form.get('file').name, 'menu.pdf');
});

test('a duplicate upload is a 409 M2FError', async () => {
  const { m2f } = clientWith(() => ({ status: 409, json: { status: 409, message: '"menu.pdf" is already in this agent\'s documents' } }));
  await assert.rejects(m2f.agents.uploadDocument('a', new Uint8Array([1]), 'menu.pdf'), (e) => e instanceof M2FError && e.status === 409);
});

test('listDocuments and deleteDocument hit the agent\'s documents', async () => {
  const { m2f, calls } = clientWith((c) => ({ json: { status: 200, payload: c.method === 'GET' ? { documents: [], usage: {} } : { deleted: 'd1', alsoRemoved: ['d2'], usage: {} } } }));
  await m2f.agents.listDocuments('a1');
  const del = await m2f.agents.deleteDocument('a1', 'd1');
  assert.deepEqual(del.alsoRemoved, ['d2']);
  assert.deepEqual(calls.map((c) => [c.method, c.url]), [
    ['GET', 'http://api.test/api/v1/agents/a1/documents'],
    ['DELETE', 'http://api.test/api/v1/agents/a1/documents/d1'],
  ]);
});
