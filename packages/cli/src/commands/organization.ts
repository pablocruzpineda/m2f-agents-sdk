import { Command } from 'commander';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

/**
 * Organization-wide reads. TENANT or ADMIN only — the role is checked against
 * the database, so a key with `tenant:read` on a regular account still gets a
 * 403 here.
 */
export function registerOrganizationCommands(program: Command): void {
  const org = program.command('org').description('Organization-wide reporting (TENANT/ADMIN only)');

  org
    .command('summary')
    .description('Aggregated figures across every agent in your organization')
    .option('--agent <agentId>', 'Narrow to one agent within the organization', 'all')
    .option('--from <date>', 'Start of the range, ISO 8601')
    .option('--to <date>', 'End of the range, ISO 8601')
    .option('--bucket <bucket>', 'Time series granularity: day | week | month', 'day')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { agent?: string; from?: string; to?: string; bucket?: string; json?: boolean }) => {
      try {
        const s = await getClient().organization.summary({
          agentId: opts.agent,
          from: opts.from,
          to: opts.to,
          bucket: opts.bucket as 'day' | 'week' | 'month' | undefined,
        });
        if (opts.json) return printJson(s);
        printTable(
          [{
            messages: s.totals.messages,
            incoming: s.totals.incoming,
            people: s.people.distinct,
            errors: s.totals.errors,
          }],
          ['messages', 'incoming', 'people', 'errors']
        );
        if (s.notes.length) {
          console.log('\nNotes:');
          for (const n of s.notes) console.log(`  - ${n}`);
        }
      } catch (error) {
        fail(error);
      }
    });

  org
    .command('activities')
    .description('Raw activity rows across the organization (contents included)')
    .option('--agent <agentId>', 'Narrow to one agent within the organization', 'all')
    .option('--limit <n>', 'Rows to return (default 50, max 100)', (v) => parseInt(v, 10))
    .option('--offset <n>', 'Rows to skip', (v) => parseInt(v, 10))
    .option('--json', 'Output raw JSON')
    .action(async (opts: { agent?: string; limit?: number; offset?: number; json?: boolean }) => {
      try {
        const r = await getClient().organization.activities({
          agentId: opts.agent,
          limit: opts.limit,
          offset: opts.offset,
        });
        if (opts.json) return printJson(r);
        printTable(
          r.activities.map((a) => ({
            at: String(a.timestamp ?? ''),
            type: String(a.messageType ?? ''),
            channel: String(a.channel ?? ''),
            content: String(a.content ?? '').slice(0, 60),
          })),
          ['at', 'type', 'channel', 'content']
        );
      } catch (error) {
        fail(error);
      }
    });
}
