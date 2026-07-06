import fs from 'fs';
import os from 'os';
import path from 'path';
import { DEFAULT_BASE_URL, M2FClient } from '@mind2flow/agents-sdk';

export interface CliConfig {
  apiKey?: string;
  baseUrl?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.m2f');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): CliConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as CliConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: CliConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function configPath(): string {
  return CONFIG_FILE;
}

/**
 * Resolve credentials (flag > env > config file) and build a client.
 * Exits with a friendly message when no API key is available.
 */
export function getClient(opts: { apiKey?: string; baseUrl?: string } = {}): M2FClient {
  const config = loadConfig();
  const apiKey = opts.apiKey || process.env.M2F_API_KEY || config.apiKey;
  const baseUrl = opts.baseUrl || process.env.M2F_BASE_URL || config.baseUrl || DEFAULT_BASE_URL;

  if (!apiKey) {
    console.error('No API key configured.');
    console.error('Run `m2f login` or set the M2F_API_KEY environment variable.');
    console.error('Create a key in the dashboard: Developers → API → Create REST API Key.');
    process.exit(1);
  }

  return new M2FClient({ apiKey, baseUrl });
}
