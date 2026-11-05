// Runs against the built CLI (npm test builds first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseItem } = require('../dist/commands/magic.js');

test('magic items parse from kind:id', () => {
  assert.deepEqual(parseItem('agent:a1'), { resourceType: 'agent', agentId: 'a1' });
  assert.deepEqual(parseItem('crew:c1'), { resourceType: 'crew', crewId: 'c1' });
  assert.deepEqual(parseItem('tool:t1'), { resourceType: 'custom_tool', customToolId: 't1' });
  assert.throws(() => parseItem('cc:x'), /Unknown item kind/);
  assert.throws(() => parseItem('agent'), /agent:<id>/);
});
