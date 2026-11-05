import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { getClient } from '../config';
import { printJson, fail } from '../output';

type Json = Record<string, unknown>;

const json = (raw: string): Json => {
  const v: unknown = JSON.parse(raw.startsWith('@') ? fs.readFileSync(raw.slice(1), 'utf-8') : raw);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected a JSON object');
  return v as Json;
};
const yes = (o: { yes?: boolean }, what: string) => {
  if (!o.yes) {
    console.error(`${what} Re-run with --yes to confirm.`);
    process.exit(1);
  }
  return { confirm: true as const };
};
/** A logo from a file path (→ data URI), an https URL (downloaded by the server) or a data URI as is. */
export function logoValue(raw: string): { value?: string; url?: string } {
  if (raw.startsWith('data:')) return { value: raw };
  if (/^https:\/\//.test(raw)) return { url: raw };
  const ext = path.extname(raw).toLowerCase().replace('.', '') || 'png';
  const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  return { value: `data:${mime};base64,${fs.readFileSync(raw).toString('base64')}` };
}
const run = (fn: () => Promise<unknown>) => async () => { try { printJson(await fn()); } catch (error) { fail(error); } };

export function registerTenantCommands(program: Command): void {
  const tenant = program.command('tenant').description('White-label reselling: clients, credits, pricing, Stripe, keys, branding, domain (and platform admin)');
  const c = () => getClient().tenant;

  tenant.command('settings').description('Pricing, Stripe and lent keys (secrets masked)').action(run(() => c().settings()));
  tenant.command('credits').description('The tenant balance').action(run(() => c().credits()));
  tenant.command('transfer <userId> <credits>').option('--yes', 'Confirm').description('Give credits to one of your users')
    .action(async (userId: string, credits: string, o: { yes?: boolean }) => run(() => c().transferCredits({ userId, credits: Number(credits), ...yes(o, 'Credits leave your balance.') }))());
  tenant.command('signup-link').option('--trial <credits>', 'Set the trial credits of new signups')
    .option('--lang <es|en>', 'Link / embed language (default es)').option('--theme <light|dark>', 'Embed theme').option('--color <hex>', 'Embed button color')
    .description('Your public Create Agent link: url, embed script, signups, trial credits')
    .action(async (o: { trial?: string; lang?: 'es' | 'en'; theme?: 'light' | 'dark'; color?: string }) =>
      run(() => (o.trial !== undefined ? c().setTrialCredits(Number(o.trial)) : c().signupLink({ lang: o.lang, theme: o.theme, color: o.color })))());
  tenant.command('pricing').requiredOption('--set <json>', '{ baseRate?, requestCost?, packages? } or @file.json').description('Change what clients pay')
    .action(async (o: { set: string }) => run(() => c().updatePricing(json(o.set)))());

  const tiers = tenant.command('tiers').description('Volume discounts');
  tiers.command('add <minimumCredits> <discountPercentage>').action(async (m: string, d: string) => run(() => c().addDiscountTier({ minimumCredits: Number(m), discountPercentage: Number(d) }))());
  tiers.command('update <tierId>').option('--min <credits>', 'Minimum credits').option('--discount <percent>', 'Discount percentage')
    .action(async (id: string, o: { min?: string; discount?: string }) => run(() => c().updateDiscountTier(id, {
      ...(o.min !== undefined ? { minimumCredits: Number(o.min) } : {}), ...(o.discount !== undefined ? { discountPercentage: Number(o.discount) } : {}),
    }))());
  tiers.command('rm <tierId>').action(async (id: string) => run(() => c().deleteDiscountTier(id))());

  const stripe = tenant.command('stripe').description('Your own Stripe (clients pay you there)');
  stripe.command('set').requiredOption('--public <pk>', 'pk_…').option('--secret <sk>', 'sk_… (or STRIPE_SECRET_KEY)')
    .action(async (o: { public: string; secret?: string }) => run(() => {
      const secretKey = o.secret || process.env.STRIPE_SECRET_KEY;
      if (!secretKey) throw new Error('Pass --secret or set STRIPE_SECRET_KEY');
      return c().setStripe({ publicKey: o.public, secretKey });
    })());
  stripe.command('enable').action(run(() => c().setStripeEnabled(true)));
  stripe.command('disable').action(run(() => c().setStripeEnabled(false)));

  const keys = tenant.command('keys').description('LLM keys you lend to clients (masked)');
  keys.command('list').action(run(() => c().llmKeys()));
  keys.command('add').option('--key <key>', 'The key (or M2F_LLM_KEY)').option('--provider <p>', 'Default openai').option('--account <accountId>', 'Assign to a client account')
    .action(async (o: { key?: string; provider?: string; account?: string }) => run(() => {
      const key = o.key || process.env.M2F_LLM_KEY;
      if (!key) throw new Error('Pass --key or set M2F_LLM_KEY');
      return c().addLlmKey({ key, provider: o.provider, assignedAccount: o.account });
    })());
  keys.command('validate').option('--key <key>', 'The key (or M2F_LLM_KEY)').option('--provider <p>', 'Default openai').description('Check a key with the provider without saving it')
    .action(async (o: { key?: string; provider?: string }) => run(() => {
      const key = o.key || process.env.M2F_LLM_KEY;
      if (!key) throw new Error('Pass --key or set M2F_LLM_KEY');
      return c().validateLlmKey(o.provider || 'openai', key);
    })());
  keys.command('update <keyId>').option('--key <key>', 'Replace the key (or M2F_LLM_KEY)').option('--account <accountId>', 'Assign it to a client account')
    .action(async (id: string, o: { key?: string; account?: string }) => run(() => c().updateLlmKey(id, {
      ...((o.key || process.env.M2F_LLM_KEY) ? { key: o.key || process.env.M2F_LLM_KEY } : {}), ...(o.account ? { assignedAccount: o.account } : {}),
    }))());
  keys.command('rm <keyId>').option('--yes', 'Confirm').action(async (id: string, o: { yes?: boolean }) => run(() => c().deleteLlmKey(id, yes(o, 'Clients on this key stop answering.')))());

  const clients = tenant.command('clients').description('Client accounts, subaccounts and users');
  clients.command('list').action(run(() => c().clients()));
  clients.command('get <accountId>').action(async (id: string) => run(() => c().client(id))());
  clients.command('create <name>').option('--email <e>').option('--phone <p>').option('--description <d>')
    .action(async (name: string, o: { email?: string; phone?: string; description?: string }) => run(() => c().createClient({ name, ...o }))());
  clients.command('update <accountId>').requiredOption('--set <json>', '{ name?, email?, phone?, description? }')
    .action(async (id: string, o: { set: string }) => run(() => c().updateClient(id, json(o.set)))());
  clients.command('rm <accountId>').option('--yes', 'Confirm').action(async (id: string, o: { yes?: boolean }) => run(() => c().deleteClient(id, yes(o, 'The account, its subaccounts, users and agents are deleted.')))());
  clients.command('add-subaccount <accountId> <name>').action(async (id: string, name: string) => run(() => c().addSubaccount(id, { name }))());
  clients.command('update-subaccount <accountId> <subaccountId>').requiredOption('--set <json>', '{ name?, description? }')
    .action(async (a: string, s: string, o: { set: string }) => run(() => c().updateSubaccount(a, s, json(o.set)))());
  clients.command('rm-subaccount <accountId> <subaccountId>').option('--yes', 'Confirm')
    .action(async (a: string, s: string, o: { yes?: boolean }) => run(() => c().deleteSubaccount(a, s, yes(o, 'The subaccount, its users and agents are deleted.')))());
  clients.command('add-user <accountId> <subaccountId> <name> <email>').option('--password <p>', 'Without it the user gets the setup email')
    .action(async (a: string, s: string, name: string, email: string, o: { password?: string }) => run(() => c().addUser(a, s, { name, email, password: o.password }))());
  clients.command('update-user <accountId> <subaccountId> <userId>').requiredOption('--set <json>', '{ name?, email?, isActive?, password? }')
    .action(async (a: string, s: string, u: string, o: { set: string }) => run(() => c().updateUser(a, s, u, json(o.set)))());
  clients.command('rm-user <accountId> <subaccountId> <userId>').option('--yes', 'Confirm')
    .action(async (a: string, s: string, u: string, o: { yes?: boolean }) => run(() => c().deleteUser(a, s, u, yes(o, 'The user and their agents are deleted.')))());
  clients.command('model-defaults <accountId>').option('--set <json>', '{ provider?, models?, temperature?, maxTokens? }')
    .action(async (id: string, o: { set?: string }) => run(() => (o.set ? c().setModelDefaults(id, json(o.set)) : c().modelDefaults(id)))());

  tenant.command('log-export').option('--account <accountId>', 'One client account (default: the whole organisation)').option('--set <json>', '{ enabled, url, method POST|PUT, headers, format json|ndjson, includeContent, redactContent (privacy: hide content in exports), redactInDb (also in storage) }')
    .action(async (o: { account?: string; set?: string }) => run(() => (o.set ? c().setLogExport(json(o.set), o.account) : c().logExport(o.account)))());

  const branding = tenant.command('branding').description('White-label branding');
  branding.command('show').action(run(() => c().branding()));
  branding.command('set').option('--logo-light <file|url|dataUri>').option('--logo-dark <file|url|dataUri>').option('--primary <#hex>').option('--secondary <#hex>').option('--name <platformName>').option('--support-email <email>')
    .action(async (o: { logoLight?: string; logoDark?: string; primary?: string; secondary?: string; name?: string; supportEmail?: string }) => run(() => {
      const body: Json = {};
      for (const [flag, field] of [[o.logoLight, 'logoLight'], [o.logoDark, 'logoDark']] as const) {
        if (!flag) continue;
        const v = logoValue(flag);
        if (v.url) body[`${field}Url`] = v.url; else body[field] = v.value;
      }
      if (o.primary) body.primaryColor = o.primary;
      if (o.secondary) body.secondaryColor = o.secondary;
      if (o.name) body.platformName = o.name;
      if (o.supportEmail) body.supportEmail = o.supportEmail;
      return c().updateBranding(body);
    })());
  branding.command('reset').option('--yes', 'Confirm').action(async (o: { yes?: boolean }) => run(() => c().resetBranding(yes(o, 'Logos, colours and names are removed.')))());

  const domain = tenant.command('domain').description('Custom domain');
  domain.command('show').action(run(() => c().domain()));
  domain.command('set <domain>').action(async (d: string) => run(() => c().setDomain(d))());
  domain.command('verify').action(run(() => c().verifyDomain()));
  domain.command('rm').option('--yes', 'Confirm').action(async (o: { yes?: boolean }) => run(() => c().removeDomain(yes(o, 'Your pages leave the domain.')))());

  const admin = tenant.command('admin').description('Platform administration (role ADMIN)');
  admin.command('tenants').action(run(() => c().adminListTenants()));
  admin.command('create <name> <email>').requiredOption('--password <p>').option('--company <name>')
    .action(async (name: string, email: string, o: { password: string; company?: string }) => run(() => c().adminCreateTenant({ name, email, password: o.password, companyName: o.company }))());
  admin.command('suspend <tenantId>').option('--yes', 'Confirm').action(async (id: string, o: { yes?: boolean }) => run(() => c().adminSetTenantStatus(id, { isActive: false, ...yes(o, 'Its clients stop being able to buy.') }))());
  admin.command('activate <tenantId>').action(async (id: string) => run(() => c().adminSetTenantStatus(id, { isActive: true }))());
  admin.command('rm <tenantId>').option('--yes', 'Confirm').action(async (id: string, o: { yes?: boolean }) => run(() => c().adminDeleteTenant(id, yes(o, 'The tenant and its organisation are deleted.')))());
  admin.command('credits <tenantId> <add|subtract> <credits>').option('--reason <text>').option('--yes', 'Confirm')
    .action(async (id: string, op: string, credits: string, o: { reason?: string; yes?: boolean }) => run(() => {
      if (op !== 'add' && op !== 'subtract') throw new Error('Use add or subtract');
      return c().adminAdjustCredits(id, { operation: op, credits: Number(credits), reason: o.reason, ...yes(o, 'This moves money.') });
    })());
  admin.command('promote <userId>').option('--yes', 'Confirm').action(async (id: string, o: { yes?: boolean }) => run(() => c().adminPromoteUser(id, yes(o, 'The user becomes a tenant with its own organisation.')))());
}
