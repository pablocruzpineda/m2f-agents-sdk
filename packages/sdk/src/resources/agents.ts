import type { HttpClient } from '../http';
import type {
  Agent,
  AgentActivity,
  AgentChannels,
  AgentCreateParams,
  AgentExecutionResult,
  AgentIntegrations,
  AgentUpdateParams,
  ConversationAnalysis,
  ConversationAnalysisParams,
  ConversationListParams,
  ConversationSearchParams,
  ConversationSearchResult,
  ConversationsResult,
  ExecuteAgentParams,
  OperationSummary,
  Pagination,
  SummaryParams,
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
  // ── Analysis and diagnostics ──────────────────────────────────────────────

  /**
   * Aggregated operational figures: volume, distinct people, conversation
   * depth, hour-of-day (UTC), channels, response-time percentiles, errors.
   *
   * Computed from the database, so these numbers are exact — unlike
   * {@link analyzeConversations}, which reads text with a model. Always read
   * `notes` alongside them: it says when people could not be counted or when
   * the range held more rows than were read.
   *
   * @param agentId An agent id, or `"all"` for every agent you own.
   */
  async summary(agentId: string, options: SummaryParams = {}): Promise<OperationSummary> {
    const res = await this.http.get<OperationSummary>(`/agents/${agentId}/summary`, {
      query: { from: options.from, to: options.to, bucket: options.bucket },
    });
    return res.payload!;
  }

  /**
   * Whole conversations, newest first, paged BY CONVERSATION — a page never
   * cuts a thread in half.
   *
   * Pass `sessionIds` to read exactly the threads {@link searchConversations}
   * just found, which is far cheaper than reading a whole month.
   */
  async conversations(
    agentId: string,
    options: ConversationListParams = {}
  ): Promise<ConversationsResult> {
    const res = await this.http.get<ConversationsResult>(`/agents/${agentId}/conversations`, {
      query: {
        from: options.from,
        to: options.to,
        limit: options.limit,
        offset: options.offset,
        maxCharsPerConversation: options.maxCharsPerConversation,
        sessionIds: options.sessionIds?.join(','),
        includeScheduledTasks: options.includeScheduledTasks,
        contact: options.contact,
      },
    });
    return res.payload!;
  }

  /**
   * Which conversations mention which terms, several terms in one call.
   *
   * Searches only what CUSTOMERS wrote unless you set `role`, so the agent
   * mentioning a product does not count as someone asking for it.
   *
   * Matching is literal substring: case-insensitive but ACCENT-SENSITIVE, so
   * `"credito"` does not match `"crédito"` — pass both spellings as separate
   * terms. Per-term counts double-count a conversation that matched two terms;
   * use `matches.length` for the de-duplicated number.
   */
  async searchConversations(
    agentId: string,
    options: ConversationSearchParams
  ): Promise<ConversationSearchResult> {
    const res = await this.http.get<ConversationSearchResult>(
      `/agents/${agentId}/conversations/search`,
      {
        query: {
          terms: options.terms.join(','),
          from: options.from,
          to: options.to,
          limit: options.limit,
          includeScheduledTasks: options.includeScheduledTasks,
          role: options.role,
        },
      }
    );
    return res.payload!;
  }

  /**
   * Ask an arbitrary question of the agent's conversations.
   *
   * You supply the question and the fields you want back, so this one method
   * covers "which products did people ask for", "did this end in a sale" and
   * "what went wrong". Returns a value per conversation plus a frequency table
   * per field.
   *
   * COSTS MONEY: it reads transcripts with an LLM on YOUR account's own key
   * (or the trial key while that is active), and throws with status 402 when
   * the account has neither. Keep `maxConversations` to what the question
   * needs. The values come from a model reading text, so they can be wrong —
   * hard figures belong to {@link summary}.
   */
  async analyzeConversations(
    agentId: string,
    params: ConversationAnalysisParams
  ): Promise<ConversationAnalysis> {
    const res = await this.http.post<ConversationAnalysis>(
      `/agents/${agentId}/conversations/analyze`,
      params
    );
    return res.payload!;
  }

  /**
   * Which apps the agent is wired to, and whether that wiring works.
   *
   * `issues` is the useful part: pinned to an account that no longer exists,
   * connected but not ACTIVE, apps with no actions selected. When Composio
   * cannot be reached, `connections` is null and `issues` says the check did
   * not run — which is not the same as "disconnected".
   */
  async integrations(agentId: string): Promise<AgentIntegrations> {
    const res = await this.http.get<AgentIntegrations>(`/agents/${agentId}/integrations`);
    return res.payload!;
  }

  /**
   * How the agent can be reached, and whether each way works: input/output
   * channel, API endpoint, WhatsApp device, shared link — each with what is
   * broken about it in `issues`.
   *
   * `whatsapp.isConnectedFlag` is a stored value that nothing re-checks, so it
   * can read "connected" after a number has dropped. Weigh it against
   * `whatsapp.lastInboundAt`.
   */
  async channels(agentId: string): Promise<AgentChannels> {
    const res = await this.http.get<AgentChannels>(`/agents/${agentId}/channels`);
    return res.payload!;
  }
}
