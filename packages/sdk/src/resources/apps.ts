import type { HttpClient } from '../http.js';
import type { AppConnection, AppConnectLink, AppSearchResult } from '../types.js';

/**
 * External apps (Composio): find them, connect accounts, and see what they can do.
 * Attaching apps to an agent is `m2f.agents.setApps`. Scopes: agents:read / agents:write.
 */
export class AppsResource {
  constructor(private readonly http: HttpClient) {}

  /** Search the catalog by name or by job ("send invoices"). Each app says how it connects. */
  async search(query: string, options: { category?: string; limit?: number } = {}): Promise<AppSearchResult> {
    const res = await this.http.get<AppSearchResult>('/apps/catalog', {
      query: { q: query, category: options.category, limit: options.limit },
    });
    return res.payload!;
  }

  /** What an app can do; name up to 5 actions to get their parameters. */
  async actions(toolkit: string, actions: string[] = []): Promise<Record<string, unknown>> {
    const res = await this.http.get<Record<string, unknown>>(`/apps/${encodeURIComponent(toolkit)}/actions`, {
      query: { actions: actions.length ? actions.join(',') : undefined },
    });
    return res.payload ?? {};
  }

  /** The account's connected app accounts. */
  async connections(toolkits: string[] = []): Promise<AppConnection[]> {
    const res = await this.http.get<AppConnection[]>('/apps/connections', {
      query: { toolkits: toolkits.length ? toolkits.join(',') : undefined },
    });
    return res.payload ?? [];
  }

  /**
   * A sign-in link for the account owner to open in a browser. When they
   * finish, the account shows up ACTIVE in connections(). M2FError 409 with
   * code "needs_own_app" means the app needs the account's own OAuth app first.
   */
  async connect(toolkit: string): Promise<AppConnectLink> {
    const res = await this.http.post<AppConnectLink>('/apps/connect', { toolkit });
    return res.payload!;
  }

  /** Connect an app that takes an API key or token, e.g. `{ generic_api_key: '...' }`. */
  async connectWithToken(
    toolkit: string,
    credentials: Record<string, string>,
    scheme?: 'API_KEY' | 'BEARER_TOKEN'
  ): Promise<{ connectedAccountId: string; status: string; toolkit: string }> {
    const res = await this.http.post<{ connectedAccountId: string; status: string; toolkit: string }>(
      '/apps/connect-token',
      { toolkit, credentials, ...(scheme ? { scheme } : {}) }
    );
    return res.payload!;
  }

  /** Name a connected account ("Clínica Norte"); empty clears it. */
  async rename(connectionId: string, alias: string): Promise<{ id: string; alias: string | null; label: string | null }> {
    const res = await this.http.patch<{ id: string; alias: string | null; label: string | null }>(
      `/apps/connections/${encodeURIComponent(connectionId)}`,
      { alias }
    );
    return res.payload!;
  }

  /** Revoke a connected account. Agents using it stop reaching that app. */
  async disconnect(connectionId: string): Promise<{ deleted: boolean; id: string; toolkit: string | null }> {
    const res = await this.http.delete<{ deleted: boolean; id: string; toolkit: string | null }>(
      `/apps/connections/${encodeURIComponent(connectionId)}`
    );
    return res.payload!;
  }

  /**
   * How an app connects here — OAuth or API key — and whether the organisation must register its own
   * OAuth app first (`needsOwnApp`, for apps with no managed login like HighLevel), with the `redirectUri`
   * to set in the provider and the `appFields` registering needs.
   */
  async setup(toolkit: string): Promise<Record<string, unknown> & { needsOwnApp: boolean; redirectUri: string | null }> {
    return (await this.http.get<Record<string, unknown> & { needsOwnApp: boolean; redirectUri: string | null }>(`/apps/${encodeURIComponent(toolkit)}/setup`)).payload!;
  }

  /** TENANTS: register (or replace) the organisation's own OAuth app for an app. The secret is not kept. */
  async registerOAuthApp(toolkit: string, credentials: { client_id: string; client_secret: string; scopes?: string }): Promise<{ toolkit: string; registered: boolean; id: string }> {
    return (await this.http.put<{ toolkit: string; registered: boolean; id: string }>(`/apps/${encodeURIComponent(toolkit)}/oauth-app`, credentials)).payload!;
  }

  /** TENANTS: remove it — every account connected through it stops working. */
  async removeOAuthApp(toolkit: string, confirm: { confirm: true }): Promise<{ toolkit: string; deleted: boolean }> {
    return (await this.http.request<{ toolkit: string; deleted: boolean }>('DELETE', `/apps/${encodeURIComponent(toolkit)}/oauth-app`, { body: confirm })).payload!;
  }
}
