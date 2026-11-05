// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

function clientWith(respond = () => ({})) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push([init.method, url.replace('http://api.test/api/v1', ''), init.body ? JSON.parse(init.body) : undefined]);
    return new Response(JSON.stringify({ status: 200, payload: respond(calls.at(-1), calls.length) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { m2f: new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch }), calls };
}

test('linking and Meta calls hit their routes', async () => {
  const { m2f, calls } = clientWith();
  await m2f.devices.startPairing('d1', { phoneNumber: '+5215512345678' });
  await m2f.devices.pairingStatus('d1', 'device_d1_1');
  await m2f.devices.refreshQr('d1', 'device_d1_1');
  await m2f.devices.cancelPairing('d1', 'device_d1_1');
  await m2f.devices.whatsappStatus('d1');
  await m2f.devices.disconnectWhatsApp('d1', { confirm: true });
  await m2f.devices.setSendEndpoint('d1');
  await m2f.devices.removeSendEndpoint('d1');
  await m2f.devices.metaSavedAccounts();
  await m2f.devices.metaInspect({ savedAppId: 'app1' });
  await m2f.devices.metaConnectAuto('d1', { inspectionId: 'i1', phoneNumberId: 'p1' });
  await m2f.devices.metaConnectManual('d1', { phoneNumberId: 'p1', wabaId: 'w1', accessToken: 't' });
  await m2f.devices.metaStatus('d1');
  await m2f.devices.metaTemplates('d1', { refresh: true });
  await m2f.devices.metaProfile('d1');
  await m2f.devices.updateMetaProfile('d1', { about: 'Hola' });
  assert.deepEqual(calls.map((c) => c.slice(0, 2)), [
    ['POST', '/devices/d1/whatsapp/pair'], ['GET', '/devices/d1/whatsapp/pair/device_d1_1'], ['POST', '/devices/d1/whatsapp/pair/device_d1_1/qr'],
    ['DELETE', '/devices/d1/whatsapp/pair/device_d1_1'], ['GET', '/devices/d1/whatsapp'], ['DELETE', '/devices/d1/whatsapp'],
    ['POST', '/devices/d1/send-endpoint'], ['DELETE', '/devices/d1/send-endpoint'], ['GET', '/devices/whatsapp-cloud/saved-accounts'],
    ['POST', '/devices/whatsapp-cloud/inspect'], ['POST', '/devices/d1/whatsapp-cloud/auto'], ['POST', '/devices/d1/whatsapp-cloud'],
    ['GET', '/devices/d1/whatsapp-cloud'], ['GET', '/devices/d1/whatsapp-cloud/templates?refresh=true'], ['GET', '/devices/d1/whatsapp-cloud/profile'],
    ['PUT', '/devices/d1/whatsapp-cloud/profile'],
  ]);
  assert.deepEqual(calls[5][2], { confirm: true });
});

test('waitForPairing polls until connected and refreshes the QR on the way', async () => {
  const { m2f } = clientWith(([method, url], n) => (method === 'POST' && url.endsWith('/qr') ? { pairingId: 'p', qr: `qr${n}` } : { connected: n >= 4, state: n >= 4 ? 'open' : 'connecting' }));
  const qrs = [];
  const status = await m2f.devices.waitForPairing('d1', { pairingId: 'p', method: 'qr', next: '' }, { intervalMs: 1, qrEveryMs: -1, onQr: (q) => qrs.push(q) });
  assert.equal(status.connected, true);
  assert.ok(qrs.length >= 1);
});
