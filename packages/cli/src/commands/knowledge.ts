import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { DEFAULT_BASE_URL } from '@mind2flow/agents-sdk';
import { getClient, loadConfig } from '../config';
import { printTable, printJson, fail } from '../output';

export function registerKnowledgeCommands(program: Command): void {
  const knowledge = program
    .command('knowledge')
    .description('Query and manage your GraphOS knowledge graph');

  knowledge
    .command('query <question>')
    .description('Ask the knowledge graph a question — returns facts with temporal validity')
    .option('-n, --num-results <n>', 'Max facts to return (default 10)')
    .option('--json', 'Output raw JSON')
    .action(async (question: string, opts: { numResults?: string; json?: boolean }) => {
      try {
        const facts = await getClient().knowledge.query(question, {
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
        const graph = await getClient().knowledge.getGraph({
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
        const list = await getClient().knowledge.listSources();
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
        const source = await getClient().knowledge.createSource({
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
        const job = await getClient().knowledge.syncSource(sourceId);
        console.log(`Sync started: job ${job.id} (${job.status})`);
        console.log(`Follow it with: m2f knowledge jobs --json`);
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
        await getClient().knowledge.deleteSource(sourceId);
        console.log(`Source ${sourceId} deleted.`);
      } catch (error) {
        fail(error);
      }
    });

  knowledge
    .command('upload <sourceId> <file>')
    .description('Upload a document to a file source and start ingestion')
    .action(async (sourceId: string, file: string) => {
      try {
        // Multipart upload — raw fetch (Node 18+ FormData); SDK stays JSON-only.
        const config = loadConfig();
        const apiKey = process.env.M2F_API_KEY || config.apiKey;
        const baseUrl = (process.env.M2F_BASE_URL || config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
        if (!apiKey) {
          console.error('No API key configured. Run `m2f login` first.');
          process.exit(1);
        }
        const buffer = fs.readFileSync(file);
        const form = new FormData();
        form.append('file', new Blob([buffer]), path.basename(file));
        const response = await fetch(`${baseUrl}/knowledge/sources/${sourceId}/upload`, {
          method: 'POST',
          headers: { 'x-api-key': apiKey },
          body: form,
        });
        const body = (await response.json()) as { status: number; message: string; payload?: unknown };
        if (!response.ok) {
          console.error(`Upload failed: ${body.message ?? response.status}`);
          process.exit(1);
        }
        console.log('Document uploaded — starting sync...');
        const job = await getClient().knowledge.syncSource(sourceId);
        console.log(`Ingestion job ${job.id} (${job.status})`);
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
        const jobs = await getClient().knowledge.listJobs();
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
        const entry = await getClient().knowledge.addManual({
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
        await getClient().knowledge.invalidateFact(factUuid);
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
}
