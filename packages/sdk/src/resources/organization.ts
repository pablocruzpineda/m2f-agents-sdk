import type { HttpClient } from '../http.js';
import type {
  AgentActivity,
  OperationSummary,
  OrganizationSummaryParams,
  Pagination,
} from '../types.js';

/**
 * Organization-wide reads, for tenants reporting across their own users.
 *
 * Requires the TENANT or ADMIN role — read from the database, not from the API
 * key — and every row is confined to your own customer. A regular user gets a
 * 403 here no matter what scopes the key carries.
 */
export class OrganizationResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * The same figures as `agents.summary()`, across every agent in your
   * organization. Pass `agentId` to narrow to one of them.
   */
  async summary(options: OrganizationSummaryParams = {}): Promise<OperationSummary> {
    const res = await this.http.get<OperationSummary>('/organization/summary', {
      query: {
        agentId: options.agentId ?? 'all',
        from: options.from,
        to: options.to,
        bucket: options.bucket,
      },
    });
    return res.payload!;
  }

  /**
   * Raw activity rows across the organization, message contents included.
   *
   * Prefer {@link summary} for reporting. These rows carry end customers'
   * conversations and, on WhatsApp, their names and phone numbers — reach for
   * them only when the actual messages are needed.
   */
  async activities(
    options: { agentId?: string; limit?: number; offset?: number } = {}
  ): Promise<{ activities: AgentActivity[]; pagination?: Pagination }> {
    const res = await this.http.get<{ activities: AgentActivity[]; pagination?: Pagination }>(
      '/organization/activities',
      { query: { agentId: options.agentId ?? 'all', limit: options.limit, offset: options.offset } }
    );
    return res.payload ?? { activities: [] };
  }
}
