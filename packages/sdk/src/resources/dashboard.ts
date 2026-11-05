import type { HttpClient } from '../http.js';

type Json = Record<string, unknown>;
export interface DashboardRange { startDate?: string; endDate?: string }
export interface DashboardScope { accountId?: string; subaccountId?: string }

/** The console Dashboard's reporting. Read-only (agents:read). */
export class DashboardResource {
  constructor(private readonly http: HttpClient) {}

  private async get<T = Json>(path: string, query: Record<string, string | undefined> = {}): Promise<T> {
    return (await this.http.get<T>(`/dashboard${path}`, { query })).payload as T;
  }

  consumption(options: DashboardScope & DashboardRange = {}) { return this.get('/consumption', { ...options }); }
  agentConsumption(agentId: string, options: DashboardRange & { groupBy?: 'day' | 'week' | 'month' } = {}) { return this.get(`/consumption/agents/${encodeURIComponent(agentId)}`, { ...options }); }
  crewConsumption(crewId: string, options: DashboardRange & { groupBy?: 'day' | 'week' | 'month' } = {}) { return this.get(`/consumption/crews/${encodeURIComponent(crewId)}`, { ...options }); }
  credits(options: DashboardScope & DashboardRange = {}) { return this.get('/credits', { ...options }); }
  /** LLM tokens and their USD cost by model and day. */
  tokenUsage(options: DashboardScope & DashboardRange & { tz?: string } = {}) { return this.get('/token-usage', { ...options }); }
  subaccountMetrics(subaccountId?: string) { return this.get('/subaccounts/metrics', { subaccountId }); }
  subaccountCosts(options: { subaccountId?: string } & DashboardRange = {}) { return this.get('/subaccounts/costs', { ...options }); }
  organizationAgents() { return this.get('/organization/agents'); }
}
