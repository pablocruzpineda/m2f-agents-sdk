import type { HttpClient } from '../http';
import type {
  Agent,
  AgentActivity,
  AgentCreateParams,
  AgentExecutionResult,
  AgentUpdateParams,
  ExecuteAgentParams,
  Pagination,
} from '../types';

export class AgentsResource {
  constructor(private readonly http: HttpClient) {}

  /** List all agents in your account. */
  async list(): Promise<Agent[]> {
    const res = await this.http.get<{ agents: Agent[] }>('/agents');
    return res.payload?.agents ?? [];
  }

  /** Get a single agent by id. */
  async get(agentId: string): Promise<Agent> {
    const res = await this.http.get<{ agent: Agent }>(`/agents/${agentId}`);
    return res.payload!.agent;
  }

  /** Create a new agent. */
  async create(params: AgentCreateParams): Promise<Agent> {
    const res = await this.http.post<{ agent: Agent }>('/agents', params);
    return res.payload!.agent;
  }

  /** Update an existing agent. */
  async update(agentId: string, params: AgentUpdateParams): Promise<Agent> {
    const res = await this.http.patch<{ agent: Agent }>(`/agents/${agentId}`, params);
    return res.payload!.agent;
  }

  /** Delete an agent. */
  async delete(agentId: string): Promise<void> {
    await this.http.delete(`/agents/${agentId}`);
  }

  /**
   * Execute an agent and wait for its result.
   * Blocks until the agent finishes or `timeout` ms elapse (default 120s).
   */
  async execute(agentId: string, params: ExecuteAgentParams): Promise<AgentExecutionResult> {
    const res = await this.http.post<AgentExecutionResult>(
      `/agents/${agentId}/executions`,
      params,
      // Give the HTTP layer headroom beyond the server-side execution timeout
      { timeoutMs: (params.timeout ?? 120_000) + 15_000 }
    );
    return res.payload!;
  }

  /** Get an agent's activity history. */
  async activities(
    agentId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ activities: AgentActivity[]; pagination?: Pagination }> {
    const res = await this.http.get<{ activities: AgentActivity[]; pagination?: Pagination }>(
      `/agents/${agentId}/activities`,
      { query: { limit: options.limit, offset: options.offset } }
    );
    return res.payload ?? { activities: [] };
  }

  /** Assign a device (e.g. a WhatsApp number) to an agent. */
  async assignDevice(agentId: string, deviceId: string): Promise<void> {
    await this.http.post(`/agents/${agentId}/devices/${deviceId}`);
  }

  /** Unassign a device from an agent. */
  async unassignDevice(agentId: string, deviceId: string): Promise<void> {
    await this.http.delete(`/agents/${agentId}/devices/${deviceId}`);
  }
}
