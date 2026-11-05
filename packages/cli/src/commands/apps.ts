import { Command } from 'commander';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

/** "gmail=ca_123" → { toolkit, connectedAccountId } */
export function parsePin(raw: string): { toolkit: string; connectedAccountId: string } {
  const at = raw.indexOf('=');
  if (at <= 0 || at === raw.length - 1) throw new Error(`--pin expects app=connectionId, got "${raw}"`);
  return { toolkit: raw.slice(0, at).trim(), connectedAccountId: raw.slice(at + 1).trim() };
}

/** "gmail, googlesheets" → ["gmail", "googlesheets"] */
export const parseList = (raw?: string): string[] => (raw || '').split(',').map((s) => s.trim()).filter(Boolean);

export function registerAppCommands(program: Command): void {
  const apps = program.command('apps').description('External apps: find them and connect accounts (attach with `m2f agents apps set`)');

  apps
    .command('search <query>')
    .description('Search the app catalog by name or by job ("send invoices")')
    .option('--category <id>', 'Category id')
    .option('--limit <n>', 'Max apps (default 10, max 20)')
    .option('--json', 'Output raw JSON')
    .action(async (query: string, opts: { category?: string; limit?: string; json?: boolean }) => {
      try {
        const result = await getClient().apps.search(query, { category: opts.category, limit: opts.limit ? parseInt(opts.limit, 10) : undefined });
        if (opts.json) return printJson(result);
        printTable(result.apps.map((a) => ({ slug: a.slug, name: a.name, connects: a.connection })), ['slug', 'name', 'connects']);
        for (const note of result.notes ?? []) console.log(`Note: ${note}`);
      } catch (error) {
        fail(error);
      }
    });

  apps
    .command('actions <toolkit> [actions...]')
    .description('What an app can do (name up to 5 actions for their parameters)')
    .action(async (toolkit: string, actions: string[]) => {
      try {
        printJson(await getClient().apps.actions(toolkit, actions ?? []));
      } catch (error) {
        fail(error);
      }
    });

  apps
    .command('connections')
    .description('List the account\'s connected app accounts')
    .option('--toolkits <list>', 'Comma-separated app slugs')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { toolkits?: string; json?: boolean }) => {
      try {
        const list = await getClient().apps.connections(parseList(opts.toolkits));
        if (opts.json) return printJson(list);
        printTable(list.map((c) => ({ id: c.id, app: c.toolkit, status: c.status, label: c.label ?? '' })), ['id', 'app', 'status', 'label']);
      } catch (error) {
        fail(error);
      }
    });

  apps
    .command('connect <toolkit>')
    .description('Create a sign-in link for an app — open it in a browser to connect the account')
    .action(async (toolkit: string) => {
      try {
        const link = await getClient().apps.connect(toolkit);
        console.log(`Open this link to connect ${link.toolkit}:\n  ${link.redirectUrl}`);
        console.log('Then check it with: m2f apps connections');
      } catch (error) {
        fail(error);
      }
    });

  apps
    .command('connect-token <toolkit>')
    .description('Connect an app that takes an API key or token')
    .requiredOption('--credentials <json>', 'Fields as JSON, e.g. \'{"generic_api_key":"..."}\'')
    .option('--scheme <scheme>', 'API_KEY (default) | BEARER_TOKEN')
    .action(async (toolkit: string, opts: { credentials: string; scheme?: 'API_KEY' | 'BEARER_TOKEN' }) => {
      try {
        const result = await getClient().apps.connectWithToken(toolkit, JSON.parse(opts.credentials) as Record<string, string>, opts.scheme);
        console.log(`Connected ${result.toolkit}: ${result.connectedAccountId} (${result.status})`);
      } catch (error) {
        fail(error);
      }
    });

  apps
    .command('rename <connectionId> <alias>')
    .description('Name a connected account')
    .action(async (connectionId: string, alias: string) => {
      try {
        const r = await getClient().apps.rename(connectionId, alias);
        console.log(`${r.id} is now "${r.label ?? ''}".`);
      } catch (error) {
        fail(error);
      }
    });

  apps
    .command('disconnect <connectionId>')
    .description('Revoke a connected account — agents using it stop reaching the app')
    .option('--yes', 'Skip confirmation')
    .action(async (connectionId: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          console.error('Every agent using this account stops reaching the app. Re-run with --yes to confirm.');
          process.exit(1);
        }
        const r = await getClient().apps.disconnect(connectionId);
        console.log(r.deleted ? `Revoked ${r.id} (${r.toolkit}).` : `Nothing to revoke for ${r.id}.`);
      } catch (error) {
        fail(error);
      }
    });

  apps
    .command('setup <toolkit>')
    .description('How an app connects here, and whether your organisation must register its own OAuth app first')
    .action(async (toolkit: string) => {
      try { printJson(await getClient().apps.setup(toolkit)); } catch (error) { fail(error); }
    });

  apps
    .command('oauth-app <toolkit>')
    .description('TENANTS: register your own OAuth app for an app with no managed login (see "apps setup" for the redirect URI)')
    .option('--client-id <id>')
    .option('--client-secret <secret>')
    .option('--scopes <scopes>')
    .option('--remove', 'Remove it instead (accounts connected through it stop working)')
    .option('--yes', 'Confirm --remove')
    .action(async (toolkit: string, o: { clientId?: string; clientSecret?: string; scopes?: string; remove?: boolean; yes?: boolean }) => {
      try {
        if (o.remove) {
          if (!o.yes) { console.error('Every account connected through this app stops working. Re-run with --yes to confirm.'); process.exit(1); }
          return printJson(await getClient().apps.removeOAuthApp(toolkit, { confirm: true }));
        }
        if (!o.clientId || !o.clientSecret) { console.error('--client-id and --client-secret are required.'); process.exit(1); }
        printJson(await getClient().apps.registerOAuthApp(toolkit, { client_id: o.clientId, client_secret: o.clientSecret, ...(o.scopes ? { scopes: o.scopes } : {}) }));
      } catch (error) { fail(error); }
    });
}
