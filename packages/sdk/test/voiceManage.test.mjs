// Runs against the built package (npm test builds first), so it covers what gets published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M2FClient } from '../dist/esm/index.js';

function clientWith() {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push([init.method, url.replace('http://api.test/api/v1', ''), init.body ? JSON.parse(init.body) : undefined]);
    return new Response(JSON.stringify({ status: 200, payload: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { m2f: new M2FClient({ apiKey: 'rest_test', baseUrl: 'http://api.test/api/v1', fetch }), calls };
}

test('voice provisioning calls hit their routes, with confirm where money is involved', async () => {
  const { m2f, calls } = clientWith();
  const yes = { confirm: true };
  await m2f.voice.updateLine('a1', { transfer: { enabled: true, numbers: ['+525511112222'] }, sip: { enabled: true, countryCode: '52' } });
  await m2f.voice.removeLine('a1');
  await m2f.voice.testWebhook('a1');
  await m2f.voice.testEmail('a1');
  await m2f.voice.rotateTrigger('a1', yes);
  await m2f.voice.sipCredentials('a1');
  await m2f.voice.lookupVoice('abc');
  await m2f.voice.account();
  await m2f.voice.connectTwilio('AC1', 'tok');
  await m2f.voice.disconnectTwilio(yes);
  await m2f.voice.numbers();
  await m2f.voice.searchNumbers({ country: 'MX', areaCode: '55' });
  await m2f.voice.buyNumber({ phoneNumber: '+525511112222', agentId: 'a1', ...yes });
  await m2f.voice.managedLine();
  await m2f.voice.subscribeManaged({ plan: 'basic', ...yes });
  await m2f.voice.changeManagedPlan({ plan: 'pro', ...yes });
  await m2f.voice.cancelManaged(yes);
  await m2f.voice.switchManagedToOwn(yes);
  await m2f.voice.readyNumbers();
  await m2f.voice.claimReadyNumber({ phoneNumber: '+525511112222', ...yes });
  assert.deepEqual(calls, [
    ['PATCH', '/voice/agents/a1', { transfer: { enabled: true, numbers: ['+525511112222'] }, sip: { enabled: true, countryCode: '52' } }],
    ['DELETE', '/voice/agents/a1', undefined],
    ['POST', '/voice/agents/a1/test-webhook', undefined],
    ['POST', '/voice/agents/a1/test-email', undefined],
    ['POST', '/voice/agents/a1/trigger-token', yes],
    ['GET', '/voice/agents/a1/sip-credentials', undefined],
    ['GET', '/voice/voices/lookup?id=abc', undefined],
    ['GET', '/voice/account', undefined],
    ['PUT', '/voice/account', { accountSid: 'AC1', authToken: 'tok' }],
    ['DELETE', '/voice/account', yes],
    ['GET', '/voice/numbers', undefined],
    ['GET', '/voice/numbers/available?country=MX&areaCode=55', undefined],
    ['POST', '/voice/numbers/purchase', { phoneNumber: '+525511112222', agentId: 'a1', confirm: true }],
    ['GET', '/voice/managed', undefined],
    ['POST', '/voice/managed/subscribe', { plan: 'basic', confirm: true }],
    ['POST', '/voice/managed/change', { plan: 'pro', confirm: true }],
    ['POST', '/voice/managed/cancel', yes],
    ['POST', '/voice/managed/switch-to-own', yes],
    ['GET', '/voice/managed/ready-numbers', undefined],
    ['POST', '/voice/managed/ready-numbers/claim', { phoneNumber: '+525511112222', confirm: true }],
  ]);
});
