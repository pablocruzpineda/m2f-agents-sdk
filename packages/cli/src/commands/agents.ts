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
}
