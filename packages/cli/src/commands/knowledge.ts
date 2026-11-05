import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import type { KnowledgeResource, KnowledgeSchemaConfirmation } from '@mind2flow/agents-sdk';
import { getClient } from '../config';
import { applyMappingEdits } from '../mapping';
import { printTable, printJson, fail } from '../output';

export function registerKnowledgeCommands(program: Command): void {
  const knowledge = program
    .command('knowledge')
    .description('Query and manage your GraphOS knowledge graph (the shared one, or with --agent an agent\'s own graph)')
    .option('--agent <agentId>', 'Work in one of your agents\' own graph instead of the shared one (an upload there gives the agent its private graph)');
  /** The knowledge client, inside the agent's own graph when --agent is given. */
  /** "m2f knowledge" plus --agent when given, for the hints this command prints. */
  const cmd = () => {
    const agent = (knowledge.opts() as { agent?: string }).agent;
    return agent ? `m2f knowledge --agent ${agent}` : 'm2f knowledge';
  };
  const kb = (): KnowledgeResource => {
    const agent = (knowledge.opts() as { agent?: string }).agent;
    return agent ? getClient().knowledge.forAgent(agent) : getClient().knowledge;
  };

  knowledge
    .command('query <question>')
    .description('Ask the knowledge graph a question — returns facts with temporal validity')
    .option('-n, --num-results <n>', 'Max facts to return (default 10)')
    .option('--json', 'Output raw JSON')
    .action(async (question: string, opts: { numResults?: string; json?: boolean }) => {
      try {
        const facts = await kb().query(question, {
          numResults: opts.numResults ? parseInt(opts.numResults, 10) : undefined,
        });
        if (opts.json) return printJson(facts);
        if (facts.length === 0) return console.log('No matching knowledge found.');
        for (const f of facts) {
          const now = Date.now();
          const invalid = f.invalid_at ? new Date(f.invalid_at).getTime() : null;
          const validity = invalid === null
            ? 'current'
            : invalid > now
              ? `until ${new Date(invalid).toLocaleDateString()}`
              : 'superseded';
          console.log(`- ${f.fact}  [${validity}]`);
        }
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('graph')
    .description('Show the entity graph (top connected entities, or search with --q)')
    .option('--q <name>', 'Search entities by name')
    .option('--limit <n>', 'Max entities (default 75)')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { q?: string; limit?: string; json?: boolean }) => {
      try {
        const graph = await kb().getGraph({
          q: opts.q,
          limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        });
        if (opts.json) return printJson(graph);
        printTable(
          graph.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            type: n.type ?? '',
            connections: n.degree,
          })),
          ['id', 'name', 'type', 'connections']
        );
        console.log(`${graph.nodes.length} entities, ${graph.edges.length} connections`);
      } catch (error) {
        fail(error);
      }
    });

  // ── Sources ─────────────────────────────────────────────

  const sources = knowledge.command('sources').description('Manage knowledge data sources');

  sources
    .command('list')
    .description('List data sources')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const list = await kb().listSources();
        if (opts.json) return printJson(list);
        printTable(
          list.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            status: s.status,
            documents: s.document_count,
          })),
          ['id', 'name', 'type', 'status', 'documents']
        );
      } catch (error) {
        fail(error);
      }
    });

  sources
    .command('add <name>')
    .description('Register a data source')
    .requiredOption('--type <type>', 'file | rest | sql | composio')
    .option('--config <json>', 'Type-specific config as JSON (credentials are encrypted at rest)')
    .action(async (name: string, opts: { type: string; config?: string }) => {
      try {
        const config = opts.config ? JSON.parse(opts.config) : {};
        const source = await kb().createSource({
          type: opts.type as 'file' | 'rest' | 'sql' | 'composio',
          name,
          config,
        });
        console.log(`Source created: ${source.id}`);
      } catch (error) {
        fail(error);
      }
    });

  sources
    .command('sync <sourceId>')
    .description('Start an ingestion sync (unchanged documents are skipped)')
    .action(async (sourceId: string) => {
      try {
        const job = await kb().syncSource(sourceId);
        console.log(`Sync started: job ${job.id} (${job.status})`);
        console.log(`Follow it with: ${cmd()} jobs --json`);
      } catch (error) {
        fail(error);
      }
    });

  sources
    .command('rm <sourceId>')
    .description('Delete a source — PURGES its knowledge from the graph')
    .option('--yes', 'Skip confirmation')
    .action(async (sourceId: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          console.error('This purges the source\'s episodes and derived knowledge from the graph.');
          console.error('Re-run with --yes to confirm.');
          process.exit(1);
        }
        await kb().deleteSource(sourceId);
        console.log(`Source ${sourceId} deleted.`);
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('upload <sourceId> <file>')
    .description('Upload a document to a file source and start ingestion (spreadsheets wait for `m2f knowledge confirm`)')
    .option('--no-sync', 'Upload only; do not start a sync')
    .option('--json', 'Output raw JSON')
    .action(async (sourceId: string, file: string, opts: { sync: boolean; json?: boolean }) => {
      try {
        const client = getClient();
        const doc = await kb().uploadDocument(sourceId, fs.readFileSync(file), path.basename(file));
        if (opts.json) return printJson(doc);
        console.log(`Uploaded ${doc.filename} (${doc.status})`);
        if (doc.status === 'needs_mapping') {
          console.log('This spreadsheet is held until its columns are confirmed. Review and confirm them with:');
          console.log(`  ${cmd()} schemas ${sourceId} --file "${doc.filename}"`);
          console.log(`  ${cmd()} confirm ${sourceId} "${doc.filename}" --sync`);
          return;
        }
        if (doc.status === 'ingested') return console.log('This exact content is already in the graph — nothing to ingest.');
        if (!opts.sync) return console.log(`Start ingestion with: ${cmd()} sources sync ${sourceId}`);
        const job = await kb().syncSource(sourceId);
        console.log(`Ingestion job ${job.id} (${job.status}) — follow it with: ${cmd()} job ${job.id} --wait`);
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('documents <sourceId>')
    .description('List a source\'s documents and their status')
    .option('--json', 'Output raw JSON')
    .action(async (sourceId: string, opts: { json?: boolean }) => {
      try {
        const docs = await kb().listDocuments(sourceId);
        if (opts.json) return printJson(docs);
        printTable(
          docs.map((d) => ({
            id: d.id,
            filename: d.filename,
            status: d.status,
            records: d.record_count ?? '',
            episodes: d.episode_count,
            error: d.error ?? '',
          })),
          ['id', 'filename', 'status', 'records', 'episodes', 'error']
        );
      } catch (error) {
        fail(error);
      }
    });

  // ── Spreadsheet column mappings ──────────────────────────

  knowledge
    .command('schemas <sourceId>')
    .description('Show the column mappings of a source\'s spreadsheets (what each column means)')
    .option('--file <filename>', 'Only this file')
    .option('--json', 'Output raw JSON')
    .action(async (sourceId: string, opts: { file?: string; json?: boolean }) => {
      try {
        const all = await kb().listSchemas(sourceId);
        const schemas = opts.file ? all.filter((s) => s.filename === opts.file) : all;
        if (opts.file && !schemas.length) {
          console.error(`No column mapping for "${opts.file}" in this source.`);
          process.exit(1);
        }
        if (opts.json) return printJson(opts.file ? schemas[0] : schemas);
        if (!schemas.length) return console.log('No spreadsheets in this source.');
        for (const schema of schemas) {
          const state = schema.confirmed ? 'confirmed' : `NEEDS CONFIRMATION${schema.reason ? ` (${schema.reason})` : ''}`;
          console.log(`\n${schema.filename} — ${state}`);
          console.log(`  rows: ${schema.row_count ?? '?'}   entity type: ${schema.entity_type}   name column: ${schema.name_field ?? '(none proposed)'}`);
          if (schema.duplicate_count) {
            console.log(`  ${schema.duplicate_count} rows share a name (${schema.conflicting_count ?? 0} with different values) — they collapse into one item`);
          }
          printTable(
            schema.columns.map((c) => ({
              header: c.header,
              field: c.field,
              type: c.type ?? 'text',
              include: c.include === false ? 'no' : 'yes',
              filled: c.filled == null ? '' : `${Math.round(c.filled * 100)}%`,
              invalid: c.invalid_count || '',
              samples: (c.samples ?? []).slice(0, 3).join(' | '),
            })),
            ['header', 'field', 'type', 'include', 'filled', 'invalid', 'samples']
          );
        }
      } catch (error) {
        fail(error);
      }
    });

  const collect = (value: string, previous: string[]) => [...previous, value];

  knowledge
    .command('confirm <sourceId> <filename>')
    .description('Confirm a spreadsheet\'s column mapping (the proposal, plus any edits) and release it for ingestion')
    .option('--name-field <column>', 'Column that names each row')
    .option('--entity-type <type>', 'What each row is: Product, Property, Service…')
    .option('--type <column=type>', 'Set a column type: text | number | date (repeatable)', collect, [])
    .option('--rename <column=field>', 'Rename a column\'s field (repeatable)', collect, [])
    .option('--exclude <column>', 'Leave a column out (repeatable)', collect, [])
    .option('--include <column>', 'Bring a column back in (repeatable)', collect, [])
    .option('--mapping <file>', 'Send this JSON body as-is ({columns, name_field, entity_type}) instead of editing the proposal')
    .option('--sync', 'Start ingestion right after confirming')
    .option('--json', 'Output raw JSON')
    .action(async (sourceId: string, filename: string, opts: {
      nameField?: string; entityType?: string; type: string[]; rename: string[]; exclude: string[]; include: string[];
      mapping?: string; sync?: boolean; json?: boolean;
    }) => {
      try {
        const client = getClient();
        let body: KnowledgeSchemaConfirmation;
        if (opts.mapping) {
          body = JSON.parse(fs.readFileSync(opts.mapping, 'utf-8')) as KnowledgeSchemaConfirmation;
        } else {
          const proposal = await kb().getSchema(sourceId, filename);
          if (!proposal) {
            console.error(`No column mapping for "${filename}" in this source. See: ${cmd()} schemas ${sourceId}`);
            process.exit(1);
          }
          body = applyMappingEdits(proposal, {
            nameField: opts.nameField, entityType: opts.entityType,
            types: opts.type, renames: opts.rename, exclude: opts.exclude, include: opts.include,
          });
        }
        const confirmed = await kb().confirmSchema(sourceId, filename, body);
        if (opts.json && !opts.sync) return printJson(confirmed);
        console.log(`Mapping confirmed for ${filename}: name column "${confirmed.name_field}", ${confirmed.columns.filter((c) => c.include !== false).length} columns, entity type ${confirmed.entity_type}.`);
        if (!opts.sync) return console.log(`Start ingestion with: ${cmd()} sources sync ${sourceId}`);
        const job = await kb().syncSource(sourceId);
        console.log(`Ingestion job ${job.id} (${job.status}) — follow it with: ${cmd()} job ${job.id} --wait`);
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('reingest <sourceId> <filename>')
    .description('Process one document again from scratch (bills extraction again), then sync')
    .option('--yes', 'Skip confirmation')
    .action(async (sourceId: string, filename: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          console.error('Re-ingesting discards what this document produced and extracts it again (billed to your LLM key).');
          console.error('Re-run with --yes to confirm.');
          process.exit(1);
        }
        const client = getClient();
        const released = await kb().reingestDocument(sourceId, filename);
        const job = await kb().syncSource(sourceId);
        console.log(`Released ${released.reingesting} document(s); ingestion job ${job.id} (${job.status}).`);
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('job <jobId>')
    .description('Show one ingestion job')
    .option('--wait', 'Wait until it completes or fails')
    .option('--timeout <seconds>', 'Give up waiting after this long (default 600)')
    .option('--json', 'Output raw JSON')
    .action(async (jobId: string, opts: { wait?: boolean; timeout?: string; json?: boolean }) => {
      try {
        const client = getClient();
        const job = opts.wait
          ? await kb().waitForJob(jobId, {
            timeoutMs: opts.timeout ? parseInt(opts.timeout, 10) * 1000 : undefined,
            onPoll: (j) => { if (!opts.json) process.stderr.write(`  ${j.status}…\n`); },
          })
          : await kb().getJob(jobId);
        if (opts.json) return printJson(job);
        const st = job.stats ?? {};
        console.log(`Job ${job.id}: ${job.status} — ${st.ingested ?? 0} ingested, ${st.skipped ?? 0} skipped, ${st.failed ?? 0} failed${job.error ? `\nError: ${job.error}` : ''}`);
        if (job.status === 'failed') process.exitCode = 1;
      } catch (error) {
        fail(error);
      }
    });

  // ── Exact values and records ─────────────────────────────

  knowledge
    .command('values <names...>')
    .description('Exact stored values for item names (prices, stock…) — what agents quote')
    .option('--json', 'Output raw JSON')
    .action(async (names: string[], opts: { json?: boolean }) => {
      try {
        const results = await kb().exactValues(names);
        if (opts.json) return printJson(results);
        for (const r of results) {
          if (r.found) {
            const values = Object.entries(r.values ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(', ');
            console.log(`- "${r.asked}" → ${r.name}${values ? ` — ${values}` : ''}`);
          } else if (r.candidates?.length) {
            console.log(`- "${r.asked}" → several items match: ${r.candidates.join('; ')}`);
          } else {
            console.log(`- "${r.asked}" → not found`);
          }
        }
      } catch (error) {
        fail(error);
      }
    });

  const records = knowledge.command('records').description('Spreadsheet rows stored in the graph');

  const parseValues = (raw?: string): Record<string, unknown> => {
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('--values must be a JSON object');
    return parsed as Record<string, unknown>;
  };

  records
    .command('list')
    .description('List rows as a table')
    .option('--label <type>', 'Entity type, e.g. Product')
    .option('--q <name>', 'Search by name')
    .option('--limit <n>', 'Rows (default 50, max 200)')
    .option('--offset <n>', 'Rows to skip')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { label?: string; q?: string; limit?: string; offset?: string; json?: boolean }) => {
      try {
        const page = await kb().listRecords({
          label: opts.label, q: opts.q,
          limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
          offset: opts.offset ? parseInt(opts.offset, 10) : undefined,
        });
        if (opts.json) return printJson(page);
        printTable(page.rows.map((r) => ({ uuid: r.uuid, name: r.name, ...r.values })), ['uuid', 'name', ...page.columns]);
        console.log(`${page.rows.length} of ${page.total} rows`);
      } catch (error) {
        fail(error);
      }
    });

  records
    .command('add <name>')
    .description('Add one row by hand')
    .option('--values <json>', 'Column values as JSON, e.g. \'{"precio": 120}\'')
    .action(async (name: string, opts: { values?: string }) => {
      try {
        const row = await kb().createRecord({ name, values: parseValues(opts.values) });
        console.log(`Row created: ${row.uuid}`);
      } catch (error) {
        fail(error);
      }
    });

  records
    .command('set <uuid>')
    .description('Correct one row (partial: only the keys given change; null clears a cell)')
    .option('--values <json>', 'Column values as JSON')
    .option('--name <name>', 'New name')
    .action(async (uuid: string, opts: { values?: string; name?: string }) => {
      try {
        const row = await kb().updateRecord(uuid, { name: opts.name, values: parseValues(opts.values) });
        console.log(`Row ${row.uuid} updated.`);
      } catch (error) {
        fail(error);
      }
    });

  records
    .command('rm <uuid>')
    .description('Remove one row (re-ingesting its source brings it back)')
    .action(async (uuid: string) => {
      try {
        await kb().deleteRecord(uuid);
        console.log(`Row ${uuid} deleted.`);
      } catch (error) {
        fail(error);
      }
    });

  // ── Jobs / manual / facts / usage ───────────────────────

  knowledge
    .command('jobs')
    .description('List ingestion jobs')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const jobs = await kb().listJobs();
        if (opts.json) return printJson(jobs);
        printTable(
          jobs.map((j) => ({
            id: j.id,
            status: j.status,
            ingested: j.stats.ingested ?? 0,
            skipped: j.stats.skipped ?? 0,
            failed: j.stats.failed ?? 0,
            created: j.created_at,
          })),
          ['id', 'status', 'ingested', 'skipped', 'failed', 'created']
        );
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('add-fact <statement>')
    .description('Declare a business fact (e.g. a promo), optionally with a validity window')
    .option('--from <date>', 'Valid from (ISO date)')
    .option('--until <date>', 'Valid until (ISO date) — expires automatically')
    .action(async (statement: string, opts: { from?: string; until?: string }) => {
      try {
        const entry = await kb().addManual({
          statement,
          valid_from: opts.from ? new Date(opts.from).toISOString() : undefined,
          valid_until: opts.until ? new Date(opts.until).toISOString() : undefined,
        });
        console.log(`Fact added: ${entry.id} (${entry.status})`);
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('invalidate <factUuid>')
    .description('Mark a fact as incorrect — agents stop using it (history preserved)')
    .action(async (factUuid: string) => {
      try {
        await kb().invalidateFact(factUuid);
        console.log('Fact marked as incorrect.');
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('usage')
    .description('Show usage metrics and the monthly ingestion limit')
    .option('--json', 'Output raw JSON')
    .option('--set-limit <n>', 'Set the monthly episode cap (cost control)')
    .option('--clear-limit', 'Remove the monthly episode cap')
    .action(async (opts: { json?: boolean; setLimit?: string; clearLimit?: boolean }) => {
      try {
        const client = getClient();
        if (opts.setLimit !== undefined) {
          await client.knowledge.setMonthlyLimit(parseInt(opts.setLimit, 10));
          console.log(`Monthly episode limit set to ${opts.setLimit}.`);
          return;
        }
        if (opts.clearLimit) {
          await client.knowledge.setMonthlyLimit(null);
          console.log('Monthly episode limit cleared.');
          return;
        }
        const usage = await client.knowledge.getUsage();
        if (opts.json) return printJson(usage);
        const t = usage.totals;
        console.log(`Sources: ${t.sources}   Documents: ${t.documents}   Manual facts: ${t.manual_entries}`);
        console.log(`Episodes (total): ${t.episodes}   Storage: ${(t.storage_bytes / 1024 / 1024).toFixed(1)} MB`);
        console.log(`This month (${usage.this_month.period}): ${usage.this_month.episodes} episodes ingested, ${usage.this_month.queries} queries`);
        const limit = usage.limits.monthly_episode_limit;
        console.log(limit === null
          ? 'Monthly limit: none (set one with --set-limit)'
          : `Monthly limit: ${limit} (${usage.limits.remaining_this_month} remaining)`);
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('namespaces')
    .description('Agents that have a graph of their own besides the shared one')
    .action(async () => {
      try { printJson(await getClient().knowledge.listNamespaces()); } catch (error) { fail(error); }
    });

  knowledge
    .command('summary')
    .description('How much is in the graph, by type')
    .option('--agent <agentId>', 'One of your agents with its own graph')
    .action(async (o: { agent?: string }) => {
      try { printJson(await getClient().knowledge.graphSummary({ agentId: o.agent ?? (knowledge.opts() as { agent?: string }).agent })); } catch (error) { fail(error); }
    });
  knowledge
    .command('entity <uuid>')
    .description('One entity with its facts over time')
    .action(async (uuid: string) => {
      try { printJson(await kb().getEntity(uuid)); } catch (error) { fail(error); }
    });

  knowledge
    .command('source <sourceId>')
    .description('One data source')
    .action(async (sourceId: string) => {
      try { printJson(await kb().getSource(sourceId)); } catch (error) { fail(error); }
    });

  knowledge
    .command('facts')
    .description('Facts declared by hand (add-fact), with their ids')
    .action(async () => {
      try { printJson(await kb().listManual()); } catch (error) { fail(error); }
    });

  knowledge
    .command('rm-fact <id>')
    .description('Delete a fact declared by hand')
    .action(async (id: string) => {
      try { await kb().deleteManual(id); console.log(`Deleted fact ${id}`); } catch (error) { fail(error); }
    });

  knowledge
    .command('key-status')
    .description('Whether the graph can learn: the account needs an OpenAI key')
    .action(async () => {
      try { printJson(await getClient().knowledge.keyStatus()); } catch (error) { fail(error); }
    });
}
