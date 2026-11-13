import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { getClient } from '../config';
import { printTable, printJson, printAgentBreakdown, fail } from '../output';
import { parseList, parsePin } from './apps';

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
        printAgentBreakdown(s.agents);
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
                ? `${r.whatsapp.deviceName ?? ''} live=${r.whatsapp.liveState ?? `not checked (${r.whatsapp.liveCheck}${r.whatsapp.liveError ? `: ${r.whatsapp.liveError}` : ''})`} last inbound=${r.whatsapp.lastInboundAt ?? 'never'}`
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

  agents
    .command('actions <agentId>')
    .description("What the agent's app actions actually did: calls, errors and ids, per action")
    .option('--from <date>', 'Start of the range, ISO 8601')
    .option('--to <date>', 'End of the range, ISO 8601')
    .option('--tool <text>', 'Only actions whose name contains this text')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { from?: string; to?: string; tool?: string; json?: boolean }) => {
      try {
        const r = await getClient().agents.actions(agentId, { from: opts.from, to: opts.to, tool: opts.tool });
        if (opts.json) return printJson(r);
        console.log(`${r.agentName}: ${r.totals.calls} calls, ${r.totals.errors} errors, in ${r.totals.messagesWithActions} replies`);
        printTable(
          r.tools.map((t) => ({
            action: t.tool,
            server: t.server,
            calls: t.calls,
            errors: t.errors,
            'error %': t.errorRate,
            'top error': (t.topErrors[0]?.error ?? '').slice(0, 50),
          })),
          ['action', 'server', 'calls', 'errors', 'error %', 'top error']
        );
        printNotes(r.notes);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('test <agentId>')
    .description('Play test conversations against the agent, FOR REAL (its apps run). Cases from a JSON file')
    .requiredOption('--cases <file>', 'JSON file: [{ "name", "turns": ["..."], "expected" }] (max 15)')
    .option('--name <name>', 'Test identity name ({{name}} in turns)')
    .option('--email <email>', 'Test identity email ({{email}} in turns)')
    .option('--phone <phone>', 'Test identity phone ({{phone}} in turns)')
    .option('--wait', 'Wait for the run to finish and print the results')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { cases: string; name?: string; email?: string; phone?: string; wait?: boolean; json?: boolean }) => {
      try {
        const cases = JSON.parse(fs.readFileSync(opts.cases, 'utf8'));
        const client = getClient();
        const started = await client.agents.runTests(agentId, {
          cases: Array.isArray(cases) ? cases : cases.cases,
          identity: { name: opts.name, email: opts.email, phone: opts.phone },
        });
        if (!opts.wait) {
          if (opts.json) return printJson(started);
          console.log(`Test run started: ${started.cases} cases. Artifact ${started.artifactId}`);
          console.log(`Follow it with: m2f artifacts get ${started.artifactId}`);
          return;
        }
        let artifact = await client.artifacts.get(started.artifactId);
        while (artifact.status === 'running') {
          await new Promise((r) => setTimeout(r, 4000));
          artifact = await client.artifacts.get(started.artifactId);
        }
        if (opts.json) return printJson(artifact);
        const block = artifact.blocks.find((b) => b.type === 'test_results');
        const results = block && block.type === 'test_results' ? block.cases : [];
        printTable(
          results.map((c) => ({
            verdict: c.verdict,
            case: c.name.slice(0, 40),
            actions: (c.actions ?? []).map((a) => `${a.tool}${a.ok ? '' : ' ✗'}`).join(', ').slice(0, 50),
            reason: (c.reason ?? '').slice(0, 60),
          })),
          ['verdict', 'case', 'actions', 'reason']
        );
        console.log(`\nStatus: ${artifact.status}. Full results: m2f artifacts get ${artifact.id}`);
      } catch (error) {
        fail(error);
      }
    });

  // ── The agent's own documents ────────────────────────────

  const docs = agents.command('docs').description('Documents an agent holds as its own (its private knowledge graph)');

  docs
    .command('list <agentId>')
    .description('List the agent\'s documents and their indexing state')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { json?: boolean }) => {
      try {
        const { documents, usage } = await getClient().agents.listDocuments(agentId);
        if (opts.json) return printJson({ documents, usage });
        printTable(
          documents.map((d) => ({ id: d.id, name: d.name, status: d.ingestStatus, chars: d.charCount, error: d.ingestError ?? '' })),
          ['id', 'name', 'status', 'chars', 'error']
        );
        console.log(`${(usage.totalSize / 1024 / 1024).toFixed(1)} of ${(usage.maxSize / 1024 / 1024).toFixed(0)} MB, ${usage.totalChars} of ${usage.maxChars} characters`);
      } catch (error) {
        fail(error);
      }
    });

  docs
    .command('upload <agentId> <file>')
    .description('Give the agent a document of its own (PDF, DOCX, TXT, MD — 25 MB); it then reads its own graph')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, file: string, opts: { json?: boolean }) => {
      try {
        const result = await getClient().agents.uploadDocument(agentId, fs.readFileSync(file), path.basename(file));
        if (opts.json) return printJson(result);
        console.log(`Uploaded ${result.document.name} (${result.document.id}) — indexing in the background.`);
        console.log(`Check it with: m2f agents docs list ${agentId}`);
      } catch (error) {
        fail(error);
      }
    });

  docs
    .command('rm <agentId> <docId>')
    .description('Remove a document from the agent (and from its graph)')
    .option('--yes', 'Skip confirmation')
    .action(async (agentId: string, docId: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          console.error('This removes the document and what the agent learned from it. Re-run with --yes to confirm.');
          process.exit(1);
        }
        const result = await getClient().agents.deleteDocument(agentId, docId);
        console.log(`Document ${result.deleted} deleted.`);
        if (result.alsoRemoved.length) console.log(`Also removed (they shared its source): ${result.alsoRemoved.join(', ')}`);
      } catch (error) {
        fail(error);
      }
    });

  // ── The agent's apps ─────────────────────────────────────

  const agentApps = agents.command('apps').description('The apps an agent uses');

  agentApps
    .command('set <agentId>')
    .description('Set the agent\'s apps and build what they need to run (replaces the list)')
    .requiredOption('--toolkits <list>', 'Comma-separated app slugs, e.g. gmail,googlesheets')
    .option('--actions <list>', 'Comma-separated action names to enable (omit to keep the current selection)')
    .option('--pin <app=connectionId>', 'Use this connected account for an app (repeatable; universal agents)', (v: string, prev: string[]) => [...prev, v], [])
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { toolkits: string; actions?: string; pin: string[]; json?: boolean }) => {
      try {
        const result = await getClient().agents.setApps(agentId, {
          toolkits: parseList(opts.toolkits),
          ...(opts.actions !== undefined ? { selectedActions: parseList(opts.actions) } : {}),
          ...(opts.pin.length ? { pinned: opts.pin.map(parsePin) } : {}),
        });
        if (opts.json) return printJson(result);
        console.log(`Apps set: ${(result.apps.toolkits as string[] | undefined)?.join(', ') || '(none)'}`);
        for (const w of result.warnings) console.log(`Warning: ${w}`);
        const issues = (result.integrations as { issues?: string[] } | null)?.issues ?? [];
        for (const i of issues) console.log(`Issue: ${i}`);
        if (!result.warnings.length && !issues.length) console.log('Everything is wired.');
      } catch (error) {
        fail(error);
      }
    });

  // ── Shared link and website embed ────────────────────────

  const share = agents.command('share').description('The agent\'s public chat link');

  const printLink = (l: { url: string | null; config: { isActive: boolean; maxRequests: number | null; requestCount?: number; expiresAt?: string | null } | null; webCall: boolean }) => {
    if (!l.url) return console.log('No shared link. Create one with: m2f agents share create <agentId>');
    const c = l.config;
    console.log(l.url);
    if (c) console.log(`${c.isActive ? 'active' : 'PAUSED'} · ${c.requestCount ?? 0}${c.maxRequests ? ` of ${c.maxRequests}` : ''} messages${c.expiresAt ? ` · expires ${c.expiresAt}` : ''} · call button ${l.webCall ? 'on' : 'off'}`);
  };
  const limitOpts = (o: { max?: string; expires?: string }) => ({
    ...(o.max !== undefined ? { maxRequests: o.max === 'none' ? null : parseInt(o.max, 10) } : {}),
    ...(o.expires !== undefined ? { expiresAt: o.expires === 'none' ? null : o.expires } : {}),
  });

  share
    .command('get <agentId>')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { json?: boolean }) => {
      try {
        const l = await getClient().agents.getShareLink(agentId);
        if (opts.json) return printJson(l);
        printLink(l);
      } catch (error) {
        fail(error);
      }
    });

  share
    .command('create <agentId>')
    .description('Create the link (--regenerate replaces an existing one: the old URL stops working)')
    .option('--max <n>', 'Maximum messages (none = no limit)')
    .option('--expires <date>', 'ISO date when it stops working')
    .option('--regenerate', 'Replace the existing link')
    .action(async (agentId: string, opts: { max?: string; expires?: string; regenerate?: boolean }) => {
      try {
        printLink(await getClient().agents.createShareLink(agentId, { ...limitOpts(opts), ...(opts.regenerate ? { regenerate: true } : {}) }));
      } catch (error) {
        fail(error);
      }
    });

  share
    .command('update <agentId>')
    .description('Pause/resume or change limits (same URL)')
    .option('--pause', 'Stop answering through the link')
    .option('--resume', 'Answer again')
    .option('--max <n>', 'Maximum messages (none = no limit)')
    .option('--expires <date>', 'ISO date, or none')
    .action(async (agentId: string, opts: { pause?: boolean; resume?: boolean; max?: string; expires?: string }) => {
      try {
        if (opts.pause && opts.resume) throw new Error('Pass --pause or --resume, not both');
        printLink(await getClient().agents.updateShareLink(agentId, {
          ...(opts.pause ? { isActive: false } : opts.resume ? { isActive: true } : {}),
          ...limitOpts(opts),
        }));
      } catch (error) {
        fail(error);
      }
    });

  share
    .command('revoke <agentId>')
    .option('--yes', 'Skip confirmation')
    .action(async (agentId: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          console.error('The URL and every website embed using it stop working. Re-run with --yes to confirm.');
          process.exit(1);
        }
        const r = await getClient().agents.revokeShareLink(agentId);
        console.log(r.revoked ? 'Shared link revoked.' : 'The agent had no shared link.');
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('embed <agentId>')
    .description('Print the <script> tag that puts the agent\'s chat on a website')
    .option('--mode <mode>', 'bubble (default) | inline')
    .option('--lang <lang>', 'es (default) | en')
    .option('--theme <theme>', 'light (default) | dark')
    .option('--color <hex>', '#rrggbb (default: your brand colour)')
    .action(async (agentId: string, opts: { mode?: 'bubble' | 'inline'; lang?: 'es' | 'en'; theme?: 'light' | 'dark'; color?: string }) => {
      try {
        const e = await getClient().agents.embedCode(agentId, opts);
        console.log(e.snippet);
      } catch (error) {
        fail(error);
      }
    });

  // ── Prompt version history ───────────────────────────────

  agents
    .command('prompt-history <agentId>')
    .description('Every saved system prompt of the agent, newest first: when, who and from where')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, opts: { json?: boolean }) => {
      try {
        const list = await getClient().agents.promptVersions(agentId);
        if (opts.json) return printJson(list);
        printTable(
          list.versions.map((v) => ({
            version: `v${v.version}${v.current ? ' (current)' : ''}`,
            when: v.createdAt.replace('T', ' ').slice(0, 16),
            from: v.source ?? '',
            by: v.userName ?? '',
            chars: v.length,
            note: v.note ?? '',
          })),
          ['version', 'when', 'from', 'by', 'chars', 'note'],
        );
        if (list.total > list.versions.length) console.log(`(${list.total} versions; showing the newest ${list.versions.length})`);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('prompt-show <agentId> <version>')
    .description('Print one version of the agent\'s system prompt')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, version: string, opts: { json?: boolean }) => {
      try {
        const v = await getClient().agents.promptVersion(agentId, Number(version));
        if (opts.json) return printJson(v);
        console.log(v.systemPrompt);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('prompt-diff <agentId> <from> [to]')
    .description('What changed between two versions (to defaults to the current prompt)')
    .option('--full', 'Also print the unchanged lines')
    .option('--json', 'Output raw JSON')
    .action(async (agentId: string, from: string, to: string | undefined, opts: { full?: boolean; json?: boolean }) => {
      try {
        const d = await getClient().agents.comparePromptVersions(agentId, Number(from), to === undefined ? undefined : Number(to), { full: opts.full });
        if (opts.json) return printJson(d);
        console.log(`v${d.from} → ${d.to === 'current' ? 'current' : `v${d.to}`}: +${d.added} −${d.removed} lines`);
        for (const l of d.lines) console.log(`${l.type === 'added' ? '+' : l.type === 'removed' ? '-' : ' '} ${l.text}`);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('prompt-restore <agentId> <version>')
    .description('Put an old version back as the agent\'s prompt (saved as a new version)')
    .option('--yes', 'Required: it changes how the agent answers')
    .action(async (agentId: string, version: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) throw new Error('It changes how the agent answers. Add --yes to go ahead.');
        const r = await getClient().agents.restorePromptVersion(agentId, Number(version));
        console.log(r.changed ? `Restored v${r.restoredFrom} as v${r.version}.` : `v${r.restoredFrom} is already the agent's prompt: nothing changed.`);
      } catch (error) {
        fail(error);
      }
    });

  // ── Export / import ──────────────────────────────────────

  agents
    .command('export <agentId>')
    .description('Save the agent as JSON (prompt, models, tools, knowledge, skills, apps)')
    .option('--out <file>', 'File to write (default: print)')
    .action(async (agentId: string, opts: { out?: string }) => {
      try {
        const data = await getClient().agents.export(agentId);
        const text = JSON.stringify(data, null, 2);
        if (!opts.out) return console.log(text);
        fs.writeFileSync(opts.out, text + '\n');
        console.log(`Exported to ${opts.out}`);
      } catch (error) {
        fail(error);
      }
    });

  agents
    .command('import <file>')
    .description('Create an agent from an export file (created turned off unless --activate; app accounts and private documents are not carried over)')
    .option('--activate', 'Turn the agent on right after importing')
    .action(async (file: string, o: { activate?: boolean }) => {
      try {
        const exportData = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        const r = await getClient().agents.import(exportData, { activate: o.activate }) as { agent?: { id?: string; name?: string }; importedAsInactive: boolean; next: string };
        console.log(`Imported: ${r.agent?.name ?? ''} ${r.agent?.id ?? ''}`.trim());
        console.log(r.importedAsInactive ? `Turned off. ${r.next}` : 'Turned on.');
      } catch (error) {
        fail(error);
      }
    });
}
