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
/**
 * The `claude mcp add` line for Claude Code, with the key as a header — Claude
 * Code sends custom headers, so no OAuth is needed there. SSE on /mcp is the
 * endpoint verified in production; Streamable HTTP (/mcp-stream) is the
 * transport MCP now prefers, offered with --transport http.
 */
export function claudeCodeCommand(name: string, url: string, mcpKey: string, transport: 'sse' | 'http' = 'http'): string {
  return `claude mcp add --transport ${transport} ${name} ${url} --header "Authorization: Bearer ${mcpKey}"`;
}

// ── Claude Desktop ──────────────────────────────────────────

/**
 * Claude Desktop's remote-connector screen connects from Anthropic's cloud
 * and asks for OAuth, so an mcp_ key cannot be used there. A local bridge in
 * claude_desktop_config.json can: Claude Desktop starts it on the user's
 * machine over stdio, and it forwards to our server with the key as a header.
 * supergateway over SSE is the setup verified working (2026-11-04).
 */
export const DEFAULT_DESKTOP_URL = 'https://mcp.mind2flow.io/mcp';

export function desktopConfigPath(platform: string = process.platform, env: NodeJS.ProcessEnv = process.env, home: string = os.homedir()): string {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (platform === 'win32') return path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  throw new Error('Claude Desktop runs on macOS and Windows only. Use --config <path> to write somewhere else, or --print.');
}

export interface DesktopServerEntry {
  command: string;
  args: string[];
}

export function desktopServerEntry(url: string, mcpKey: string): DesktopServerEntry {
  return { command: 'npx', args: ['-y', 'supergateway', '--sse', url, '--header', `Authorization: Bearer ${mcpKey}`] };
}

/** Never show a key on screen. */
export const redactKeys = (text: string): string => text.replace(/mcp_[A-Za-z0-9]{6,}/g, 'mcp_<your-key>');

/**
 * Add or replace one server in the config text, keeping everything else.
 * Refuses a file that is not valid JSON rather than overwriting it — that file
 * also holds the user's other servers.
 */
export function mergeDesktopConfig(existing: string | null, name: string, entry: DesktopServerEntry | Record<string, unknown>, client = 'Claude Desktop'): { text: string; replaced: boolean } {
  let config: Record<string, unknown> = {};
  if (existing !== null && existing.trim()) {
    try {
      const parsed: unknown = JSON.parse(existing);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
      config = parsed as Record<string, unknown>;
    } catch {
      throw new Error(`The ${client} config is not valid JSON. Fix it (or move it aside) first; nothing was changed.`);
    }
  }
  const servers = (config.mcpServers && typeof config.mcpServers === 'object' && !Array.isArray(config.mcpServers))
    ? (config.mcpServers as Record<string, unknown>) : {};
  const replaced = name in servers;
  config.mcpServers = { ...servers, [name]: entry };
  return { text: JSON.stringify(config, null, 2) + '\n', replaced };
}

/**
 * Merge one server into an MCP client's config file: backup first, refuse
 * invalid JSON, owner-only permissions (it holds keys). Returns whether an
 * entry of that name was replaced.
 */
export function writeServerConfig(file: string, name: string, entry: DesktopServerEntry | Record<string, unknown>, client: string): boolean {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
  const { text, replaced } = mergeDesktopConfig(existing, name, entry, client);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (existing !== null) {
    const backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(file, backup);
    fs.chmodSync(backup, 0o600);
    console.log(`Backup: ${backup}`);
  }
  fs.writeFileSync(file, text, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return replaced;
}

export function registerMcpCommands(program: Command): void {
  const mcp = program.command('mcp').description('Connect the Mind2Flow MCP server to your AI tools');

  mcp
    .command('setup')
    .description('Add the Mind2Flow MCP server to Cursor (~/.cursor/mcp.json)')
    .requiredOption('--mcp-key <key>', 'MCP API key (mcp_...) from the dashboard')
    .option('--url <url>', 'MCP server URL', DEFAULT_DESKTOP_URL)
    .option('--name <name>', 'Server name in the client config', 'mind2flow')
    .option('--config <path>', 'Config file to write (default: ~/.cursor/mcp.json)')
    .action((opts: { mcpKey: string; url: string; name: string; config?: string }) => {
      try {
        if (!/^mcp_[A-Za-z0-9]+$/.test(opts.mcpKey)) throw new Error('--mcp-key must be an MCP key (starts with mcp_), not a rest_ key');
        // Cursor speaks HTTP to remote servers itself: url + headers, no bridge needed.
        const entry = { url: opts.url, headers: { Authorization: `Bearer ${opts.mcpKey}` } };
        const file = opts.config || path.join(os.homedir(), '.cursor', 'mcp.json');
        const replaced = writeServerConfig(file, opts.name, entry, 'Cursor');
        console.log(`${replaced ? 'Updated' : 'Added'} "${opts.name}" in ${file}`);
        console.log('Restart Cursor to pick up the change.');
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  mcp
    .command('claude-command')
    .description('Print the command that adds the MCP server to Claude Code')
    .requiredOption('--mcp-key <key>', 'MCP API key (mcp_...)')
    .option('--url <url>', 'MCP server URL (/mcp for sse, /mcp-stream for http)', DEFAULT_DESKTOP_URL)
    .option('--transport <transport>', 'sse (default, the endpoint verified in production) | http (Streamable HTTP, use a /mcp-stream URL)', 'sse')
    .option('--name <name>', 'Server name', 'mind2flow')
    .action((opts: { mcpKey: string; url: string; name: string; transport: string }) => {
      if (opts.transport !== 'sse' && opts.transport !== 'http') {
        console.error('Error: --transport must be sse or http');
        process.exit(1);
      }
      console.log(claudeCodeCommand(opts.name, opts.url, opts.mcpKey, opts.transport));
    });

  mcp
    .command('desktop-config')
    .description('Add the Mind2Flow MCP server to Claude Desktop (claude_desktop_config.json), through a local bridge')
    .requiredOption('--mcp-key <key>', 'MCP API key (mcp_...) from the dashboard')
    .option('--url <url>', 'MCP server URL (SSE endpoint)', DEFAULT_DESKTOP_URL)
    .option('--name <name>', 'Server name in Claude Desktop', 'mind2flow')
    .option('--config <path>', 'Config file to write (default: Claude Desktop\'s, on macOS/Windows)')
    .option('--print', 'Only print the JSON block (key hidden); change nothing')
    .action((opts: { mcpKey: string; url: string; name: string; config?: string; print?: boolean }) => {
      try {
        if (!/^mcp_[A-Za-z0-9]+$/.test(opts.mcpKey)) throw new Error('--mcp-key must be an MCP key (starts with mcp_), not a rest_ key');
        const entry = desktopServerEntry(opts.url, opts.mcpKey);
        if (opts.print) {
          console.log(redactKeys(JSON.stringify({ mcpServers: { [opts.name]: entry } }, null, 2)));
          console.log('\nPut your key where it says mcp_<your-key>, add this under "mcpServers" and restart Claude Desktop. Needs Node.js (npx).');
          return;
        }
        const file = opts.config || desktopConfigPath();
        const replaced = writeServerConfig(file, opts.name, entry, 'Claude Desktop');
        console.log(`${replaced ? 'Updated' : 'Added'} "${opts.name}" in ${file}`);
        console.log('Restart Claude Desktop to pick it up. The bridge runs with npx, so Node.js must be installed.');
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}
