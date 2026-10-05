import { HttpClient } from './http.js';
import { AgentsResource } from './resources/agents.js';
import { CrewsResource } from './resources/crews.js';
import { DevicesResource } from './resources/devices.js';
import { ToolsResource } from './resources/tools.js';
import { ScheduledTasksResource } from './resources/scheduledTasks.js';
import { AccountResource } from './resources/account.js';
import { KnowledgeResource } from './resources/knowledge.js';
import { OrganizationResource } from './resources/organization.js';
import { ArtifactsResource } from './resources/artifacts.js';
import { VoiceResource } from './resources/voice.js';
import { PanelsResource } from './resources/panels.js';

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
  readonly knowledge: KnowledgeResource;
  /** Organization-wide reads. TENANT or ADMIN only. */
  readonly organization: OrganizationResource;
  /** Reports, test runs and prompt changes, as versioned, shareable documents. */
  readonly artifacts: ArtifactsResource;
  /** Phone calls: place calls, manage lines, read calls and transcripts. */
  readonly voice: VoiceResource;
  /** For external panels: subscribe to a WhatsApp device's traffic and send through it. */
  readonly panels: PanelsResource;

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
    this.organization = new OrganizationResource(http);
    this.artifacts = new ArtifactsResource(http);
    this.knowledge = new KnowledgeResource(http);
    this.voice = new VoiceResource(http);
    this.panels = new PanelsResource(http);
  }
}
