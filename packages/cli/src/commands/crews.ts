import { Command } from 'commander';
import fs from 'fs';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

export function registerCrewCommands(program: Command): void {
  const crews = program.command('crews').description('Manage and execute multi-agent crews');

  crews
    .command('list')
    .description('List your crews')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const list = await getClient().crews.list();
        if (opts.json) return printJson(list);
        printTable(
          list.map((c) => ({ id: c.id, name: c.name, description: c.description ?? '' })),
          ['id', 'name', 'description']
        );
      } catch (error) {
        fail(error);
      }
    });

  crews
    .command('get <crewId>')
    .description('Show one crew')
    .action(async (crewId: string) => {
      try {
        printJson(await getClient().crews.get(crewId));
      } catch (error) {
        fail(error);
      }
    });

  crews
    .command('create')
    .description('Create a crew from a JSON definition file')
    .requiredOption('--from <file>', 'JSON file with the crew definition')
    .action(async (opts: { from: string }) => {
      try {
        const params = JSON.parse(fs.readFileSync(opts.from, 'utf-8'));
        const crew = await getClient().crews.create(params);
        console.log(`Crew created: ${crew.id}`);
        printJson(crew);
      } catch (error) {
        fail(error);
      }
    });

  crews
    .command('delete <crewId>')
    .description('Delete a crew')
    .action(async (crewId: string) => {
      try {
        await getClient().crews.delete(crewId);
        console.log(`Crew ${crewId} deleted.`);
      } catch (error) {
        fail(error);
      }
    });

  crews
    .command('run <crewId>')
    .description('Execute a crew')
    .option('--input <text>', 'Input text for the crew')
    .option('--input-file <file>', 'Read input (JSON or text) from a file')
    .action(async (crewId: string, opts: { input?: string; inputFile?: string }) => {
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
        console.error(`Running crew ${crewId}...`);
        const execution = await getClient().crews.execute(crewId, input);
        printJson(execution);
      } catch (error) {
        fail(error);
      }
    });

  crews
    .command('executions <crewId>')
    .description('List a crew\'s executions')
    .option('--limit <n>', 'Max items (default 20)')
    .action(async (crewId: string, opts: { limit?: string }) => {
      try {
        const { executions } = await getClient().crews.executions(crewId, {
          limit: opts.limit ? parseInt(opts.limit, 10) : 20,
        });
        printTable(
          executions.map((e) => ({ id: e.id, status: e.status, createdAt: e.createdAt ?? '' })),
          ['id', 'status', 'createdAt']
        );
      } catch (error) {
        fail(error);
      }
    });

  crews
    .command('execution <crewId> <executionId>')
    .description('Show one crew execution (poll for status/result)')
    .action(async (crewId: string, executionId: string) => {
      try {
        printJson(await getClient().crews.getExecution(crewId, executionId));
      } catch (error) {
        fail(error);
      }
    });
}
