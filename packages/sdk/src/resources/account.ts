import type { HttpClient } from '../http.js';
import type { AccountMe } from '../types.js';

export class AccountResource {
  constructor(private readonly http: HttpClient) {}

  /** Get the identity and scopes behind the current API key. */
  async me(): Promise<AccountMe> {
    const res = await this.http.get<AccountMe>('/account/me');
    return res.payload!;
  }

  /** Get the account's credit balance. */
  async credits(): Promise<unknown> {
    const res = await this.http.get<unknown>('/account/credits');
    return res.payload;
  }

  // ── The account's LLM keys (masked; never returned in clear) ──

  async llmKeys(): Promise<{ keys: Array<{ id: string; provider: string; maskedKey: string; isValid: boolean; isAdminManaged: boolean; updatedAt: string }> }> {
    return (await this.http.get<{ keys: Array<{ id: string; provider: string; maskedKey: string; isValid: boolean; isAdminManaged: boolean; updatedAt: string }> }>('/account/llm-keys')).payload!;
  }

  /** Whether the account can run agents (own key, trial or paid) and its default provider and models. */
  async llmKeyStatus(): Promise<Record<string, unknown>> {
    return (await this.http.get<Record<string, unknown>>('/account/llm-keys/status')).payload!;
  }

  /** Add or replace the key for a provider (checked with the provider). */
  /**
   * Add or replace the key for a provider, with the account's default models — as the console saves
   * them together. Pass `models.standard` unless the account already defaults to this provider:
   * otherwise nothing is saved and the M2FError body (code MODELS_REQUIRED) lists `availableModels`.
   */
  async saveLlmKey(provider: string, key: string, options: { models?: { standard: string; thinking?: string }; temperature?: number; maxTokens?: number } = {}): Promise<{ id: string; provider: string; isValid: boolean; modelDefaults?: Record<string, unknown> }> {
    return (await this.http.put<{ id: string; provider: string; isValid: boolean; modelDefaults?: Record<string, unknown> }>('/account/llm-keys', { provider, key, ...options })).payload!;
  }

  async deleteLlmKey(keyId: string, confirm: { confirm: true }): Promise<{ deleted: string }> {
    return (await this.http.request<{ deleted: string }>('DELETE', `/account/llm-keys/${encodeURIComponent(keyId)}`, { body: confirm })).payload!;
  }

  // ── Profile; credits and payments are read-only (buying happens in the console) ──

  async profile(): Promise<{ user: Record<string, unknown> }> {
    return (await this.http.get<{ user: Record<string, unknown> }>('/account/profile')).payload!;
  }

  /** Change firstName, lastName, phoneNumber, company or avatarUrl (https). */
  async updateProfile(fields: { firstName?: string; lastName?: string; phoneNumber?: string; company?: string; avatarUrl?: string }): Promise<{ user: Record<string, unknown> }> {
    return (await this.http.patch<{ user: Record<string, unknown> }>('/account/profile', fields)).payload!;
  }

  /** Managed by a tenant (which provides the AI key) or standalone, and whether an AI key is set. */
  async context(): Promise<{ isManaged: boolean; hasApiKey: boolean; provider?: string; accountId?: string }> {
    return (await this.http.get<{ isManaged: boolean; hasApiKey: boolean; provider?: string; accountId?: string }>('/account/context')).payload!;
  }

  async creditBalance(): Promise<{ credits: number; creditsUsed: number; lastUpdated: string }> {
    return (await this.http.get<{ credits: number; creditsUsed: number; lastUpdated: string }>('/account/credits/balance')).payload!;
  }

  /** The credit packages and prices you would see in the console. */
  async creditPricing(): Promise<unknown> {
    return (await this.http.get<unknown>('/account/credits/pricing')).payload;
  }

  /** The last 50 completed purchases and plan payments. */
  async payments(): Promise<Array<{ id: string; amount: number; currency: string; credits: number; bonusCredits: number; createdAt: string; status: string; description: string; invoiceUrl: string | null }>> {
    return (await this.http.get<Array<{ id: string; amount: number; currency: string; credits: number; bonusCredits: number; createdAt: string; status: string; description: string; invoiceUrl: string | null }>>('/account/payments')).payload!;
  }

  /** The active plan, or null. */
  async subscription(): Promise<Record<string, unknown> | null> {
    return (await this.http.get<Record<string, unknown> | null>('/account/subscription')).payload ?? null;
  }

  /** Profile → API Settings: your account's default provider and models. */
  async modelDefaults(): Promise<Record<string, unknown>> {
    return (await this.http.get<Record<string, unknown>>('/account/model-defaults')).payload!;
  }

  /** Set your account's default provider and models (models.standard is required when models is sent). */
  async setModelDefaults(fields: { provider?: string; models?: { standard: string; thinking?: string }; temperature?: number; maxTokens?: number; customApiBase?: string }): Promise<Record<string, unknown>> {
    return (await this.http.put<Record<string, unknown>>('/account/model-defaults', fields)).payload!;
  }
}
