import type { HttpClient } from '../http.js';

type Json = Record<string, unknown>;
type Confirmed = { confirm: true };
const seg = encodeURIComponent;

/**
 * The tenant / white-label console: clients, credits, the signup form, pricing,
 * the tenant's Stripe, LLM keys lent to clients, per-account configuration,
 * branding and custom domain — plus `admin*` methods for platform
 * administrators (role ADMIN). Scopes tenant:read / tenant:write.
 * Secrets come back masked; deletes, credit moves and admin actions take `{ confirm: true }`.
 */
export class TenantResource {
  constructor(private readonly http: HttpClient) {}

  private async get<T = Json>(path: string, query?: Record<string, string | undefined>): Promise<T> { return (await this.http.get<T>(`/tenant${path}`, query ? { query } : undefined)).payload as T; }
  private async send<T = Json>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
    return (await this.http.request<T>(method, `/tenant${path}`, body === undefined ? {} : { body })).payload as T;
  }

  // Settings, credits, signup form
  settings() { return this.get('/settings'); }
  credits() { return this.get('/credits'); }
  transferCredits(params: { userId: string; credits: number } & Confirmed) { return this.send('POST', '/credits/transfer', params); }
  /** The public "Create Agent" signup link: url, urls.es/en, the embed <script>, signups and trial credits. */
  signupLink(options: { lang?: 'es' | 'en'; theme?: 'light' | 'dark'; color?: string } = {}) {
    return this.get<Json & { url: string; urls: { es: string; en: string }; embed: string }>('/signup-link', { ...options });
  }
  setTrialCredits(trialCredits: number) { return this.send('PUT', '/signup-link', { trialCredits }); }

  // Reselling
  updatePricing(params: { baseRate?: number; requestCost?: number; packages?: Array<{ name: string; amount: number }> }) { return this.send('PATCH', '/pricing', params); }
  addDiscountTier(params: { minimumCredits: number; discountPercentage: number }) { return this.send('POST', '/pricing/discount-tiers', params); }
  updateDiscountTier(tierId: string, params: { minimumCredits?: number; discountPercentage?: number }) { return this.send('PATCH', `/pricing/discount-tiers/${seg(tierId)}`, params); }
  deleteDiscountTier(tierId: string) { return this.send('DELETE', `/pricing/discount-tiers/${seg(tierId)}`); }
  setStripe(params: { publicKey: string; secretKey: string }) { return this.send('PUT', '/stripe', params); }
  setStripeEnabled(enabled: boolean) { return this.send('PATCH', '/stripe', { enabled }); }

  // LLM keys lent to clients
  llmKeys() { return this.get<unknown[]>('/llm-keys'); }
  addLlmKey(params: { key: string; provider?: string; assignedAccount?: string }) { return this.send('POST', '/llm-keys', params); }
  validateLlmKey(provider: string, key: string) { return this.send('POST', '/llm-keys/validate', { provider, key }); }
  updateLlmKey(keyId: string, params: { key?: string; assignedAccount?: string }) { return this.send('PATCH', `/llm-keys/${seg(keyId)}`, params); }
  deleteLlmKey(keyId: string, confirm: Confirmed) { return this.send('DELETE', `/llm-keys/${seg(keyId)}`, confirm); }

  // Clients
  clients() { return this.get<unknown[]>('/clients'); }
  client(accountId: string) { return this.get(`/clients/${seg(accountId)}`); }
  createClient(params: { name: string; email?: string; phone?: string; description?: string }) { return this.send('POST', '/clients', params); }
  updateClient(accountId: string, params: { name?: string; email?: string; phone?: string; description?: string }) { return this.send('PATCH', `/clients/${seg(accountId)}`, params); }
  deleteClient(accountId: string, confirm: Confirmed) { return this.send('DELETE', `/clients/${seg(accountId)}`, confirm); }
  addSubaccount(accountId: string, params: { name: string; email?: string; phone?: string; description?: string; address?: string }) { return this.send('POST', `/clients/${seg(accountId)}/subaccounts`, params); }
  updateSubaccount(accountId: string, subaccountId: string, params: Json) { return this.send('PATCH', `/clients/${seg(accountId)}/subaccounts/${seg(subaccountId)}`, params); }
  deleteSubaccount(accountId: string, subaccountId: string, confirm: Confirmed) { return this.send('DELETE', `/clients/${seg(accountId)}/subaccounts/${seg(subaccountId)}`, confirm); }
  /** Role USER. Without password the user gets the account-setup email. */
  addUser(accountId: string, subaccountId: string, params: { name: string; email: string; password?: string }) { return this.send('POST', `/clients/${seg(accountId)}/subaccounts/${seg(subaccountId)}/users`, params); }
  updateUser(accountId: string, subaccountId: string, userId: string, params: { name?: string; email?: string; isActive?: boolean; password?: string }) { return this.send('PATCH', `/clients/${seg(accountId)}/subaccounts/${seg(subaccountId)}/users/${seg(userId)}`, params); }
  deleteUser(accountId: string, subaccountId: string, userId: string, confirm: Confirmed) { return this.send('DELETE', `/clients/${seg(accountId)}/subaccounts/${seg(subaccountId)}/users/${seg(userId)}`, confirm); }

  // Per-account configuration
  modelDefaults(accountId: string) { return this.get(`/clients/${seg(accountId)}/model-defaults`); }
  setModelDefaults(accountId: string, params: { provider?: string; models?: Json; temperature?: number; maxTokens?: number; customApiBase?: string }) { return this.send('PUT', `/clients/${seg(accountId)}/model-defaults`, params); }
  /** One client account's log export, or the organisation's when accountId is omitted. Header values come back masked. */
  logExport(accountId?: string) { return this.get(accountId ? `/clients/${seg(accountId)}/log-export` : '/log-export'); }
  /**
   * Log export (send every conversation log to your URL) and privacy, organisation-wide or for one
   * client account: `redactContent` hides conversation content in what is exported, `redactInDb`
   * also in what is stored. Header values come back masked.
   */
  setLogExport(params: { enabled?: boolean; url?: string; method?: 'POST' | 'PUT'; headers?: Record<string, string>; format?: 'json' | 'ndjson'; includeContent?: boolean; redactContent?: boolean; redactInDb?: boolean }, accountId?: string) {
    return this.send('PUT', accountId ? `/clients/${seg(accountId)}/log-export` : '/log-export', params);
  }

  // Branding and domain
  branding() { return this.get('/branding'); }
  /** Logos as data URIs (logoLight / logoDark) or public URLs to download (logoLightUrl / logoDarkUrl); 800 KB. */
  updateBranding(params: Json) { return this.send('PUT', '/branding', params); }
  resetBranding(confirm: Confirmed) { return this.send('DELETE', '/branding', confirm); }
  domain() { return this.get('/domain'); }
  setDomain(domain: string) { return this.send('PUT', '/domain', { domain }); }
  verifyDomain() { return this.send('POST', '/domain/verify'); }
  removeDomain(confirm: Confirmed) { return this.send('DELETE', '/domain', confirm); }

  // Platform administration (role ADMIN)
  adminListTenants() { return this.get<unknown[]>('/admin/tenants'); }
  adminCreateTenant(params: { name: string; email: string; password: string; phoneNumber?: string; companyName?: string }) { return this.send('POST', '/admin/tenants', params); }
  adminSetTenantStatus(tenantId: string, params: { isActive: boolean; confirm?: true }) { return this.send('PATCH', `/admin/tenants/${seg(tenantId)}`, params); }
  adminDeleteTenant(tenantId: string, confirm: Confirmed) { return this.send('DELETE', `/admin/tenants/${seg(tenantId)}`, confirm); }
  adminAdjustCredits(tenantId: string, params: { operation: 'add' | 'subtract'; credits: number; reason?: string } & Confirmed) { return this.send('POST', `/admin/tenants/${seg(tenantId)}/credits`, params); }
  adminPromoteUser(userId: string, confirm: Confirmed) { return this.send('POST', `/admin/users/${seg(userId)}/promote`, confirm); }
}
