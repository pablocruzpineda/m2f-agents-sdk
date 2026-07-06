import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

export function registerToolCommands(program: Command): void {
  const tools = program.command('tools').description('Manage custom Python tools');

  tools
    .command('list')
    .description('List your custom tools')
    .option('--json', 'Output raw JSON')
    .option('--public', 'Discover public tools instead')
    .action(async (opts: { json?: boolean; public?: boolean }) => {
      try {
        const client = getClient();
        const list = opts.public ? await client.tools.listPublic() : await client.tools.list();
        if (opts.json) return printJson(list);
        printTable(
          list.map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category ?? '',
            public: t.isPublic ? 'yes' : 'no',
          })),
          ['id', 'name', 'category', 'public']
        );
      } catch (error) {
        fail(error);
      }
    });

  tools
    .command('get <toolId>')
    .description('Show one tool (including its code)')
    .action(async (toolId: string) => {
      try {
        printJson(await getClient().tools.get(toolId));
      } catch (error) {
        fail(error);
      }
    });

  tools
    .command('push <file>')
    .description('Create (or update with --tool-id) a custom tool from a Python file')
    .option('--name <name>', 'Tool name (defaults to the file name)')
    .requiredOption('--description <text>', 'What the tool does — shown to agents')
    .option('--tool-id <id>', 'Update this existing tool instead of creating')
    .option('--category <category>', 'Tool category')
    .option('--public', 'Make the tool publicly discoverable')
    .action(async (file: string, opts: {
      name?: string;
      description: string;
      toolId?: string;
      category?: string;
      public?: boolean;
    }) => {
      try {
        const code = fs.readFileSync(file, 'utf-8');
        const name = opts.name ?? path.basename(file, path.extname(file));
        const client = getClient();
        if (opts.toolId) {
          const tool = await client.tools.update(opts.toolId, {
            name,
            description: opts.description,
            code,
            category: opts.category,
            isPublic: opts.public,
          });
          console.log(`Tool updated: ${tool.id}`);
        } else {
          const tool = await client.tools.create({
            name,
            description: opts.description,
            code,
            category: opts.category,
            isPublic: Boolean(opts.public),
          });
          console.log(`Tool created: ${tool.id}`);
        }
      } catch (error) {
        fail(error);
      }
    });

  tools
    .command('delete <toolId>')
    .description('Delete a custom tool')
    .action(async (toolId: string) => {
      try {
        await getClient().tools.delete(toolId);
        console.log(`Tool ${toolId} deleted.`);
      } catch (error) {
        fail(error);
      }
    });

  tools
    .command('exec <file>')
    .description('Run a Python file in the sandbox (requires tools:execute scope)')
    .option('--timeout <seconds>', 'Timeout in seconds (default 60)')
    .action(async (file: string, opts: { timeout?: string }) => {
      try {
        const code = fs.readFileSync(file, 'utf-8');
        const result = await getClient().tools.executePython({
          code,
          timeout: opts.timeout ? parseInt(opts.timeout, 10) : undefined,
        });
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        console.error(`\n(${result.success ? 'success' : 'failed'} in ${result.executionTime}s)`);
        if (!result.success) process.exit(1);
      } catch (error) {
        fail(error);
      }
    });
}
