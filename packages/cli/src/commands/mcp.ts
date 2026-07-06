import { Command } from 'commander';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Helpers to wire the Mind2Flow MCP server into MCP clients
 * (Cursor, Claude Code, Claude Desktop).
 *
 * The MCP server uses its own key type (mcp_...), created in the dashboard
 * under Developers → MCP Keys — this is separate from the rest_ key the
 * SDK/CLI use.
 */
export function registerMcpCommands(program: Command): void {
  const mcp = program.command('mcp').description('Connect the Mind2Flow MCP server to your AI tools');

  mcp
    .command('setup')
    .description('Add the Mind2Flow MCP server to Cursor (~/.cursor/mcp.json)')
    .requiredOption('--mcp-key <key>', 'MCP API key (mcp_...) from the dashboard')
    .option('--url <url>', 'MCP server URL', 'http://localhost:3003/mcp')
    .option('--name <name>', 'Server name in the client config', 'mind2flow')
    .action((opts: { mcpKey: string; url: string; name: string }) => {
      const configFile = path.join(os.homedir(), '.cursor', 'mcp.json');
      let config: { mcpServers?: Record<string, unknown> } = {};
      try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      } catch {
        // no existing config
      }

      config.mcpServers = {
        ...config.mcpServers,
        [opts.name]: {
          url: opts.url,
          headers: { Authorization: `Bearer ${opts.mcpKey}` },
        },
      };

      fs.mkdirSync(path.dirname(configFile), { recursive: true });
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
      console.log(`Added "${opts.name}" MCP server to ${configFile}`);
      console.log('Restart Cursor to pick up the change.');
    });

  mcp
    .command('claude-command')
    .description('Print the command that adds the MCP server to Claude Code')
    .requiredOption('--mcp-key <key>', 'MCP API key (mcp_...)')
    .option('--url <url>', 'MCP server URL', 'http://localhost:3003/mcp')
    .option('--name <name>', 'Server name', 'mind2flow')
    .action((opts: { mcpKey: string; url: string; name: string }) => {
      console.log(
        `claude mcp add --transport sse ${opts.name} ${opts.url} --header "Authorization: Bearer ${opts.mcpKey}"`
      );
    });
}
