import type { HttpClient } from '../http.js';
import { fileForm, type UploadData } from '../upload.js';
import type {
  Agent,
  AgentAppsParams,
  AgentAppsResult,
  AgentDocument,
  EmbedCode,
  EmbedOptions,
  ShareLink,
  ShareLinkCreateParams,
  ShareLinkUpdateParams,
  AgentDocumentUsage,
  AgentActions,
  AgentActionsParams,
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
  TestRunParams,
  TestRunStarted,
} from '../types.js';

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

  /** Pause an agent: it stops answering on its channels (a WhatsApp number, for instance) until resumed. */
  pause(agentId: string): Promise<Agent> {
    return this.update(agentId, { status: 'inactive' });
  }

  /** Resume a paused agent. */
  resume(agentId: string): Promise<Agent> {
    return this.update(agentId, { status: 'active' });
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

  /**
   * What the agent's app actions actually did: every tool call with the app's
   * real answer (ok or the error, the ids created), aggregated per action.
   * "ok" means the app accepted the call. Recorded from `loggingSince` on —
   * no record is not the same as no errors; read `notes`.
   */
  async actions(agentId: string, options: AgentActionsParams = {}): Promise<AgentActions> {
    const res = await this.http.get<AgentActions>(`/agents/${agentId}/actions`, {
      query: { from: options.from, to: options.to, tool: options.tool },
    });
    return res.payload!;
  }

  /**
   * Play test conversations against the agent, for real: on a temporary copy
   * (no channel receives the replies), but its connected apps DO run. Returns
   * at once; the results fill in the `test_run` artifact — poll
   * `client.artifacts.get(artifactId)` until `status` is "done".
   */
  async runTests(agentId: string, params: TestRunParams): Promise<TestRunStarted> {
    const res = await this.http.post<TestRunStarted>(`/agents/${agentId}/test-runs`, params);
    return res.payload!;
  }

  // ── The agent's own documents ─────────────────────────────

  /** Documents the agent holds as its own, with their ingest state. */
  async listDocuments(agentId: string): Promise<{ documents: AgentDocument[]; usage: AgentDocumentUsage }> {
    const res = await this.http.get<{ documents: AgentDocument[]; usage: AgentDocumentUsage }>(
      `/agents/${encodeURIComponent(agentId)}/documents`
    );
    return res.payload ?? { documents: [], usage: { totalSize: 0, totalChars: 0, maxSize: 0, maxChars: 0 } };
  }

  /**
   * Give the agent a document of its own (PDF, DOCX, TXT, MD — 25 MB). Its
   * text goes to the agent's PRIVATE graph, which it then reads instead of the
   * shared one. Indexing runs in the background: poll listDocuments. Content
   * the agent already has is refused with M2FError status 409.
   */
  async uploadDocument(
    agentId: string,
    data: UploadData,
    filename: string
  ): Promise<{ document: AgentDocument; usage: AgentDocumentUsage }> {
    const res = await this.http.post<{ document: AgentDocument; usage: AgentDocumentUsage }>(
      `/agents/${encodeURIComponent(agentId)}/documents`,
      fileForm(data, filename),
      { timeoutMs: 180_000 }
    );
    return res.payload!;
  }

  /** Remove a document (from the agent's graph too). Entries sharing its source go as well: see alsoRemoved. */
  async deleteDocument(
    agentId: string,
    docId: string
  ): Promise<{ deleted: string; alsoRemoved: string[]; usage: AgentDocumentUsage }> {
    const res = await this.http.delete<{ deleted: string; alsoRemoved: string[]; usage: AgentDocumentUsage }>(
      `/agents/${encodeURIComponent(agentId)}/documents/${encodeURIComponent(docId)}`
    );
    return res.payload!;
  }

  // ── The agent's apps ──────────────────────────────────────

  /**
   * Set the agent's apps and build what they need to run (an agent with apps
   * listed but not built loads none). Check `warnings` and `integrations`.
   */
  async setApps(agentId: string, params: AgentAppsParams): Promise<AgentAppsResult> {
    const res = await this.http.put<AgentAppsResult>(`/agents/${encodeURIComponent(agentId)}/apps`, params);
    return res.payload!;
  }

  // ── Shared link and website embed ─────────────────────────

  /** The agent's public chat link, its limits, and whether it shows the call button. */
  async getShareLink(agentId: string): Promise<ShareLink> {
    const res = await this.http.get<ShareLink>(`/agents/${encodeURIComponent(agentId)}/share-link`);
    return res.payload!;
  }

  /** Create the link. With one already there, pass `regenerate: true` (the old URL stops working). */
  async createShareLink(agentId: string, params: ShareLinkCreateParams = {}): Promise<ShareLink> {
    const res = await this.http.post<ShareLink>(`/agents/${encodeURIComponent(agentId)}/share-link`, params);
    return res.payload!;
  }

  /** Pause/resume or change limits; the URL stays the same. */
  async updateShareLink(agentId: string, params: ShareLinkUpdateParams): Promise<ShareLink> {
    const res = await this.http.patch<ShareLink>(`/agents/${encodeURIComponent(agentId)}/share-link`, params);
    return res.payload!;
  }

  /** Delete the link: the URL and every embed using it stop working. */
  async revokeShareLink(agentId: string): Promise<{ revoked: boolean }> {
    const res = await this.http.delete<{ revoked: boolean }>(`/agents/${encodeURIComponent(agentId)}/share-link`);
    return res.payload!;
  }

  /** The <script> tag that puts the agent's chat on a website. */
  async embedCode(agentId: string, options: EmbedOptions = {}): Promise<EmbedCode> {
    const res = await this.http.get<EmbedCode>(`/agents/${encodeURIComponent(agentId)}/embed`, {
      query: { mode: options.mode, lang: options.lang, theme: options.theme, color: options.color },
    });
    return res.payload!;
  }

  // ── Export / import ───────────────────────────────────────

  /** The agent as JSON — what the console's Export downloads. */
  async export(agentId: string): Promise<Record<string, unknown>> {
    return (await this.http.get<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}/export`)).payload!;
  }

  /**
   * Create an agent from an export (here or in another account). It is created turned off
   * (as in the console) unless `activate: true`; the answer has `importedAsInactive` and `next`.
   * App accounts and private documents are not carried over.
   */
  async import(exportData: Record<string, unknown>, options: { activate?: boolean } = {}): Promise<Record<string, unknown> & { importedAsInactive: boolean; next: string }> {
    return (await this.http.post<Record<string, unknown> & { importedAsInactive: boolean; next: string }>('/agents/import', { exportData, ...options })).payload!;
  }
}
