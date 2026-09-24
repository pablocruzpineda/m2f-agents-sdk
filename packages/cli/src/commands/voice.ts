import { Command, InvalidArgumentError } from 'commander';
import type { VoiceCall, VoiceLine } from '@mind2flow/agents-sdk';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

/**
 * Phone calls. Twilio and the agent's number are set up once in the console
 * (AI Agents → agent → Voice); everything after that works from here.
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
    .action(async (agentId: string, opts: { voice?: string; greeting?: string; number?: string }) => {
      try {
        if (!opts.voice && !opts.greeting && !opts.number) throw new Error('Pass --voice, --greeting and/or --number');
        const l = await getClient().voice.updateLine(agentId, { voice: opts.voice, greeting: opts.greeting, phoneNumber: opts.number });
        console.log(`Saved. ${l.phoneNumber} · ${l.voiceName ?? l.voice} · "${l.greeting}"`);
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
}
