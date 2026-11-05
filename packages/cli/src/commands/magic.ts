import { Command } from 'commander';
import { getClient } from '../config';
import { printJson, fail } from '../output';
import type { MagicItem } from '@mind2flow/agents-sdk';

const run = (fn: () => Promise<unknown>) => async () => { try { printJson(await fn()); } catch (error) { fail(error); } };
const yes = (o: { yes?: boolean }, what: string) => {
  if (!o.yes) {
    console.error(`${what} Re-run with --yes to confirm.`);
    process.exit(1);
  }
  return { confirm: true as const };
};
const int = (v: string) => { const n = Number(v); if (!Number.isInteger(n)) throw new Error(`Not a whole number: ${v}`); return n; };

/** "agent:<id>", "crew:<id>" or "tool:<id>" → a package item. */
export function parseItem(raw: string): MagicItem {
  const [kind, id] = raw.split(':');
  if (!id) throw new Error(`Item must look like agent:<id>, crew:<id> or tool:<id> (got ${raw})`);
  if (kind === 'agent') return { resourceType: 'agent', agentId: id };
  if (kind === 'crew') return { resourceType: 'crew', crewId: id };
  if (kind === 'tool') return { resourceType: 'custom_tool', customToolId: id };
  throw new Error(`Unknown item kind "${kind}": use agent, crew or tool`);
}

type PkgOpts = { description?: string; account?: string; subaccount?: string; credits?: string; max?: string; expires?: string; yes?: boolean };
const pkgFields = (o: PkgOpts) => ({
  description: o.description,
  targetAccountId: o.account,
  targetSubaccountId: o.subaccount,
  initialCredits: o.credits === undefined ? undefined : int(o.credits),
  maxRedemptions: o.max === undefined ? undefined : int(o.max),
  expiresAt: o.expires === 'never' ? null : o.expires,
  ...(o.yes ? { confirm: true as const } : {}),
});
const withPkgOpts = (c: Command) => c
  .option('--description <text>')
  .option('--account <accountId>', 'Put signups in this client account')
  .option('--subaccount <subaccountId>', 'With --account')
  .option('--credits <n>', 'Credits per signup from your balance (needs --yes)')
  .option('--max <n>', 'Cap on signups')
  .option('--expires <iso|never>', 'Expiry date')
  .option('--yes', 'Confirm credits per signup');

/** TENANTS: Magic packages, signup links and redemptions. */
export function registerMagicCommands(program: Command): void {
  const magic = program.command('magic').description('TENANTS: Magic packages (agents, crews, tools cloned into each signup), signup links, redemptions');
  const c = () => getClient().magic;

  magic.command('list').description('List packages').action(run(() => c().listPackages()));
  magic.command('get <packageId>').action((id: string) => run(() => c().getPackage(id))());
  withPkgOpts(magic.command('create <name>'))
    .option('--item <kind:id...>', 'agent:<id>, crew:<id> or tool:<id> (repeatable)')
    .option('--slug <slug>')
    .action((name: string, o: PkgOpts & { item?: string[]; slug?: string }) => run(() => c().createPackage({ name, slug: o.slug, ...pkgFields(o), items: (o.item ?? []).map(parseItem) }))());
  withPkgOpts(magic.command('update <packageId>')).option('--name <name>').option('--on').option('--off')
    .action((id: string, o: PkgOpts & { name?: string; on?: boolean; off?: boolean }) => run(() => c().updatePackage(id, { name: o.name, ...pkgFields(o), isActive: o.on ? true : o.off ? false : undefined }))());
  magic.command('rm <packageId>').option('--yes', 'Confirm').action((id: string, o: { yes?: boolean }) => run(() => c().deletePackage(id, yes(o, 'The package, its links and its redemption history are deleted.')))());

  const items = magic.command('items').description('A package\'s items');
  items.command('add <packageId> <kind:id>').action((id: string, item: string) => run(() => c().addItem(id, parseItem(item)))());
  items.command('rm <packageId> <itemId>').action((id: string, itemId: string) => run(() => c().removeItem(id, itemId))());
  items.command('order <packageId> <itemIds...>').action((id: string, ids: string[]) => run(() => c().reorderItems(id, ids))());

  const links = magic.command('links').description('Signup links');
  links.command('list <packageId>').action((id: string) => run(() => c().listLinks(id))());
  links.command('create <packageId>').option('--label <text>').option('--max <n>').option('--expires <iso>')
    .action((id: string, o: { label?: string; max?: string; expires?: string }) => run(() => c().createLink(id, { customLabel: o.label, maxRedemptions: o.max === undefined ? undefined : int(o.max), expiresAt: o.expires }))());
  links.command('update <linkId>').option('--label <text>').option('--max <n>').option('--expires <iso|never>').option('--on').option('--off')
    .action((id: string, o: { label?: string; max?: string; expires?: string; on?: boolean; off?: boolean }) => run(() => c().updateLink(id, {
      customLabel: o.label, maxRedemptions: o.max === undefined ? undefined : int(o.max), expiresAt: o.expires === 'never' ? null : o.expires, isActive: o.on ? true : o.off ? false : undefined,
    }))());
  links.command('rm <linkId>').option('--yes', 'Confirm').action((id: string, o: { yes?: boolean }) => run(() => c().deleteLink(id, yes(o, 'The link and its redemption history are deleted (use links update --off to just turn it off).')))());

  magic.command('redemptions <packageId>').option('--link <linkId>', 'Only one link')
    .action((id: string, o: { link?: string }) => run(() => (o.link ? c().linkRedemptions(o.link) : c().packageRedemptions(id)))());
}

/** Your profile; credits and payments read-only (buying happens in the console). */
export function registerProfileCommands(program: Command): void {
  const profile = program.command('profile').description('Your profile, account context, and read-only credits, payments and plan');
  const a = () => getClient().account;
  profile.command('show').action(run(() => a().profile()));
  profile.command('update').option('--first-name <v>').option('--last-name <v>').option('--phone <v>').option('--company <v>').option('--avatar-url <https>')
    .action((o: { firstName?: string; lastName?: string; phone?: string; company?: string; avatarUrl?: string }) =>
      run(() => a().updateProfile({ firstName: o.firstName, lastName: o.lastName, phoneNumber: o.phone, company: o.company, avatarUrl: o.avatarUrl }))());
  profile.command('models').description('Your account default provider and models (API Settings)')
    .option('--provider <name>').option('--standard <modelId>').option('--thinking <modelId>').option('--temperature <n>').option('--max-tokens <n>')
    .action((o: { provider?: string; standard?: string; thinking?: string; temperature?: string; maxTokens?: string }) => {
      const changing = o.provider || o.standard || o.thinking || o.temperature || o.maxTokens;
      if (!changing) return run(() => a().modelDefaults())();
      if (o.thinking && !o.standard) { console.error('--thinking needs --standard too (the standard model is required).'); process.exit(1); }
      return run(() => a().setModelDefaults({
        provider: o.provider,
        models: o.standard ? { standard: o.standard, ...(o.thinking ? { thinking: o.thinking } : {}) } : undefined,
        temperature: o.temperature === undefined ? undefined : Number(o.temperature),
        maxTokens: o.maxTokens === undefined ? undefined : Number(o.maxTokens),
      }))();
    });
  profile.command('context').description('Managed by a tenant or standalone; AI key set').action(run(() => a().context()));
  profile.command('balance').action(run(() => a().creditBalance()));
  profile.command('pricing').description('Credit packages and prices').action(run(() => a().creditPricing()));
  profile.command('payments').description('Last 50 purchases and plan payments').action(run(() => a().payments()));
  profile.command('plan').description('Active plan, or null').action(run(() => a().subscription()));
}
