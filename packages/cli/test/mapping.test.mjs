// Runs against the built CLI (npm test builds first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { applyMappingEdits } = createRequire(import.meta.url)('../dist/mapping.js');

const proposal = () => ({
  filename: 'catalogo.xlsx',
  headers: ['Nombre del producto', 'Precio', 'Notas internas'],
  columns: [
    { header: 'Nombre del producto', field: 'nombre_del_producto', type: 'text', include: true, samples: ['Maca'], filled: 1 },
    { header: 'Precio', field: 'precio', type: 'text', include: true },
    { header: 'Notas internas', field: 'notas_internas', type: 'text', include: true },
  ],
  name_field: 'nombre_del_producto',
  entity_type: 'Product',
  confirmed: false,
});

test('with no edits the proposal is confirmed as GraphOS made it, minus read-only fields', () => {
  assert.deepEqual(applyMappingEdits(proposal(), {}), {
    columns: [
      { header: 'Nombre del producto', field: 'nombre_del_producto', type: 'text', include: true },
      { header: 'Precio', field: 'precio', type: 'text', include: true },
      { header: 'Notas internas', field: 'notas_internas', type: 'text', include: true },
    ],
    name_field: 'nombre_del_producto',
    entity_type: 'Product',
  });
});

test('columns are found by header or field, case-insensitively', () => {
  const body = applyMappingEdits(proposal(), {
    types: ['precio=number'],
    exclude: ['notas internas'],
    renames: ['Nombre del producto=nombre'],
    nameField: 'Nombre del producto',
    entityType: 'Medicine',
  });
  assert.deepEqual(body.columns.map((c) => [c.field, c.type, c.include]), [
    ['nombre', 'text', true], ['precio', 'number', true], ['notas_internas', 'text', false],
  ]);
  assert.equal(body.name_field, 'nombre');
  assert.equal(body.entity_type, 'Medicine');
});

test('mistakes are caught before the request, with the reason', () => {
  assert.throws(() => applyMappingEdits(proposal(), { types: ['precio=money'] }), /not one of/);
  assert.throws(() => applyMappingEdits(proposal(), { types: ['costo=number'] }), /no column "costo"/);
  assert.throws(() => applyMappingEdits(proposal(), { exclude: ['nombre_del_producto'] }), /must be included/);
  assert.throws(() => applyMappingEdits(proposal(), { renames: ['notas internas=precio'] }), /both be called "precio"/);
  assert.throws(() => applyMappingEdits({ ...proposal(), name_field: null }, {}), /--name-field/);
  assert.throws(() => applyMappingEdits(proposal(), { types: ['precio'] }), /column=value/);
});

test('an excluded column may share a field name with an included one', () => {
  const body = applyMappingEdits(proposal(), { exclude: ['notas internas'], renames: ['notas internas=precio'] });
  assert.equal(body.columns[2].include, false);
});

test('renaming the proposed name column carries the name over to its new field', () => {
  const body = applyMappingEdits(proposal(), { renames: ['Nombre del producto=nombre'] });
  assert.equal(body.name_field, 'nombre');
});

const { parsePin, parseList } = createRequire(import.meta.url)('../dist/commands/apps.js');

test('--pin and lists parse the way the help says', () => {
  assert.deepEqual(parsePin('gmail=ca_123'), { toolkit: 'gmail', connectedAccountId: 'ca_123' });
  assert.throws(() => parsePin('gmail'), /app=connectionId/);
  assert.deepEqual(parseList(' gmail, googlesheets ,'), ['gmail', 'googlesheets']);
});

const { claudeCodeCommand } = createRequire(import.meta.url)('../dist/commands/mcp.js');

test('the Claude Code command uses Streamable HTTP and the key as a header', () => {
  assert.equal(
    claudeCodeCommand('mind2flow', 'https://mcp.example.com/mcp-stream', 'mcp_abc'),
    'claude mcp add --transport http mind2flow https://mcp.example.com/mcp-stream --header "Authorization: Bearer mcp_abc"'
  );
});

const desktop = createRequire(import.meta.url)('../dist/commands/mcp.js');
const { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { execFileSync } = await import('node:child_process');
const CLI = new URL('../dist/index.js', import.meta.url).pathname;

test('Claude Desktop config path per platform', () => {
  assert.equal(desktop.desktopConfigPath('darwin', {}, '/Users/x'), '/Users/x/Library/Application Support/Claude/claude_desktop_config.json');
  assert.equal(desktop.desktopConfigPath('win32', { APPDATA: 'C:\\AppData' }, 'C:\\Users\\x').replace(/\\/g, '/'), 'C:/AppData/Claude/claude_desktop_config.json');
  assert.throws(() => desktop.desktopConfigPath('linux', {}, '/home/x'), /macOS and Windows/);
});

test('merging keeps the other servers and replaces only ours', () => {
  const existing = JSON.stringify({ mcpServers: { supabase: { command: 'npx', args: ['x'] }, mind2flow: { command: 'old' } }, other: true });
  const { text, replaced } = desktop.mergeDesktopConfig(existing, 'mind2flow', desktop.desktopServerEntry('https://mcp.example/mcp', 'mcp_abc123'));
  const out = JSON.parse(text);
  assert.equal(replaced, true);
  assert.deepEqual(out.mcpServers.supabase, { command: 'npx', args: ['x'] });
  assert.equal(out.other, true);
  assert.deepEqual(out.mcpServers.mind2flow.args, ['-y', 'supergateway', '--sse', 'https://mcp.example/mcp', '--header', 'Authorization: Bearer mcp_abc123']);
});

test('a broken config file is refused, never overwritten', () => {
  assert.throws(() => desktop.mergeDesktopConfig('{ not json', 'mind2flow', desktop.desktopServerEntry('u', 'mcp_abc123')), /not valid JSON/);
});

test('keys never reach the screen', () => {
  assert.equal(desktop.redactKeys('Authorization: Bearer mcp_3c4bc02a5b789b6e8852'), 'Authorization: Bearer mcp_<your-key>');
});

test('end to end on a scratch file: backup, merge, private permissions, key not printed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm2f-desktop-'));
  const file = join(dir, 'claude_desktop_config.json');
  writeFileSync(file, JSON.stringify({ mcpServers: { supabase: { command: 'npx' } } }));
  const out = execFileSync('node', [CLI, 'mcp', 'desktop-config', '--mcp-key', 'mcp_deadbeef1234', '--config', file], { encoding: 'utf-8' });
  assert.equal(out.includes('mcp_deadbeef1234'), false);
  const written = JSON.parse(readFileSync(file, 'utf-8'));
  assert.deepEqual(Object.keys(written.mcpServers).sort(), ['mind2flow', 'supabase']);
  assert.equal(written.mcpServers.mind2flow.args[3], 'https://mcp.mind2flow.io/mcp');
  assert.equal(readdirSync(dir).filter((f) => f.includes('.bak-')).length, 1);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const printed = execFileSync('node', [CLI, 'mcp', 'desktop-config', '--mcp-key', 'mcp_deadbeef1234', '--print'], { encoding: 'utf-8' });
  assert.match(printed, /mcp_<your-key>/);
  assert.equal(printed.includes('mcp_deadbeef1234'), false);
});

test('Cursor setup: merges, backs up, refuses broken JSON, defaults to the production URL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm2f-cursor-'));
  const file = join(dir, 'mcp.json');
  writeFileSync(file, JSON.stringify({ mcpServers: { github: { url: 'https://gh' } } }));
  const out = execFileSync('node', [CLI, 'mcp', 'setup', '--mcp-key', 'mcp_deadbeef1234', '--config', file], { encoding: 'utf-8' });
  assert.equal(out.includes('mcp_deadbeef1234'), false);
  const written = JSON.parse(readFileSync(file, 'utf-8'));
  assert.deepEqual(written.mcpServers.github, { url: 'https://gh' });
  assert.deepEqual(written.mcpServers.mind2flow, { url: 'https://mcp.mind2flow.io/mcp', headers: { Authorization: 'Bearer mcp_deadbeef1234' } });
  assert.equal(readdirSync(dir).filter((f) => f.includes('.bak-')).length, 1);

  const broken = join(dir, 'broken.json');
  writeFileSync(broken, '{ "mcpServers": { "github": ');
  assert.throws(() => execFileSync('node', [CLI, 'mcp', 'setup', '--mcp-key', 'mcp_deadbeef1234', '--config', broken], { stdio: 'pipe' }));
  assert.equal(readFileSync(broken, 'utf-8'), '{ "mcpServers": { "github": ', 'a broken file is left exactly as it was');
});

test('claude-command defaults to the SSE endpoint verified in production', () => {
  const out = execFileSync('node', [CLI, 'mcp', 'claude-command', '--mcp-key', 'mcp_x1'], { encoding: 'utf-8' }).trim();
  assert.equal(out, 'claude mcp add --transport sse mind2flow https://mcp.mind2flow.io/mcp --header "Authorization: Bearer mcp_x1"');
});

test('voice commands that cost money stop without --yes, before any request', () => {
  const env = { ...process.env, M2F_API_KEY: 'rest_x', M2F_BASE_URL: 'http://127.0.0.1:9/api/v1' };
  for (const args of [['voice', 'buy', '+525511112222'], ['voice', 'managed', 'subscribe', 'basic'], ['voice', 'managed', 'claim', '+525511112222'], ['voice', 'rotate-trigger', 'a1'], ['voice', 'twilio', 'disconnect']]) {
    let stderr = '';
    try { execFileSync('node', [CLI, ...args], { env, stdio: 'pipe' }); } catch (e) { stderr = String(e.stderr); }
    assert.match(stderr, /--yes/, args.join(' '));
    assert.doesNotMatch(stderr, /ECONNREFUSED|Network error/, args.join(' '));
  }
});

const { logoValue } = createRequire(import.meta.url)('../dist/commands/tenant.js');

test('a logo flag accepts a file, an https URL or a data URI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'm2f-logo-'));
  const file = join(dir, 'logo.png');
  writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  assert.match(logoValue(file).value, /^data:image\/png;base64,iVBORw==$/);
  assert.deepEqual(logoValue('https://cdn.example/logo.png'), { url: 'https://cdn.example/logo.png' });
  assert.deepEqual(logoValue('data:image/png;base64,AAA'), { value: 'data:image/png;base64,AAA' });
});
