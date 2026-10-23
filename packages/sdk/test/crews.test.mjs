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

const blueprint = {
  name: 'Front desk',
  steps: [
    { switch: 'What does the guest need?', cases: [{ value: 'service', steps: [{ team: { lead: 'lead', members: ['house', 'tours'] } }] }], default: [{ agent: 'general' }] },
    { agent: 'writer', task: 'Write the reply' },
    { apiSend: { method: 'POST', url: 'https://crm.example/notes', body: { note: '{{previous_output}}' } } },
  ],
};

test('createFromBlueprint posts the blueprint and returns the created crew', async () => {
  const crew = { id: 'crew1', name: 'Front desk' };
  const { m2f, calls } = clientWith(() => ({ status: 201, json: { status: 201, payload: { crew } } }));
  assert.deepEqual(await m2f.crews.createFromBlueprint(blueprint), crew);
  assert.deepEqual([calls[0].method, calls[0].url], ['POST', 'http://api.test/api/v1/crews/blueprint']);
  assert.deepEqual(calls[0].body, { blueprint });
});

test('a dry run asks with dryRun=true and returns the compiled crew', async () => {
  const compiled = { name: 'Front desk', agentIds: ['lead'], executionFlow: [], workflowLayout: { nodes: [], edges: [] } };
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: { crew: compiled } } }));
  assert.deepEqual(await m2f.crews.createFromBlueprint(blueprint, { dryRun: true }), compiled);
  assert.equal(calls[0].url, 'http://api.test/api/v1/crews/blueprint?dryRun=true');
});

test('a blueprint with problems throws an M2FError listing all of them', async () => {
  const errors = ['agent nope was not found in this account', 'a team has at most 5 members'];
  const { m2f } = clientWith(() => ({ status: 400, json: { status: 400, message: 'The blueprint has problems', errors } }));
  await assert.rejects(m2f.crews.createFromBlueprint(blueprint), (e) => e instanceof M2FError && e.status === 400 && e.errors.join('|') === errors.join('|'));
});

test('errors is empty for an error without a list', async () => {
  const { m2f } = clientWith(() => ({ status: 404, json: { status: 404, message: 'Crew not found' } }));
  await assert.rejects(m2f.crews.get('x'), (e) => e instanceof M2FError && e.errors.length === 0);
});

test('updateFromBlueprint PUTs to the crew', async () => {
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: { crew: { id: 'crew1', name: 'Front desk' } } } }));
  await m2f.crews.updateFromBlueprint('crew1', blueprint);
  assert.deepEqual([calls[0].method, calls[0].url], ['PUT', 'http://api.test/api/v1/crews/crew1/blueprint']);
  assert.deepEqual(calls[0].body, { blueprint });
});

test('createTeam sends a single-team blueprint', async () => {
  const { m2f, calls } = clientWith(() => ({ status: 201, json: { status: 201, payload: { crew: { id: 'crew2', name: 'Concierge' } } } }));
  await m2f.crews.createTeam({ name: 'Concierge', lead: 'lead', members: ['house', 'maint'], task: 'Serve the guest', maxQuestions: 4 });
  assert.deepEqual(calls[0].body, {
    blueprint: { name: 'Concierge', team: { lead: 'lead', members: ['house', 'maint'], task: 'Serve the guest', maxQuestions: 4 } },
  });
});

test('execute returns the execution with the run result (answer, steps, delegations)', async () => {
  const execution = { id: 'run1', crewId: 'crew1', status: 'completed' };
  const result = {
    status: 'completed', finalOutput: 'Your room is ready', error: null, currentQuestion: null, threadId: 't1', waitingFor: null, notified: false,
    steps: [{ agentId: 'lead', agentName: 'Concierge', status: 'success', stepNumber: 1, nodeType: 'orchestrator', output: 'Your room is ready',
      delegations: [{ agentId: 'house', agentName: 'Housekeeping', task: 'Is 204 clean?', output: 'Yes', error: null }] }],
  };
  const { m2f, calls } = clientWith(() => ({ json: { status: 200, payload: { execution, result } } }));
  const run = await m2f.crews.execute('crew1', { message: 'Is my room ready?' });
  assert.equal(run.id, 'run1');
  assert.equal(run.result.finalOutput, 'Your room is ready');
  assert.equal(run.result.steps[0].delegations[0].agentName, 'Housekeeping');
  assert.deepEqual(calls[0].body, { input: { message: 'Is my room ready?' } });
});

test('execute still returns the bare execution from servers that send no result', async () => {
  const execution = { id: 'run1', crewId: 'crew1', status: 'running' };
  const { m2f } = clientWith(() => ({ json: { status: 200, payload: { execution } } }));
  assert.deepEqual(await m2f.crews.execute('crew1'), execution);
});
