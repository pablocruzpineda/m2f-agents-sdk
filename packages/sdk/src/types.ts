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
