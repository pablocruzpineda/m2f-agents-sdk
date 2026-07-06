import { Command } from 'commander';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

export function registerTaskCommands(program: Command): void {
  const tasks = program.command('tasks').description('Manage agent scheduled tasks');

  tasks
    .command('list')
    .description('List scheduled tasks')
    .option('--agent-id <id>', 'Filter by agent')
    .option('--json', 'Output raw JSON')
    .action(async (opts: { agentId?: string; json?: boolean }) => {
      try {
        const list = await getClient().scheduledTasks.list({ agentId: opts.agentId });
        if (opts.json) return printJson(list);
        printTable(
          list.map((t) => ({
            id: t.id,
            name: t.name,
            agent: t.agentId,
            type: t.scheduleType,
            schedule: t.cronExpression ?? (t.intervalMs ? `${t.intervalMs}ms` : t.runAt ?? ''),
            enabled: t.enabled ? 'yes' : 'no',
          })),
          ['id', 'name', 'agent', 'type', 'schedule', 'enabled']
        );
      } catch (error) {
        fail(error);
      }
    });

  tasks
    .command('create')
    .description('Create a scheduled task for an agent')
    .requiredOption('--agent-id <id>', 'Agent to run')
    .requiredOption('--name <name>', 'Task name')
    .requiredOption('--message <text>', 'Message sent to the agent on each run')
    .option('--cron <expression>', 'Cron expression (schedule type: cron)')
    .option('--interval <ms>', 'Interval in milliseconds (schedule type: interval)')
    .option('--at <iso>', 'One-shot run time, ISO 8601 (schedule type: once)')
    .option('--timezone <tz>', 'IANA timezone for cron schedules (default UTC)')
    .action(async (opts: {
      agentId: string;
      name: string;
      message: string;
      cron?: string;
      interval?: string;
      at?: string;
      timezone?: string;
    }) => {
      try {
        const scheduleType = opts.cron ? 'cron' : opts.interval ? 'interval' : opts.at ? 'once' : undefined;
        if (!scheduleType) {
          console.error('Provide one of --cron, --interval or --at.');
          process.exit(1);
        }
        const task = await getClient().scheduledTasks.create({
          agentId: opts.agentId,
          name: opts.name,
          message: opts.message,
          scheduleType,
          cronExpression: opts.cron,
          intervalMs: opts.interval ? parseInt(opts.interval, 10) : undefined,
          runAt: opts.at,
          timezone: opts.timezone,
        });
        console.log(`Scheduled task created: ${task.id}`);
        printJson(task);
      } catch (error) {
        fail(error);
      }
    });

  tasks
    .command('toggle <taskId>')
    .description('Enable/disable a task')
    .action(async (taskId: string) => {
      try {
        const task = await getClient().scheduledTasks.toggle(taskId);
        console.log(`Task ${taskId} is now ${task.enabled ? 'enabled' : 'disabled'}.`);
      } catch (error) {
        fail(error);
      }
    });

  tasks
    .command('run <taskId>')
    .description('Run a task immediately')
    .action(async (taskId: string) => {
      try {
        const result = await getClient().scheduledTasks.run(taskId);
        printJson(result);
      } catch (error) {
        fail(error);
      }
    });

  tasks
    .command('delete <taskId>')
    .description('Delete a task')
    .action(async (taskId: string) => {
      try {
        await getClient().scheduledTasks.delete(taskId);
        console.log(`Task ${taskId} deleted.`);
      } catch (error) {
        fail(error);
      }
    });

  tasks
    .command('executions <taskId>')
    .description('Show a task\'s execution history')
    .option('--limit <n>', 'Max items (default 20)')
    .action(async (taskId: string, opts: { limit?: string }) => {
      try {
        const executions = await getClient().scheduledTasks.executions(taskId, {
          limit: opts.limit ? parseInt(opts.limit, 10) : 20,
        });
        printJson(executions);
      } catch (error) {
        fail(error);
      }
    });
}
