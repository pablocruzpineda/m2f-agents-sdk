import { Command } from 'commander';
import fs from 'fs';
import type { CrewBlueprint, CrewRunResult } from '@mind2flow/agents-sdk';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

/** A run's answer for people: the final output, each step, and whom an orchestrator asked. */
function printRun(result: CrewRunResult): void {
  for (const step of result.steps) {
    const mark = step.status === 'success' || step.status === 'completed' ? '✓' : step.status === 'paused' ? '…' : '✗';
    console.log(`${mark} ${step.stepNumber}. ${step.agentName} (${step.nodeType})${step.error ? ` — ${step.error}` : ''}`);
    for (const d of step.delegations ?? []) {
      console.log(`    → ${d.agentName}: ${d.task}`);
      if (d.error) console.log(`      ✗ ${d.error}`);
      else if (d.output) console.log(`      ${d.output.replace(/\s+/g, ' ').slice(0, 160)}${d.output.length > 160 ? '…' : ''}`);
    }
  }
  console.log('');
  if (result.status === 'paused') {
    console.log(`Paused, waiting for the ${result.waitingFor ?? 'user'}${result.notified ? ' (notified)' : ''}:`);
    console.log(result.currentQuestion ?? '');
  } else if (result.status === 'failed') {
    console.log(`Failed: ${result.error ?? 'unknown error'}`);
  } else {
    console.log(result.finalOutput ?? '(no answer)');
  }
}

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
    .command('blueprint <file>')
    .description('Create a crew from a blueprint file (steps, teams, branches), or replace a crew\'s flow with --crew')
    .option('--crew <crewId>', 'Replace this crew\'s flow instead of creating a new crew')
    .option('--dry-run', 'Validate and compile only; create or change nothing')
    .action(async (file: string, opts: { crew?: string; dryRun?: boolean }) => {
      try {
        const blueprint = JSON.parse(fs.readFileSync(file, 'utf-8')) as CrewBlueprint;
        const crews = getClient().crews;
        const options = { dryRun: Boolean(opts.dryRun) };
        const crew = opts.crew
          ? await crews.updateFromBlueprint(opts.crew, blueprint, options)
          : await crews.createFromBlueprint(blueprint, options);
        if (opts.dryRun) {
          console.error('Blueprint is valid (dry run: nothing was saved).');
          return printJson(crew);
        }
        console.log(opts.crew ? `Crew ${opts.crew} updated.` : `Crew created: ${crew.id}`);
        console.log(`Try it: m2f crews run ${opts.crew ?? crew.id} --input "..."`);
      } catch (error) {
        fail(error);
      }
    });

  crews
    .command('create-team')
    .description('Create a crew that is one orchestrator (the lead) and its team of 1–5 agents')
    .requiredOption('--name <name>', 'Crew name')
    .requiredOption('--lead <agentId>', 'Agent that leads: decides whom to ask and writes the answer')
    .requiredOption('--member <agentId...>', 'Team members (1–5 agent ids)')
    .option('--task <text>', 'What the team does')
    .option('--description <text>', 'Crew description')
    .option('--max-questions <n>', 'Most questions the lead may ask per run (1–12)')
    .option('--sequential', 'Ask members one at a time instead of at the same time')
    .option('--dry-run', 'Validate and compile only; create nothing')
    .action(async (opts: { name: string; lead: string; member: string[]; task?: string; description?: string; maxQuestions?: string; sequential?: boolean; dryRun?: boolean }) => {
      try {
        const params = {
          name: opts.name,
          description: opts.description,
          lead: opts.lead,
          members: opts.member,
          task: opts.task,
          maxQuestions: opts.maxQuestions ? parseInt(opts.maxQuestions, 10) : undefined,
          parallel: opts.sequential ? false : undefined,
        };
        const crews = getClient().crews;
        if (opts.dryRun) {
          printJson(await crews.createTeam(params, { dryRun: true }));
          return;
        }
        const crew = await crews.createTeam(params);
        console.log(`Crew created: ${crew.id}`);
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
    .option('--json', 'Output the raw execution JSON')
    .action(async (crewId: string, opts: { input?: string; inputFile?: string; json?: boolean }) => {
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
        if (opts.json || !execution.result) return printJson(execution);
        printRun(execution.result);
        if (execution.result.status === 'failed') process.exitCode = 1;
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
