import { Command } from 'commander';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

/** LLM providers, their model ids, and the account's LLM keys. */
export function registerModelCommands(program: Command): void {
  const models = program.command('models').description('LLM providers and their model ids (for an agent\'s models)');

  models.command('providers').action(async () => {
    try {
      printTable((await getClient().models.providers()).map((p) => ({ provider: p.provider, key: p.needsKey ? 'needs a key' : 'no key needed' })), ['provider', 'key']);
    } catch (error) { fail(error); }
  });

  models
    .command('list <provider>')
    .option('--search <text>', 'Filter by id or name')
    .option('--json', 'Output raw JSON')
    .action(async (provider: string, opts: { search?: string; json?: boolean }) => {
      try {
        const list = await getClient().models.list(provider, { search: opts.search });
        if (opts.json) return printJson(list);
        printTable(list.map((m) => ({ id: m.id, name: m.name })), ['id', 'name']);
      } catch (error) { fail(error); }
    });

  const keys = program.command('llm-keys').description('The account\'s LLM API keys (shown masked)');

  keys.command('list').action(async () => {
    try {
      const { keys: list } = await getClient().account.llmKeys();
      printTable(list.map((k) => ({ id: k.id, provider: k.provider, key: k.maskedKey, valid: k.isValid ? 'yes' : 'NO' })), ['id', 'provider', 'key', 'valid']);
    } catch (error) { fail(error); }
  });

  keys.command('status').description('Whether the account can run agents').action(async () => {
    try { printJson(await getClient().account.llmKeyStatus()); } catch (error) { fail(error); }
  });

  keys
    .command('set <provider>')
    .description('Add or replace the key for a provider (or pass it in M2F_LLM_KEY)')
    .option('--key <key>', 'The API key')
    .option('--standard <modelId>', 'Default Standard model for the account (required unless it already defaults to this provider)')
    .option('--thinking <modelId>', 'Default Thinking model (optional)')
    .action(async (provider: string, opts: { key?: string; standard?: string; thinking?: string }) => {
      try {
        const key = opts.key || process.env.M2F_LLM_KEY;
        if (!key) throw new Error('Pass --key or set M2F_LLM_KEY');
        const models = opts.standard ? { standard: opts.standard, ...(opts.thinking ? { thinking: opts.thinking } : {}) } : undefined;
        const r = await getClient().account.saveLlmKey(provider, key, { models });
        console.log(`Saved ${r.provider} key (${r.isValid ? 'valid' : 'NOT valid'}).`);
        if (r.modelDefaults) console.log(`Account defaults: ${JSON.stringify(r.modelDefaults)}`);
      } catch (error) {
        const body = (error as { body?: { code?: string; availableModels?: string[] } }).body;
        if (body?.code === 'MODELS_REQUIRED') {
          console.error('Choose the Standard model too: --standard <modelId>. Models this key can use:');
          console.error((body.availableModels ?? []).join('\n') || '(the provider did not list them)');
          process.exit(1);
        }
        fail(error);
      }
    });

  keys
    .command('rm <keyId>')
    .option('--yes', 'Confirm')
    .action(async (keyId: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          console.error('Agents on that provider stop answering until another key is added. Re-run with --yes to confirm.');
          process.exit(1);
        }
        await getClient().account.deleteLlmKey(keyId, { confirm: true });
        console.log('Key deleted.');
      } catch (error) { fail(error); }
    });

  models
    .command('capabilities <modelIds...>')
    .description('What each model can do: tool calls, reasoning, vision, audio input, image output, search, streaming')
    .action(async (ids: string[]) => {
      try { printJson(await getClient().models.capabilities(ids)); } catch (error) { fail(error); }
    });
}
