import { HttpClient } from './http';
import { AgentsResource } from './resources/agents';
import { CrewsResource } from './resources/crews';
import { DevicesResource } from './resources/devices';
import { ToolsResource } from './resources/tools';
import { ScheduledTasksResource } from './resources/scheduledTasks';
import { AccountResource } from './resources/account';

export const DEFAULT_BASE_URL = 'https://api.mind2flow.io/api/v1';

export interface M2FClientOptions {
  /** REST API key from the Mind2Flow dashboard (Developers → API). Starts with rest_. */
  apiKey: string;
  /** API base URL. Defaults to production; point at http://localhost:3002/api/v1 for local dev. */
  baseUrl?: string;
  /** Default request timeout in milliseconds (default 30000). */
  timeoutMs?: number;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (defaults to global fetch, Node 18+). */
  fetch?: typeof fetch;
}

/**
 * Mind2Flow API client.
 *
 * ```ts
 * import { M2FClient } from '@mind2flow/agents-sdk';
 *
 * const m2f = new M2FClient({ apiKey: process.env.M2F_API_KEY! });
 * const agents = await m2f.agents.list();
 * const { result } = await m2f.agents.execute(agents[0].id, { input: 'Hello!' });
 * ```
 */
export class M2FClient {
  readonly agents: AgentsResource;
  readonly crews: CrewsResource;
  readonly devices: DevicesResource;
  readonly tools: ToolsResource;
  readonly scheduledTasks: ScheduledTasksResource;
  readonly account: AccountResource;

  constructor(options: M2FClientOptions) {
    if (!options.apiKey) {
      throw new Error('M2FClient requires an apiKey (rest_...)');
    }

    const http = new HttpClient({
      apiKey: options.apiKey,
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: options.timeoutMs ?? 30_000,
      headers: options.headers,
      fetch: options.fetch,
    });

    this.agents = new AgentsResource(http);
    this.crews = new CrewsResource(http);
    this.devices = new DevicesResource(http);
    this.tools = new ToolsResource(http);
    this.scheduledTasks = new ScheduledTasksResource(http);
    this.account = new AccountResource(http);
  }
}
