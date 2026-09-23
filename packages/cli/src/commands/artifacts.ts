import { Command } from 'commander';
import type { Artifact, ArtifactBlock } from '@mind2flow/agents-sdk';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

/**
 * Artifacts: reports, test runs and prompt changes as versioned documents.
 * The terminal shows them as text; the full view (charts, print to PDF) is
 * the app, or the public link from `m2f artifacts share`.
 */

const APP_URL = () => (process.env.M2F_APP_URL || 'https://app.mind2flow.io').replace(/\/$/, '');

function readPath(root: unknown, path?: string): unknown {
  let cur: unknown = root;
  for (const part of (path ?? '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function resolve(a: Artifact, src?: { ref: string; path?: string }): unknown {
  if (!src) return undefined;
  const sources = ((a.data ?? {}) as { sources?: Record<string, { ok: boolean; payload?: unknown }> }).sources ?? {};
  const s = sources[src.ref];
  return s && s.ok ? readPath(s.payload, src.path) : undefined;
}

/** A plain-text rendering, block by block. Charts show as their data. */
function printArtifact(a: Artifact): void {
  console.log(`${a.title}  [${a.kind} · v${a.version} · ${a.status}]\n`);
  for (const b of a.blocks as ArtifactBlock[]) {
    switch (b.type) {
      case 'heading': console.log(`${b.level === 1 ? '#' : '##'} ${b.text}`); break;
      case 'text': console.log(b.markdown); break;
      case 'callout': console.log(`[${b.tone}] ${b.text}`); break;
      case 'kpis': printTable([Object.fromEntries(b.items.map((i) => [i.label, String(i.value ?? resolve(a, i.source) ?? '—')]))], b.items.map((i) => i.label)); break;
      case 'table':
      case 'chart': {
        const rows = (b.rows ?? resolve(a, b.source)) as Array<Record<string, unknown>> | undefined;
        if (b.title) console.log(b.title);
        if (!Array.isArray(rows)) { console.log('  (data not available)'); break; }
        const cols = b.type === 'table' ? b.columns.map((c) => c.key) : [b.x, ...b.y];
        printTable(rows.slice(0, 40).map((r) => Object.fromEntries(cols.map((c) => [c, String(r[c] ?? '')]))), cols);
        break;
      }
      case 'test_results':
        printTable(b.cases.map((c) => ({ verdict: c.verdict, case: c.name.slice(0, 40), reason: (c.reason ?? '').slice(0, 70) })), ['verdict', 'case', 'reason']);
        break;
      case 'excerpt': for (const m of b.messages) console.log(`  ${m.role === 'customer' ? '>' : '<'} ${m.content}`); break;
      case 'diff': console.log(`${b.label ?? 'Changes'}: ${b.before.length} → ${b.after.length} characters (see --json or the app)`); break;
      case 'divider': console.log('―'.repeat(40)); break;
    }
    console.log('');
  }
}

export function registerArtifactCommands(program: Command): void {
  const art = program.command('artifacts').description('Reports, test runs and prompt changes (versioned, shareable)');

  art
    .command('list')
    .description('Latest version of each artifact')
    .option('--agent <agentId>', 'Only artifacts about this agent')
    .option('--kind <kind>', 'report | operation_report | test_run | prompt_change')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { agent?: string; kind?: string; json?: boolean }) => {
      try {
        const list = await getClient().artifacts.list({ agentId: opts.agent, kind: opts.kind });
        if (opts.json) return printJson(list);
        printTable(
          list.map((a) => ({ id: a.id, kind: a.kind, v: a.version, status: a.status, shared: a.shared ? 'yes' : '', title: a.title.slice(0, 50) })),
          ['id', 'kind', 'v', 'status', 'shared', 'title']
        );
      } catch (error) { fail(error); }
    });

  art
    .command('get <id>')
    .description('Show an artifact as text')
    .option('--json', 'Output raw JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        const a = await getClient().artifacts.get(id);
        if (opts.json) return printJson(a);
        printArtifact(a);
      } catch (error) { fail(error); }
    });

  art
    .command('report <agentId>')
    .description("An agent's operation report (default: last calendar month). Runs an LLM on your key")
    .option('--from <date>', 'Start, YYYY-MM-DD')
    .option('--to <date>', 'End, YYYY-MM-DD')
    .option('--lang <lang>', 'en | es', 'en')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { from?: string; to?: string; lang?: string; json?: boolean }) => {
      try {
        const a = await getClient().artifacts.create({
          template: 'operation_report', agentId, from: opts.from, to: opts.to, lang: opts.lang === 'es' ? 'es' : 'en',
        });
        if (opts.json) return printJson(a);
        printArtifact(a);
        console.log(`Artifact ${a.id}. Share it: m2f artifacts share ${a.id}`);
      } catch (error) { fail(error); }
    });

  art
    .command('refresh <id>')
    .description('Resolve the data again (new version)')
    .action(async (id: string) => {
      try {
        const a = await getClient().artifacts.refresh(id);
        console.log(`New version v${a.version}: ${a.id}`);
      } catch (error) { fail(error); }
    });

  art
    .command('share <id>')
    .description('Create a public link (customer details hidden by default)')
    .option('--show-customers', 'Do not hide customers’ names, phones and emails')
    .option('--days <n>', 'Expire after n days', (v) => parseInt(v, 10))
    .action(async (id: string, opts: { showCustomers?: boolean; days?: number }) => {
      try {
        const s = await getClient().artifacts.share(id, { redact: !opts.showCustomers, expiresInDays: opts.days ?? null });
        console.log(`${APP_URL()}/a/${s.token}`);
        console.log(`Customer details ${s.redact ? 'hidden' : 'SHOWN'}${s.expiresAt ? `, expires ${s.expiresAt}` : ''}.`);
      } catch (error) { fail(error); }
    });

  art
    .command('unshare <id>')
    .description('Revoke the public link')
    .action(async (id: string) => {
      try { await getClient().artifacts.unshare(id); console.log('Link revoked.'); } catch (error) { fail(error); }
    });

  art
    .command('archive <id>')
    .description('Archive every version and revoke its link')
    .action(async (id: string) => {
      try { await getClient().artifacts.archive(id); console.log('Archived.'); } catch (error) { fail(error); }
    });
}
