/**
 * Types for the Mind2Flow API v1.
 * Contract reference: openapi/v1.json (served live at /api/v1/openapi.json).
 */

/** Standard response envelope returned by every endpoint. */
export interface Envelope<T = unknown> {
  status: number;
  message: string;
  payload?: T;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export interface Agent {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt?: string | null;
  type?: string;
  modelProvider?: string | null;
  models?: Record<string, string | null> | null;
  temperature?: number | null;
  maxTokens?: number | null;
  customApiBase?: string | null;
  toolsConfig?: unknown;
  inputConfig?: unknown;
  outputConfig?: unknown;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AgentCreateParams {
  name: string;
  description?: string;
  systemPrompt?: string;
  type?: string;
  toolId?: string;
  customToolId?: string;
  modelProvider?: string;
  models?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
  customApiBase?: string;
  inputConfig?: unknown;
  outputConfig?: unknown;
  toolsConfig?: unknown;
}

export type AgentUpdateParams = Partial<AgentCreateParams>;

export interface AgentActivity {
  id: string;
  agentId: string;
  type?: string;
  input?: unknown;
  output?: unknown;
  createdAt?: string;
  [key: string]: unknown;
}

export interface AgentExecutionResult {
  executionId: string;
  agentId: string;
  result: unknown;
}

export interface ExecuteAgentParams {
  /** Input payload passed to the agent (string or structured object). */
  input: unknown;
  /** Max wait in milliseconds (1000–300000, default 120000). */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Crews
// ---------------------------------------------------------------------------

export interface Crew {
  id: string;
  name: string;
  description?: string | null;
  agents?: unknown[];
  workflow?: unknown;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CrewCreateParams {
  name: string;
  description?: string;
  agents?: unknown[];
  workflow?: unknown;
  [key: string]: unknown;
}

export interface CrewExecution {
  id: string;
  crewId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | string;
  inputData?: unknown;
  result?: unknown;
  createdAt?: string;
  completedAt?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export interface Device {
  id: string;
  name: string;
  type: string;
  isConnected?: boolean;
  createdAt?: string;
  [key: string]: unknown;
}

export interface DeviceCreateParams {
  name: string;
  type: string;
  config?: unknown;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Custom tools
// ---------------------------------------------------------------------------

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  code: string;
  category?: string | null;
  tags?: string[];
  isPublic?: boolean;
  version?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CustomToolCreateParams {
  name: string;
  description: string;
  /** Python source. */
  code: string;
  examples?: string[];
  category?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface PythonExecution {
  stdout: string;
  stderr: string;
  executionTime: number;
  success: boolean;
}

export interface ExecutePythonParams {
  /** Python source to run in the sandbox. */
  code: string;
  /** Optional data made available to the script. */
  webhookData?: Record<string, unknown>;
  /** Seconds (1–300, default 60). */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Scheduled tasks
// ---------------------------------------------------------------------------

export type ScheduleType = 'cron' | 'interval' | 'once';

export interface ScheduledTask {
  id: string;
  agentId: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  scheduleType: ScheduleType | string;
  cronExpression?: string | null;
  timezone?: string | null;
  intervalMs?: number | null;
  runAt?: string | null;
  message: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ScheduledTaskCreateParams {
  agentId: string;
  name: string;
  description?: string;
  scheduleType: ScheduleType;
  cronExpression?: string;
  timezone?: string;
  intervalMs?: number;
  runAt?: string;
  message: string;
}

export type ScheduledTaskUpdateParams = Partial<Omit<ScheduledTaskCreateParams, 'agentId'>> & {
  enabled?: boolean;
};

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface AccountMe {
  user: {
    id: string;
    name?: string | null;
    email: string;
    createdAt?: string;
    subaccountId?: string | null;
  };
  auth: {
    method: 'api-key' | 'jwt';
    apiKeyId?: string;
    scopes?: string[];
  };
}

// ---------------------------------------------------------------------------
// Knowledge (GraphOS)
// ---------------------------------------------------------------------------

export interface KnowledgeFact {
  uuid?: string | null;
  fact: string;
  valid_at?: string | null;
  /** In the future = validity window end; in the past = superseded. */
  invalid_at?: string | null;
}

export type KnowledgeSourceType = 'file' | 'sql' | 'rest' | 'composio';

export interface KnowledgeSource {
  id: string;
  type: KnowledgeSourceType;
  name: string;
  status: 'active' | 'paused' | 'error';
  /** Credentials are masked in responses. */
  config: Record<string, unknown>;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocument {
  id: string;
  source_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: 'pending' | 'ingested' | 'skipped' | 'failed';
  error?: string | null;
  episode_count: number;
  created_at: string;
  ingested_at?: string | null;
}

export interface KnowledgeJob {
  id: string;
  source_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stats: { total?: number; ingested?: number; skipped?: number; failed?: number };
  error?: string | null;
  created_at: string;
  finished_at?: string | null;
}

export interface KnowledgeManualEntry {
  id: string;
  statement: string;
  valid_from?: string | null;
  valid_until?: string | null;
  status: 'processing' | 'scheduled' | 'active' | 'expired' | 'failed';
  error?: string | null;
  /** Who declared the fact: a user in the dashboard or an agent with write access. */
  origin?: 'user' | 'agent';
  /** Id of the agent that wrote it (when origin is "agent"). */
  origin_agent_id?: string | null;
  created_at: string;
}

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  degree: number;
  type?: string | null;
  kind?: string;
}

export interface KnowledgeGraphEdge {
  id?: string | null;
  source: string;
  target: string;
  fact?: string | null;
  valid_at?: string | null;
  invalid_at?: string | null;
  kind?: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface KnowledgeEntityDetail {
  uuid: string;
  name?: string | null;
  summary?: string | null;
  facts: Array<{
    fact?: string | null;
    valid_at?: string | null;
    invalid_at?: string | null;
    related?: string | null;
    related_uuid?: string | null;
  }>;
}

export interface KnowledgeUsage {
  totals: {
    sources: number;
    documents: number;
    storage_bytes: number;
    episodes: number;
    manual_entries: number;
  };
  this_month: {
    period: string;
    episodes: number;
    queries: number;
    /** Estimate of what OpenAI bills to the account's own key (BYOK). */
    estimated_cost_usd?: number;
    tokens?: { llm_input: number; llm_output: number; embeddings: number };
  };
  monthly: Array<{ period: string; queries: number; episodes: number; estimated_cost_usd?: number }>;
  limits: { monthly_episode_limit: number | null; remaining_this_month: number | null };
  /** Present when the account runs on the platform trial key (no own OpenAI key). */
  trial?: {
    active: boolean;
    episodes_included: number;
    episodes_used_total: number;
    remaining: number;
  } | null;
}

export interface KnowledgeSourceCreateParams {
  type: KnowledgeSourceType;
  name: string;
  config?: Record<string, unknown>;
}

export interface KnowledgeManualCreateParams {
  statement: string;
  valid_from?: string;
  valid_until?: string;
}

// ── Analysis and diagnostics ────────────────────────────────────────────────
//
// Every one of these carries a `notes` array. It is not decoration: it says
// when people could not be counted, when only a subset was analysed, or when a
// check did not run. Surface it wherever you surface the figures — a number
// without its caveat is the one that gets quoted.

export type SummaryBucket = 'day' | 'week' | 'month';

export interface OperationSummary {
  agentId: string;
  /** The agent these results belong to (null for "all"). Check it is the one you meant. */
  agentName: string | null;
  range: { from: string; to: string; days: number };
  totals: {
    messages: number;
    incoming: number;
    outgoing: number;
    errors: number;
    /** Incoming messages fired by the agent's own scheduled tasks, not by a person. */
    scheduledRuns: number;
  };
  people: {
    distinct: number;
    avgMessagesPerPerson: number | null;
    /** Messages with no sender id — see `notes`. */
    unattributedMessages: number;
    top: Array<{ contact: string; messages: number; firstAt: string; lastAt: string }>;
  };
  bucket: SummaryBucket;
  series: Array<{
    bucket: string;
    incoming: number;
    outgoing: number;
    people: number;
    responseMs: { avg: number; p50: number; samples: number } | null;
  }>;
  /** Agent replies per person, as the raw histogram: group it however you need. */
  depth: {
    noReplyPeople: number;
    perPerson: { avg: number; p50: number; p75: number; p90: number; max: number } | null;
    histogram: Array<{ replies: number; people: number }>;
  };
  /** Hour of day in UTC. */
  perHour: Array<{ hour: number; incoming: number }>;
  channels: Array<{ channel: string; messages: number }>;
  responseTimeMs: { avg: number; p50: number; p95: number; samples: number } | null;
  errors: { count: number; samples: string[] };
  truncated: boolean;
  notes: string[];
}

export interface TranscriptMessage {
  role: 'customer' | 'agent';
  content: string;
  at: string;
}

export interface Conversation {
  sessionId: string;
  contact: string;
  /** A scheduled run of the agent, not a person. */
  isScheduledTask: boolean;
  messages: TranscriptMessage[];
  messageCount: number;
  firstAt: string;
  lastAt: string;
  /** Cut to fit the character budget: the opening and the ending are kept. */
  truncated: boolean;
  /** Messages left out of the middle when `truncated`. */
  omittedMessages: number;
}

export interface ConversationsResult {
  agentId: string;
  /** The agent these results belong to (null for "all"). Check it is the one you meant. */
  agentName: string | null;
  range: { from: string; to: string };
  conversations: Conversation[];
  pagination: Pagination;
  notes: string[];
}

/** Whose messages a search looks in. Default `customer`. */
export type SearchRole = 'customer' | 'agent' | 'any';

export interface ConversationSearchResult {
  agentId: string;
  /** The agent these results belong to (null for "all"). Check it is the one you meant. */
  agentName: string | null;
  range: { from: string; to: string };
  /** Whose messages were searched. */
  role: SearchRole;
  /** Counts are per term; a conversation matching two terms is counted in both. */
  terms: Array<{ term: string; conversations: number; messages: number; sessionIds: string[] }>;
  /** De-duplicated: every conversation that matched at least one term. */
  matches: Array<{
    sessionId: string;
    contact: string;
    isScheduledTask: boolean;
    terms: string[];
    messages: number;
    lastAt: string;
    snippets: string[];
  }>;
  notes: string[];
}

export interface AnalysisField {
  /** Short identifier; becomes a column and a frequency table. */
  name: string;
  description: string;
}

export interface ConversationAnalysisParams {
  question: string;
  fields: AnalysisField[];
  from?: string;
  to?: string;
  sessionIds?: string[];
  /** Ceiling on conversations read. Default 40, max 200. Higher costs more. */
  maxConversations?: number;
  includeScheduledTasks?: boolean;
}

export interface ConversationAnalysis {
  agentId: string;
  /** The agent these results belong to (null for "all"). Check it is the one you meant. */
  agentName: string | null;
  range: { from: string; to: string };
  question: string;
  fields: string[];
  analyzed: number;
  totalInRange: number;
  results: Array<{ sessionId: string; contact: string; values: Record<string, string[]> }>;
  /** Per field: value → how many distinct conversations gave it. */
  aggregates: Record<string, Array<{ value: string; conversations: number }>>;
  notes: string[];
}

export interface AgentIntegrations {
  agentId: string;
  agentName: string;
  toolkits: string[];
  pinned: Array<{ toolkit: string; connectedAccountId: string; label: string | null; hasServer: boolean }>;
  selectedActions: number;
  /** Null when Composio could not be reached — which is NOT the same as disconnected. */
  connections: Array<{ id: string; toolkit: string | null; status: string; label: string | null }> | null;
  perToolkit: Array<{
    toolkit: string;
    pinnedAccountId: string | null;
    connectionStatus: string | null;
    ok: boolean | null;
  }>;
  /** Real problems. */
  issues: string[];
  /** Caveats about the checks themselves — e.g. Composio could not be reached. */
  notes: string[];
}

export interface AgentChannels {
  agentId: string;
  agentName: string;
  status: string;
  input: { type: string | null; endpointUrl: string | null };
  output: { type: string | null; target: string | null };
  whatsapp: {
    assigned: boolean;
    deviceId: string | null;
    deviceName: string | null;
    /** Stored flag; can be stale. Prefer `liveState`. */
    isConnectedFlag: boolean | null;
    /**
     * Live state from the connection server: `"open"` is connected, `"not_found"` means the
     * instance no longer exists (the number is not linked). Null when the probe did not run.
     */
    liveState: string | null;
    liveCheck: 'ok' | 'failed' | 'skipped';
    phoneNumber: string | null;
    sessionId: string | null;
    lastInboundAt: string | null;
  };
  sharedLink: {
    exists: boolean;
    isActive: boolean | null;
    expiresAt: string | null;
    expired: boolean | null;
    requestCount: number | null;
    maxRequests: number | null;
  };
  /** Real problems. */
  issues: string[];
  /** Caveats about the checks themselves — e.g. the live WhatsApp probe could not run. */
  notes: string[];
}

export interface ConversationListParams {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  maxCharsPerConversation?: number;
  /** Read exactly these threads (e.g. from a search). An empty list is ignored — see `notes`. */
  sessionIds?: string[];
  includeScheduledTasks?: boolean;
  /**
   * A specific customer, by name or phone (case- and accent-insensitive).
   * Names are not message text, so `searchConversations` cannot find a person — use this.
   */
  contact?: string;
}

export interface ConversationSearchParams {
  terms: string[];
  from?: string;
  to?: string;
  limit?: number;
  includeScheduledTasks?: boolean;
  /**
   * Whose messages to search. Default `customer` — right for demand questions,
   * where the agent mentioning a product must not count as someone asking for it.
   */
  role?: SearchRole;
}

export interface SummaryParams {
  from?: string;
  to?: string;
  bucket?: SummaryBucket;
}

export interface OrganizationSummaryParams extends SummaryParams {
  /** A specific agent within the organization, or "all". */
  agentId?: string;
}

// ─── Actions (what the agent's app calls actually did) ──────────────────

export interface AgentActionTool {
  tool: string;
  /** composio | mcp | custom | image | unknown */
  via: string;
  server: string;
  calls: number;
  ok: number;
  errors: number;
  /** Percent. */
  errorRate: number;
  avgMs: number | null;
  lastCallAt: string;
  lastErrorAt: string | null;
  topErrors: Array<{ error: string; count: number }>;
  recentIds: Array<{ at: string; ids: Record<string, string> }>;
}

/**
 * Every tool call the agent made, with the app's real answer. "ok" means the
 * app's API accepted the call — not proof of what the app did afterwards.
 * Recorded from `loggingSince` on; read `notes`.
 */
export interface AgentActions {
  agentId: string;
  agentName: string;
  range: { from: string; to: string };
  totals: { messagesWithActions: number; calls: number; ok: number; errors: number };
  tools: AgentActionTool[];
  recentErrors: Array<{ at: string; tool: string; error: string; sessionId: string | null }>;
  loggingSince: string | null;
  notes: string[];
}

export interface AgentActionsParams {
  from?: string;
  to?: string;
  /** Only actions whose name contains this text. */
  tool?: string;
}

// ─── Test runs ──────────────────────────────────────────────────────────

export interface TestCaseSpec {
  name: string;
  /** What the test customer says, turn by turn (max 5). {{name}} {{phone}} {{email}} take `identity`. */
  turns: string[];
  /** What the agent should do or say, including the app action it should perform. */
  expected: string;
}

export interface TestRunParams {
  /** Up to 15. */
  cases: TestCaseSpec[];
  identity?: { name?: string; phone?: string; email?: string };
}

export interface TestRunStarted {
  /** The `test_run` artifact the results fill in. Poll `artifacts.get()` until `status` is "done". */
  artifactId: string;
  cases: number;
}

// ─── Artifacts ──────────────────────────────────────────────────────────

export type ArtifactKind = 'report' | 'operation_report' | 'test_run' | 'prompt_change' | (string & {});
export type ArtifactStatus = 'ready' | 'running' | 'done' | 'interrupted' | 'failed' | 'archived' | (string & {});
export type ArtifactFormat = 'number' | 'percent' | 'ms' | 'text' | 'date';
export interface SourceRef { ref: string; path?: string }

export type ArtifactBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 | 3 }
  | { type: 'text'; markdown: string }
  | { type: 'callout'; tone: 'info' | 'success' | 'warning' | 'error'; text: string }
  | { type: 'kpis'; items: Array<{ label: string; value?: string | number; source?: SourceRef; format?: ArtifactFormat; hint?: string }> }
  | { type: 'table'; title?: string; columns: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center'; format?: ArtifactFormat }>; rows?: Array<Record<string, unknown>>; source?: SourceRef }
  | { type: 'chart'; title?: string; kind: 'bar' | 'line' | 'area'; x: string; y: string[]; yLabels?: string[]; rows?: Array<Record<string, unknown>>; source?: SourceRef }
  | { type: 'excerpt'; title?: string; contact?: string; messages: Array<{ role: 'customer' | 'agent'; content: string; at?: string }> }
  | { type: 'test_results'; title?: string; cases: Array<{ name: string; input: string; expected: string; answer?: string; verdict: 'pass' | 'fail' | 'partial' | 'error' | 'pending'; reason?: string; actions?: Array<{ tool: string; ok: boolean; error?: string; ids?: Record<string, string> }>; secs?: number }> }
  | { type: 'diff'; label?: string; before: string; after: string }
  | { type: 'divider' };

export type ArtifactSourceTool =
  | 'operation_summary' | 'organization_summary' | 'actions' | 'search' | 'conversations'
  | 'integrations' | 'channels' | 'analysis';

export interface ArtifactSourceSpec {
  tool: ArtifactSourceTool;
  args?: Record<string, unknown>;
}

export interface ArtifactSummary {
  id: string;
  rootId: string | null;
  version: number;
  kind: ArtifactKind;
  title: string;
  status: ArtifactStatus;
  agentId: string | null;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  rootId: string | null;
  version: number;
  isLatest: boolean;
  kind: ArtifactKind;
  title: string;
  status: ArtifactStatus;
  agentId: string | null;
  blocks: ArtifactBlock[];
  /** `sources`: each resolved source ({ ok, status, payload | message }); `sourceSpecs`: what was asked for. */
  data: Record<string, unknown> | null;
  shareToken: string | null;
  shareRedact: boolean;
  shareExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  versions?: Array<{ id: string; version: number; createdAt: string; isLatest: boolean }>;
}

export type ArtifactCreateParams =
  | {
      title: string;
      blocks: ArtifactBlock[];
      /** Resolved on the server as you; blocks point into them with `source: { ref, path }`. */
      sources?: Record<string, ArtifactSourceSpec>;
      kind?: ArtifactKind;
      agentId?: string;
      /** Make it a new version of this artifact. */
      parentId?: string;
    }
  | {
      /** A report the server composes. */
      template: 'operation_report';
      agentId: string;
      /** Default: the previous calendar month. */
      from?: string;
      to?: string;
      /** Default 'en'. */
      lang?: 'en' | 'es';
      title?: string;
    };

export interface ArtifactShare {
  token: string;
  redact: boolean;
  expiresAt: string | null;
}
