import { Command, InvalidArgumentError } from 'commander';
import fs from 'fs';
import type { VoiceCall, VoiceLine } from '@mind2flow/agents-sdk';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

/**
 * Phone calls and everything the console's Voice section does: lines and their
 * settings, the account's Twilio, numbers and the managed line. Anything that
 * costs money or cannot be undone for free asks for --yes.
 */

const collectVar = (value: string, acc: Record<string, string>) => {
  const i = value.indexOf('=');
  if (i < 1) throw new InvalidArgumentError(`expected key=value, got "${value}"`);
  acc[value.slice(0, i)] = value.slice(i + 1);
  return acc;
};

const lineRow = (l: VoiceLine) => ({
  agent: l.agentName ?? l.agentId,
  number: l.phoneNumber,
  state: l.enabled ? 'answering' : 'paused',
  voice: l.voiceName ?? l.voice,
  transfer: l.transferEnabled ? 'on' : '',
});

const callRow = (c: VoiceCall) => ({
  callSid: c.callSid,
  when: c.startedAt.slice(0, 16).replace('T', ' '),
  dir: c.direction === 'inbound' ? 'in' : c.direction === 'outbound' ? 'out' : '',
  other: (c.direction === 'inbound' ? c.from : c.to) ?? '',
  secs: c.durationSec ?? '',
  credits: c.credits,
  outcome: c.status === 'processing' ? 'in progress' : c.outcome ?? '',
});

function printCall(c: VoiceCall): void {
  const who = c.direction === 'inbound' ? `from ${c.from}` : `to ${c.to}`;
  console.log(`${c.callSid}  ${c.direction ?? ''} ${who}  [${c.status === 'processing' ? 'in progress' : c.callStatus ?? c.status}]`);
  console.log(`Started ${c.startedAt} · ${c.durationSec ?? '?'} s (AI ${c.aiSeconds ?? '?'} s) · ${c.credits} credits${c.transferred ? ' · transferred to a person' : ''}`);
  if (c.outcome) console.log(`Outcome: ${c.outcome}`);
  if (c.summary) console.log(`\n${c.summary}`);
  if (c.transcript?.length) {
    console.log('');
    for (const t of c.transcript) {
      if (t.role === 'system') console.log(`  — ${t.content}`);
      else console.log(`  ${t.role === 'user' ? '>' : '<'} ${t.content}${t.interrupted ? ' [interrupted]' : ''}`);
    }
  }
}

export function registerVoiceCommands(program: Command): void {
  const voice = program.command('voice').description('Phone calls: place calls, manage lines, read calls');

  voice
    .command('lines')
    .description('Agents that answer phone calls')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const lines = await getClient().voice.lines();
        if (opts.json) return printJson(lines);
        printTable(lines.map((l) => ({ agentId: l.agentId, ...lineRow(l) })), ['agentId', 'agent', 'number', 'state', 'voice', 'transfer']);
      } catch (error) { fail(error); }
    });

  voice
    .command('line <agentId>')
    .description("Show an agent's phone line")
    .action(async (agentId: string) => {
      try { printJson(await getClient().voice.getLine(agentId)); } catch (error) { fail(error); }
    });

  voice
    .command('set <agentId>')
    .description('Change the voice or greeting, or move the line to another number')
    .option('--voice <voice>', 'Catalog id or name (see `m2f voice voices`), or an ElevenLabs voice id')
    .option('--greeting <text>', 'What the agent says when it picks up')
    .option('--number <e164>', 'A number already in your Twilio account')
    .option('--web-call <on|off>', 'Show or hide the call button on the agent\'s shared link')
    .action(async (agentId: string, opts: { voice?: string; greeting?: string; number?: string; webCall?: string }) => {
      try {
        if (!opts.voice && !opts.greeting && !opts.number && !opts.webCall) throw new Error('Pass --voice, --greeting, --number and/or --web-call');
        if (opts.webCall && opts.webCall !== 'on' && opts.webCall !== 'off') throw new Error('--web-call must be on or off');
        const l = await getClient().voice.updateLine(agentId, {
          voice: opts.voice, greeting: opts.greeting, phoneNumber: opts.number,
          ...(opts.webCall ? { webCall: { enabled: opts.webCall === 'on' } } : {}),
        });
        console.log(`Saved. ${l.phoneNumber} · ${l.voiceName ?? l.voice} · "${l.greeting}"${l.config ? ` · call button ${l.config.webCall.enabled ? 'on' : 'off'}` : ''}`);
      } catch (error) { fail(error); }
    });

  voice
    .command('pause <agentId>')
    .description('Stop answering calls (callers hear the number is not available)')
    .action(async (agentId: string) => {
      try { const l = await getClient().voice.pause(agentId); console.log(`Paused: ${l.phoneNumber}`); } catch (error) { fail(error); }
    });

  voice
    .command('resume <agentId>')
    .description('Answer calls again')
    .action(async (agentId: string) => {
      try { const l = await getClient().voice.resume(agentId); console.log(`Answering calls at ${l.phoneNumber}`); } catch (error) { fail(error); }
    });

  voice
    .command('call <agentId> <to>')
    .description('Have the agent call a number (E.164, e.g. +525512345678)')
    .option('--var <key=value>', 'Context for the agent; repeat for several', collectVar, {})
    .option('--wait', 'Wait until the call ends and print the summary and transcript')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, to: string, opts: { var: Record<string, string>; wait?: boolean; json?: boolean }) => {
      try {
        const m2f = getClient();
        const started = await m2f.voice.call({ agentId, to, variables: Object.keys(opts.var).length ? opts.var : undefined });
        if (!opts.wait) {
          if (opts.json) return printJson(started);
          console.log(`Calling ${started.to} from ${started.from} — ${started.callSid}`);
          console.log(`Follow it with: m2f voice show ${started.callSid}`);
          return;
        }
        if (!opts.json) console.log(`Calling ${started.to} from ${started.from} — ${started.callSid} (waiting for it to end…)`);
        const call = await m2f.voice.waitForCall(started.callSid);
        if (opts.json) return printJson(call);
        console.log('');
        printCall(call);
      } catch (error) { fail(error); }
    });

  voice
    .command('calls <agentId>')
    .description('Recent calls of an agent, newest first')
    .option('--limit <n>', 'Max calls (default 20)', (v) => parseInt(v, 10))
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { limit?: number; json?: boolean }) => {
      try {
        const calls = await getClient().voice.listCalls(agentId, { limit: opts.limit });
        if (opts.json) return printJson(calls);
        printTable(calls.map(callRow), ['callSid', 'when', 'dir', 'other', 'secs', 'credits', 'outcome']);
      } catch (error) { fail(error); }
    });

  voice
    .command('show <callSid>')
    .description('One call: outcome, summary and transcript')
    .option('--json', 'Output raw JSON')
    .action(async (callSid: string, opts: { json?: boolean }) => {
      try {
        const call = await getClient().voice.getCall(callSid);
        if (opts.json) return printJson(call);
        printCall(call);
      } catch (error) { fail(error); }
    });

  voice
    .command('voices')
    .description('The voice catalog')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const list = await getClient().voice.voices();
        if (opts.json) return printJson(list);
        printTable(
          list.map((v) => ({ id: v.id, name: v.name + (v.recommended ? ' ★' : ''), accent: v.accent, gender: v.gender, provider: v.provider, style: v.style.slice(0, 44) })),
          ['id', 'name', 'accent', 'gender', 'provider', 'style']
        );
      } catch (error) { fail(error); }
    });

  voice
    .command('pricing')
    .description('What a call costs in credits')
    .action(async () => {
      try {
        const p = await getClient().voice.pricing();
        console.log(`${p.creditsPerBlock} credit(s) every ${p.blockSeconds} s of AI talk time (≈ ${p.creditsPerMinute}/min).`);
        console.log(`${p.billedOn}. Twilio bills minutes and numbers to your own Twilio account.`);
      } catch (error) { fail(error); }
    });

  // ── Everything else the console's Voice section does ─────

  const yes = (o: { yes?: boolean }, what: string) => {
    if (!o.yes) {
      console.error(`${what} Re-run with --yes to confirm.`);
      process.exit(1);
    }
    return { confirm: true as const };
  };

  voice
    .command('configure <agentId>')
    .description('Change any line setting with a JSON patch (schedule, transfer, hours, after-call actions, language, model, SIP and its provider IPs…)')
    .requiredOption('--set <json>', 'JSON object, e.g. \'{"transfer":{"enabled":true,"numbers":["+525511112222"]}}\', or @file.json')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { set: string; json?: boolean }) => {
      try {
        const raw = opts.set.startsWith('@') ? fs.readFileSync(opts.set.slice(1), 'utf-8') : opts.set;
        const l = await getClient().voice.updateLine(agentId, JSON.parse(raw));
        if (opts.json) return printJson(l);
        console.log(`Saved. ${l.phoneNumber} · ${l.enabled ? 'answering' : 'paused'}`);
      } catch (error) { fail(error); }
    });

  voice
    .command('config <agentId>')
    .description('Every setting of a line (secrets shown only as set/not set)')
    .action(async (agentId: string) => {
      try { printJson(await getClient().voice.getLine(agentId)); } catch (error) { fail(error); }
    });

  voice
    .command('remove <agentId>')
    .description('Take the line off the agent (the number stays in your Twilio)')
    .option('--yes', 'Skip confirmation')
    .action(async (agentId: string, opts: { yes?: boolean }) => {
      try {
        yes(opts, 'The agent stops answering this number.');
        await getClient().voice.removeLine(agentId);
        console.log('Line removed.');
      } catch (error) { fail(error); }
    });

  voice
    .command('test-webhook <agentId>')
    .description('Send a sample after-call payload to the line\'s webhook')
    .action(async (agentId: string) => {
      try { printJson(await getClient().voice.testWebhook(agentId)); } catch (error) { fail(error); }
    });

  voice
    .command('test-email <agentId>')
    .description('Send a sample after-call email to the line\'s recipients')
    .action(async (agentId: string) => {
      try { printJson(await getClient().voice.testEmail(agentId)); } catch (error) { fail(error); }
    });

  voice
    .command('rotate-trigger <agentId>')
    .description('New trigger URL for CRMs to make the agent call; the old one stops working')
    .option('--yes', 'Confirm')
    .action(async (agentId: string, opts: { yes?: boolean }) => {
      try {
        const r = await getClient().voice.rotateTrigger(agentId, yes(opts, 'The current trigger URL stops working.'));
        console.log(r.triggerUrl);
        console.error('Keep it secret: it places calls by itself.');
      } catch (error) { fail(error); }
    });

  voice
    .command('sip <agentId>')
    .description('What the customer\'s PBX needs to forward calls to the agent')
    .action(async (agentId: string) => {
      try { printJson(await getClient().voice.sipCredentials(agentId)); } catch (error) { fail(error); }
    });

  voice
    .command('lookup-voice <id>')
    .description('Find an ElevenLabs library voice by id')
    .action(async (id: string) => {
      try { printJson(await getClient().voice.lookupVoice(id)); } catch (error) { fail(error); }
    });

  const twilio = voice.command('twilio').description('The account\'s own Twilio');

  twilio.command('show').action(async () => {
    try { printJson(await getClient().voice.account()); } catch (error) { fail(error); }
  });

  twilio
    .command('connect')
    .requiredOption('--sid <accountSid>', 'Account SID (AC…)')
    .option('--token <authToken>', 'Auth Token (or set TWILIO_AUTH_TOKEN)')
    .action(async (opts: { sid: string; token?: string }) => {
      try {
        const token = opts.token || process.env.TWILIO_AUTH_TOKEN;
        if (!token) throw new Error('Pass --token or set TWILIO_AUTH_TOKEN');
        const a = await getClient().voice.connectTwilio(opts.sid, token);
        console.log(`Twilio connected: ${a.accountSid} (${a.status})`);
      } catch (error) { fail(error); }
    });

  twilio
    .command('disconnect')
    .option('--yes', 'Confirm')
    .action(async (opts: { yes?: boolean }) => {
      try {
        await getClient().voice.disconnectTwilio(yes(opts, 'Every voice line of this account is removed (numbers stay in Twilio).'));
        console.log('Twilio disconnected.');
      } catch (error) { fail(error); }
    });

  voice
    .command('numbers')
    .description('Numbers in your Twilio, or --available to search numbers to buy')
    .option('--available', 'Search numbers to buy')
    .option('--country <iso>', 'With --available: MX, US, ES…')
    .option('--type <type>', 'local | mobile | tollFree')
    .option('--area-code <code>', 'Area code')
    .option('--contains <digits>', 'Digits the number contains')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { available?: boolean; country?: string; type?: 'local' | 'mobile' | 'tollFree'; areaCode?: string; contains?: string; json?: boolean }) => {
      try {
        const client = getClient();
        if (opts.available) {
          if (!opts.country) throw new Error('--country is required with --available');
          const list = await client.voice.searchNumbers({ country: opts.country, type: opts.type, areaCode: opts.areaCode, contains: opts.contains });
          if (opts.json) return printJson(list);
          return printTable(list.map((n) => ({ number: n.phoneNumber, locality: n.locality, region: n.region })), ['number', 'locality', 'region']);
        }
        const list = await client.voice.numbers();
        if (opts.json) return printJson(list);
        printTable(list.map((n) => ({ number: n.phoneNumber, name: n.friendlyName, agent: n.agentName ?? '' })), ['number', 'name', 'agent']);
      } catch (error) { fail(error); }
    });

  voice
    .command('buy <phoneNumber>')
    .description('Buy a number in your Twilio (charged monthly by Twilio)')
    .option('--agent <agentId>', 'Put this agent on it')
    .option('--yes', 'Confirm the purchase')
    .action(async (phoneNumber: string, opts: { agent?: string; yes?: boolean }) => {
      try {
        printJson(await getClient().voice.buyNumber({ phoneNumber, agentId: opts.agent, ...yes(opts, 'Twilio charges this number to your account every month.') }));
      } catch (error) { fail(error); }
    });

  const managed = voice.command('managed').description('The line Mind2Flow manages (no Twilio account needed)');

  managed.command('show').action(async () => {
    try { printJson(await getClient().voice.managedLine()); } catch (error) { fail(error); }
  });

  managed
    .command('subscribe <plan>')
    .description('basic | pro — charged monthly to the saved card')
    .option('--yes', 'Confirm the charge')
    .action(async (plan: 'basic' | 'pro', opts: { yes?: boolean }) => {
      try { printJson(await getClient().voice.subscribeManaged({ plan, ...yes(opts, `The "${plan}" plan is charged monthly to the saved card.`) })); } catch (error) { fail(error); }
    });

  managed
    .command('change <plan>')
    .option('--yes', 'Confirm')
    .action(async (plan: 'basic' | 'pro', opts: { yes?: boolean }) => {
      try { printJson(await getClient().voice.changeManagedPlan({ plan, ...yes(opts, 'The monthly charge changes (a bigger plan is charged now, prorated).') })); } catch (error) { fail(error); }
    });

  managed
    .command('cancel')
    .option('--yes', 'Confirm')
    .action(async (opts: { yes?: boolean }) => {
      try { printJson(await getClient().voice.cancelManaged(yes(opts, 'The managed line ends at the end of the period.'))); } catch (error) { fail(error); }
    });

  managed
    .command('leave')
    .description('Switch from the managed line to your own Twilio')
    .option('--yes', 'Confirm')
    .action(async (opts: { yes?: boolean }) => {
      try { printJson(await getClient().voice.switchManagedToOwn(yes(opts, 'The plan ends; its numbers stay with Mind2Flow.'))); } catch (error) { fail(error); }
    });

  managed.command('ready').description('Numbers ready for the managed line').action(async () => {
    try { printJson(await getClient().voice.readyNumbers()); } catch (error) { fail(error); }
  });

  managed
    .command('claim <phoneNumber>')
    .option('--agent <agentId>', 'Put this agent on it')
    .option('--yes', 'Confirm (extra numbers beyond the plan are charged monthly)')
    .action(async (phoneNumber: string, opts: { agent?: string; yes?: boolean }) => {
      try { printJson(await getClient().voice.claimReadyNumber({ phoneNumber, agentId: opts.agent, ...yes(opts, 'Extra numbers beyond the plan are charged monthly.') })); } catch (error) { fail(error); }
    });
}
