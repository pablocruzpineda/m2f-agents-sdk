// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient, M2FError } from '../dist/esm/index.js';

function clientWith(respond) {
  const calls = [];
  const fetch = async (url, init) => {
    const isForm = init.body instanceof FormData;
    calls.push({
      url,
      method: init.method,
      headers: init.headers,
      form: isForm ? init.body : undefined,
      body: !isForm && init.body ? JSON.parse(init.body) : undefined,
    });
    const { status = 200, json } = respond(calls.at(-1), calls.length);
    return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { m2f: new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch }), calls };
}

test('uploadDocument sends multipart with the filename and lets fetch set the boundary', async () => {
  const doc = { id: 'd1', filename: 'Catálogo 2026.xlsx', status: 'needs_mapping' };
  const { m2f, calls } = clientWith(() => ({ status: 201, json: { status: 201, payload: doc } }));
  const bytes = new TextEncoder().encode('nombre,precio\nA,1\n');
  assert.deepEqual(await m2f.knowledge.uploadDocument('src 1', bytes, 'Catálogo 2026.xlsx'), doc);
  const call = calls[0];
  assert.equal(call.url, 'http://api.test/api/v1/knowledge/sources/src%201/upload');
  assert.equal(call.method, 'POST');
  assert.equal(call.headers['Content-Type'], undefined, 'multipart must not be sent as JSON');
  assert.equal(call.headers['x-api-key'], 'rest_test');
  const file = call.form.get('file');
  assert.equal(file.name, 'Catálogo 2026.xlsx');
  assert.equal(await file.text(), 'nombre,precio\nA,1\n');
});

test('JSON requests still carry the JSON content type', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: { results: [] } } }));
  await m2f.knowledge.exactValues(['Gastrizan']);
  assert.equal(calls[0].headers['Content-Type'], 'application/json');
  assert.deepEqual(calls[0].body, { names: ['Gastrizan'] });
  assert.equal(calls[0].url, 'http://api.test/api/v1/knowledge/exact-values');
});

test('confirmSchema PUTs only the editable column fields, with the filename encoded', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: { filename: 'a b.xlsx', confirmed: true } } }));
  await m2f.knowledge.confirmSchema('s1', 'a b.xlsx', {
    columns: [{ header: 'Precio', field: 'precio', type: 'number', include: true, samples: ['10'], filled: 1 }],
    name_field: 'nombre',
    entity_type: 'Product',
  });
  assert.equal(calls[0].method, 'PUT');
  assert.equal(calls[0].url, 'http://api.test/api/v1/knowledge/sources/s1/schemas/a%20b.xlsx');
  assert.deepEqual(calls[0].body, {
    columns: [{ header: 'Precio', field: 'precio', type: 'number', include: true }],
    name_field: 'nombre',
    entity_type: 'Product',
  });
});

test('getSchema picks one file out of the list, or null', async () => {
  const { m2f } = clientWith(() => ({ json: { status: 200, payload: [{ filename: 'a.xlsx' }, { filename: 'b.csv' }] } }));
  assert.deepEqual(await m2f.knowledge.getSchema('s1', 'b.csv'), { filename: 'b.csv' });
  assert.equal(await m2f.knowledge.getSchema('s1', 'c.csv'), null);
});

test('waitForJob polls until the job finishes', async () => {
  const statuses = ['queued', 'running', 'completed'];
  const { m2f, calls } = clientWith((_call, n) => ({ json: { status: 200, payload: { id: 'j1', status: statuses[n - 1], stats: {} } } }));
  const seen = [];
  const job = await m2f.knowledge.waitForJob('j1', { intervalMs: 1, onPoll: (j) => seen.push(j.status) });
  assert.equal(job.status, 'completed');
  assert.deepEqual(seen, statuses);
  assert.equal(calls.length, 3);
});

test('waitForJob gives up with M2FError at its timeout', async () => {
  const { m2f } = clientWith(() => ({ json: { status: 200, payload: { id: 'j1', status: 'running', stats: {} } } }));
  await assert.rejects(m2f.knowledge.waitForJob('j1', { intervalMs: 5, timeoutMs: 1 }), (e) => e instanceof M2FError && /still running/.test(e.message));
});

test('records: list with filters, patch, delete', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: { columns: ['precio'], rows: [], total: 0 } } }));
  await m2f.knowledge.listRecords({ label: 'Product', q: 'maca', limit: 10 });
  await m2f.knowledge.updateRecord('u/1', { values: { precio: null } });
  await m2f.knowledge.deleteRecord('u1');
  assert.deepEqual(calls.map((c) => [c.method, c.url, c.body]), [
    ['GET', 'http://api.test/api/v1/knowledge/records?label=Product&q=maca&limit=10', undefined],
    ['PATCH', 'http://api.test/api/v1/knowledge/records/u%2F1', { values: { precio: null } }],
    ['DELETE', 'http://api.test/api/v1/knowledge/records/u1', undefined],
  ]);
});

test('a refused confirmation surfaces the server reason', async () => {
  const { m2f } = clientWith(() => ({ status: 400, json: { status: 400, message: "name_field 'x' is not an included column" } }));
  await assert.rejects(
    m2f.knowledge.confirmSchema('s1', 'a.xlsx', { columns: [{ header: 'A', field: 'a' }], name_field: 'x' }),
    (e) => e instanceof M2FError && e.status === 400 && /not an included column/.test(e.message)
  );
});
