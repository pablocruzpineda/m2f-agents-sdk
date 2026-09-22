import { Command } from 'commander';
import fs from 'fs';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

export function registerAgentCommands(program: Command): void {
  const agents = program.command('agents').description('Manage and execute AI agents');

  agents
    .command('list')
    .description('List your agents')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const list = await getClient().agents.list();
        if (opts.json) return printJson(list);
        printTable(
          list.map((a) => ({ id: a.id, name: a.name, type: a.type, model: a.modelProvider ?? '' })),
          ['id', 'name', 'type', 'model']
        );
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('get <agentId>')
    .description('Show one agent')
    .action(async (agentId: string) => {
      try {
        printJson(await getClient().agents.get(agentId));
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('create')
    .description('Create an agent')
    .requiredOption('--name <name>', 'Agent name')
    .option('--description <text>', 'Description')
    .option('--system-prompt <text>', 'System prompt (or @file.txt to read from a file)')
    .option('--model-provider <provider>', 'LLM provider (e.g. openai, anthropic)')
    .option('--from <file>', 'Create from a JSON file with the full agent definition')
    .action(async (opts: {
      name: string;
      description?: string;
      systemPrompt?: string;
      modelProvider?: string;
      from?: string;
    }) => {
      try {
        let params: Record<string, unknown> = {};
        if (opts.from) {
          params = JSON.parse(fs.readFileSync(opts.from, 'utf-8'));
        }
        let systemPrompt = opts.systemPrompt;
        if (systemPrompt?.startsWith('@')) {
          systemPrompt = fs.readFileSync(systemPrompt.slice(1), 'utf-8');
        }
        const agent = await getClient().agents.create({
          ...params,
          name: opts.name,
          description: opts.description ?? (params.description as string | undefined),
          systemPrompt: systemPrompt ?? (params.systemPrompt as string | undefined),
          modelProvider: opts.modelProvider ?? (params.modelProvider as string | undefined),
        });
        console.log(`Agent created: ${agent.id}`);
        printJson(agent);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('delete <agentId>')
    .description('Delete an agent')
    .action(async (agentId: string) => {
      try {
        await getClient().agents.delete(agentId);
        console.log(`Agent ${agentId} deleted.`);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('run <agentId>')
    .description('Execute an agent and print the result')
    .option('--input <text>', 'Input text for the agent')
    .option('--input-file <file>', 'Read input (JSON or text) from a file')
    .option('--timeout <ms>', 'Max wait in milliseconds (default 120000)')
    .action(async (agentId: string, opts: { input?: string; inputFile?: string; timeout?: string }) => {
      try {
        let input: unknown = opts.input;
        if (opts.inputFile) {
          const raw = fs.readFileSync(opts.inputFile, 'utf-8');
          try {
            input = JSON.parse(raw);
          } catch {
            input = raw;
          }
        }
        if (input === undefined) {
          console.error('Provide --input <text> or --input-file <file>.');
          process.exit(1);
        }
        const timeout = opts.timeout ? parseInt(opts.timeout, 10) : undefined;
        console.error(`Running agent ${agentId}...`);
        const { executionId, result } = await getClient().agents.execute(agentId, { input, timeout });
        console.error(`Execution ${executionId} completed.`);
        printJson(result);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('activities <agentId>')
    .description('Show an agent\'s recent activity')
    .option('--limit <n>', 'Max items (default 20)')
    .action(async (agentId: string, opts: { limit?: string }) => {
      try {
        const { activities } = await getClient().agents.activities(agentId, {
          limit: opts.limit ? parseInt(opts.limit, 10) : 20,
        });
        printJson(activities);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('assign-device <agentId> <deviceId>')
    .description('Assign a device to an agent')
    .action(async (agentId: string, deviceId: string) => {
      try {
        await getClient().agents.assignDevice(agentId, deviceId);
        console.log(`Device ${deviceId} assigned to agent ${agentId}.`);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('unassign-device <agentId> <deviceId>')
    .description('Unassign a device from an agent')
    .action(async (agentId: string, deviceId: string) => {
      try {
        await getClient().agents.unassignDevice(agentId, deviceId);
        console.log(`Device ${deviceId} unassigned from agent ${agentId}.`);
      } catch (error) {
        fail(error);
      }
    });
  // ── Analysis and diagnostics ──────────────────────────────────────────────
  //
  // Every one of these prints `notes` when the API returns any. That is
  // deliberate: the caveats are what keep a number honest, and a CLI that hides
  // them is a CLI that helps you quote a wrong figure.

  const printNotes = (notes?: string[]) => {
    if (!notes?.length) return;
    console.log('\nNotes:');
    for (const n of notes) console.log(`  - ${n}`);
  };

  agents
    .command('summary <agentId>')
    .description('Aggregated operational figures for an agent (exact, from the database)')
    .option('--from <date>', 'Start of the range, ISO 8601 (default: 30 days back)')
    .option('--to <date>', 'End of the range, ISO 8601 (default: now)')
    .option('--bucket <bucket>', 'Time series granularity: day | week | month', 'day')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { from?: string; to?: string; bucket?: string; json?: boolean }) => {
      try {
        const s = await getClient().agents.summary(agentId, {
          from: opts.from,
          to: opts.to,
          bucket: opts.bucket as 'day' | 'week' | 'month' | undefined,
        });
        if (opts.json) return printJson(s);
        console.log(`Range: ${s.range.from} to ${s.range.to} (${s.range.days} days)\n`);
        printTable(
          [{
            messages: s.totals.messages,
            incoming: s.totals.incoming,
            outgoing: s.totals.outgoing,
            people: s.people.distinct,
            errors: s.totals.errors,
            'p50 reply': s.responseTimeMs ? `${s.responseTimeMs.p50}ms` : '-',
          }],
          ['messages', 'incoming', 'outgoing', 'people', 'errors', 'p50 reply']
        );
        console.log(`\nPer ${s.bucket}:`);
        printTable(
          s.series.map((b) => ({
            [s.bucket]: b.bucket,
            incoming: b.incoming,
            outgoing: b.outgoing,
            people: b.people,
            'p50 reply': b.responseMs ? `${b.responseMs.p50}ms` : '-',
          })),
          [s.bucket, 'incoming', 'outgoing', 'people', 'p50 reply']
        );
        printNotes(s.notes);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('conversations <agentId>')
    .description('Read whole conversations, paged by conversation')
    .option('--from <date>', 'Start of the range, ISO 8601')
    .option('--to <date>', 'End of the range, ISO 8601')
    .option('--limit <n>', 'Conversations per page (default 10, max 50)', (v) => parseInt(v, 10))
    .option('--offset <n>', 'Conversations to skip', (v) => parseInt(v, 10))
    .option('--session-ids <ids>', 'Comma-separated session ids to read instead of the newest')
    .option('--contact <nameOrPhone>', 'A specific customer, by name or phone')
    .option('--full', 'Print every message, not just a summary line per thread')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { from?: string; to?: string; limit?: number; offset?: number; sessionIds?: string; contact?: string; full?: boolean; json?: boolean }) => {
      try {
        const r = await getClient().agents.conversations(agentId, {
          from: opts.from,
          to: opts.to,
          limit: opts.limit,
          offset: opts.offset,
          sessionIds: opts.sessionIds ? opts.sessionIds.split(',').map((x) => x.trim()) : undefined,
          contact: opts.contact,
        });
        if (opts.json) return printJson(r);
        console.log(`${r.conversations.length} of ${r.pagination.total} conversations\n`);
        if (opts.full) {
          for (const c of r.conversations) {
            console.log(`── ${c.contact} · ${c.messageCount} messages${c.truncated ? ` (${c.omittedMessages} omitted from the middle)` : ''}`);
            for (const m of c.messages) console.log(`   ${m.role === 'customer' ? '>' : '<'} ${m.content}`);
            console.log('');
          }
        } else {
          printTable(
            r.conversations.map((c) => ({
              contact: c.contact,
              messages: c.messageCount,
              last: c.lastAt,
              cut: c.truncated ? `${c.omittedMessages} omitted` : '',
            })),
            ['contact', 'messages', 'last', 'cut']
          );
        }
        printNotes(r.notes);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('search <agentId> <terms>')
    .description('Find which conversations mention given terms (comma-separated)')
    .option('--from <date>', 'Start of the range, ISO 8601')
    .option('--to <date>', 'End of the range, ISO 8601')
    .option('--limit <n>', 'Maximum conversations listed', (v) => parseInt(v, 10))
    .option('--role <role>', 'Whose messages to search: customer (default) | agent | any', 'customer')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, terms: string, opts: { from?: string; to?: string; limit?: number; role?: string; json?: boolean }) => {
      try {
        const r = await getClient().agents.searchConversations(agentId, {
          terms: terms.split(',').map((t) => t.trim()).filter(Boolean),
          from: opts.from,
          to: opts.to,
          limit: opts.limit,
          role: opts.role as 'customer' | 'agent' | 'any' | undefined,
        });
        if (opts.json) return printJson(r);
        printTable(
          r.terms.map((t) => ({ term: t.term, conversations: t.conversations, messages: t.messages })),
          ['term', 'conversations', 'messages']
        );
        console.log(`\n${r.matches.length} distinct conversations matched at least one term (searched: ${r.role} messages).`);
        printNotes(r.notes);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('analyze <agentId> <question>')
    .description('Ask a question of an agent\'s conversations (COSTS TOKENS on your own LLM key)')
    .requiredOption('--field <name:description...>', 'A value to extract, as name:description. Repeatable, up to 8.')
    .option('--from <date>', 'Start of the range, ISO 8601')
    .option('--to <date>', 'End of the range, ISO 8601')
    .option('--max <n>', 'Ceiling on conversations read (default 40, max 200)', (v) => parseInt(v, 10))
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, question: string, opts: { field: string[]; from?: string; to?: string; max?: number; json?: boolean }) => {
      try {
        const fields = opts.field.map((f) => {
          const i = f.indexOf(':');
          if (i < 1) throw new Error(`--field must be name:description, got "${f}"`);
          return { name: f.slice(0, i).trim(), description: f.slice(i + 1).trim() };
        });
        const r = await getClient().agents.analyzeConversations(agentId, {
          question, fields, from: opts.from, to: opts.to, maxConversations: opts.max,
        });
        if (opts.json) return printJson(r);
        console.log(`Analysed ${r.analyzed} of ${r.totalInRange} conversations.\n`);
        for (const field of r.fields) {
          console.log(`${field}:`);
          printTable(
            (r.aggregates[field] ?? []).map((a) => ({ value: a.value, conversations: a.conversations })),
            ['value', 'conversations']
          );
          console.log('');
        }
        printNotes(r.notes);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('integrations <agentId>')
    .description('Connected apps, and whether the wiring actually works')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { json?: boolean }) => {
      try {
        const r = await getClient().agents.integrations(agentId);
        if (opts.json) return printJson(r);
        printTable(
          r.perToolkit.map((t) => ({
            app: t.toolkit,
            status: t.connectionStatus ?? 'not checked',
            ok: t.ok === null ? '?' : t.ok ? 'yes' : 'NO',
          })),
          ['app', 'status', 'ok']
        );
        console.log(`\n${r.selectedActions} actions selected.`);
        if (r.issues.length) {
          console.log('\nIssues:');
          for (const i of r.issues) console.log(`  - ${i}`);
        }
        printNotes(r.notes);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('channels <agentId>')
    .description('How the agent can be reached, and whether each way works')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { json?: boolean }) => {
      try {
        const r = await getClient().agents.channels(agentId);
        if (opts.json) return printJson(r);
        printTable(
          [
            { channel: 'status', detail: r.status },
            { channel: 'input', detail: `${r.input.type ?? '-'}${r.input.endpointUrl ? ' (endpoint set)' : ''}` },
            { channel: 'output', detail: r.output.type ?? '-' },
            {
              channel: 'whatsapp',
              detail: r.whatsapp.assigned
                ? `${r.whatsapp.deviceName ?? ''} live=${r.whatsapp.liveState ?? `not checked (${r.whatsapp.liveCheck})`} last inbound=${r.whatsapp.lastInboundAt ?? 'never'}`
                : 'not assigned',
            },
            {
              channel: 'shared link',
              detail: r.sharedLink.exists
                ? `active=${r.sharedLink.isActive} expired=${r.sharedLink.expired}`
                : 'none',
            },
          ],
          ['channel', 'detail']
        );
        if (r.issues.length) {
          console.log('\nIssues:');
          for (const i of r.issues) console.log(`  - ${i}`);
        }
        printNotes(r.notes);
      } catch (error) {
        fail(error);
      }
    });
}
