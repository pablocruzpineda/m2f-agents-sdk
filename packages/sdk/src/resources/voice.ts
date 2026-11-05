import type { HttpClient } from '../http.js';
import type {
  AvailableNumber, Confirmed, ManagedLineOffer, SipCredentials, TwilioNumber, Voice, VoiceAccount,
  VoiceCall, VoiceCallParams, VoiceCallStarted, VoiceLine, VoiceLineUpdate, VoicePricing,
} from '../types.js';

/**
 * Phone calls with your agents, on your own Twilio account. Connect Twilio
 * and pick a number once in the console (AI Agents → agent → Voice); from
 * then on the agent answers that number, and you can place calls, change its
 * voice or greeting, pause the line and read calls from here.
 *
 * Billing: credits for AI talk time (see `pricing()`); Twilio bills minutes
 * and numbers to your Twilio account.
 */
export class VoiceResource {
  constructor(private readonly http: HttpClient) {}

  /** The agent calls `to` from its number. Returns once Twilio queues the call. */
  async call(params: VoiceCallParams): Promise<VoiceCallStarted> {
    const res = await this.http.post<VoiceCallStarted>('/voice/calls', params);
    return res.payload!;
  }

  /** One call with its transcript. Summary and outcome arrive a few seconds after hang-up. */
  async getCall(callSid: string): Promise<VoiceCall> {
    const res = await this.http.get<VoiceCall>(`/voice/calls/${callSid}`);
    return res.payload!;
  }

  /**
   * Poll until the call is over and its outcome is in, then return it (with
   * the transcript). Throws if it takes longer than `timeoutMs` (default 15 min).
   */
  async waitForCall(callSid: string, options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<VoiceCall> {
    const timeoutMs = options.timeoutMs ?? 15 * 60_000;
    const intervalMs = options.intervalMs ?? 3_000;
    const deadline = Date.now() + timeoutMs;
    // Twilio's hang-up and the agent's summary arrive separately: once the
    // call is over, give the summary up to 30 s before returning without it.
    let overSince = 0;
    for (;;) {
      const call = await this.getCall(callSid);
      if (call.status !== 'processing') {
        if (call.outcome || call.summary) return call;
        overSince ||= Date.now();
        if (Date.now() - overSince > 30_000) return call;
      }
      if (Date.now() > deadline) throw new Error(`Call ${callSid} still in progress after ${Math.round(timeoutMs / 1000)} s`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  /** Recent calls of one agent, newest first (without transcripts). */
  async listCalls(agentId: string, options: { limit?: number } = {}): Promise<VoiceCall[]> {
    const res = await this.http.get<VoiceCall[]>(`/voice/agents/${agentId}/calls`, { query: { limit: options.limit } });
    return res.payload ?? [];
  }

  /** Every agent that answers phone calls. */
  async lines(): Promise<VoiceLine[]> {
    const res = await this.http.get<VoiceLine[]>('/voice/lines');
    return res.payload ?? [];
  }

  /** One agent's line. 404 if it has none. */
  async getLine(agentId: string): Promise<VoiceLine> {
    const res = await this.http.get<VoiceLine>(`/voice/agents/${agentId}`);
    return res.payload!;
  }

  /** Change the voice or greeting, pause/resume, or move the line to another number. */
  async updateLine(agentId: string, update: VoiceLineUpdate): Promise<VoiceLine> {
    const res = await this.http.patch<VoiceLine>(`/voice/agents/${agentId}`, update);
    return res.payload!;
  }

  pause(agentId: string): Promise<VoiceLine> {
    return this.updateLine(agentId, { enabled: false });
  }

  resume(agentId: string): Promise<VoiceLine> {
    return this.updateLine(agentId, { enabled: true });
  }

  /** The voice catalog; pass `id` or `name` as `voice` to `updateLine`. */
  async voices(): Promise<Voice[]> {
    const res = await this.http.get<Voice[]>('/voice/voices');
    return res.payload ?? [];
  }

  async pricing(): Promise<VoicePricing> {
    const res = await this.http.get<VoicePricing>('/voice/pricing');
    return res.payload!;
  }

  // ── The line: actions ────────────────────────────────────

  /** Take the line off the agent (the number stays in Twilio). */
  async removeLine(agentId: string): Promise<{ removed: boolean }> {
    return (await this.http.delete<{ removed: boolean }>(`/voice/agents/${encodeURIComponent(agentId)}`)).payload!;
  }

  /** Send a sample after-call payload to the line's webhook. */
  async testWebhook(agentId: string): Promise<{ status: number }> {
    return (await this.http.post<{ status: number }>(`/voice/agents/${encodeURIComponent(agentId)}/test-webhook`)).payload!;
  }

  /** Send a sample after-call email to the line's recipients. */
  async testEmail(agentId: string): Promise<Record<string, unknown>> {
    return (await this.http.post<Record<string, unknown>>(`/voice/agents/${encodeURIComponent(agentId)}/test-email`)).payload!;
  }

  /** A new trigger URL (a CRM posts to it to make the agent call). The old one stops working; keep it secret. */
  async rotateTrigger(agentId: string, confirm: Confirmed): Promise<{ triggerUrl: string }> {
    return (await this.http.post<{ triggerUrl: string }>(`/voice/agents/${encodeURIComponent(agentId)}/trigger-token`, confirm)).payload!;
  }

  /** What the customer's PBX needs to forward calls to the agent (after sip.enabled). */
  async sipCredentials(agentId: string): Promise<SipCredentials> {
    return (await this.http.get<SipCredentials>(`/voice/agents/${encodeURIComponent(agentId)}/sip-credentials`)).payload!;
  }

  /** Find an ElevenLabs library voice by id. */
  async lookupVoice(id: string): Promise<Record<string, unknown>> {
    return (await this.http.get<Record<string, unknown>>('/voice/voices/lookup', { query: { id } })).payload!;
  }

  // ── The account's own Twilio ─────────────────────────────

  async account(): Promise<VoiceAccount | null> {
    return (await this.http.get<VoiceAccount | null>('/voice/account')).payload ?? null;
  }

  /** Connect the account's own Twilio (checked with Twilio, stored encrypted). */
  async connectTwilio(accountSid: string, authToken: string): Promise<VoiceAccount> {
    return (await this.http.put<VoiceAccount>('/voice/account', { accountSid, authToken })).payload!;
  }

  /** Disconnect Twilio: every voice line of the account is removed. */
  async disconnectTwilio(confirm: Confirmed): Promise<{ removed: boolean }> {
    return (await this.http.request<{ removed: boolean }>('DELETE', '/voice/account', { body: confirm })).payload!;
  }

  async numbers(): Promise<TwilioNumber[]> {
    return (await this.http.get<TwilioNumber[]>('/voice/numbers')).payload ?? [];
  }

  async searchNumbers(query: { country: string; type?: 'local' | 'mobile' | 'tollFree'; areaCode?: string; contains?: string }): Promise<AvailableNumber[]> {
    return (await this.http.get<AvailableNumber[]>('/voice/numbers/available', { query })).payload ?? [];
  }

  /** Buy a number (Twilio charges it monthly), optionally putting an agent on it. */
  async buyNumber(params: { phoneNumber: string; agentId?: string } & Confirmed): Promise<Record<string, unknown>> {
    return (await this.http.post<Record<string, unknown>>('/voice/numbers/purchase', params)).payload!;
  }

  // ── The line Mind2Flow manages ───────────────────────────

  async managedLine(): Promise<ManagedLineOffer> {
    return (await this.http.get<ManagedLineOffer>('/voice/managed')).payload!;
  }

  /** Subscribe (charged monthly to the saved card). */
  async subscribeManaged(params: { plan: 'basic' | 'pro' } & Confirmed): Promise<ManagedLineOffer> {
    return (await this.http.post<ManagedLineOffer>('/voice/managed/subscribe', params)).payload!;
  }

  async changeManagedPlan(params: { plan: 'basic' | 'pro' } & Confirmed): Promise<ManagedLineOffer> {
    return (await this.http.post<ManagedLineOffer>('/voice/managed/change', params)).payload!;
  }

  async cancelManaged(confirm: Confirmed): Promise<ManagedLineOffer> {
    return (await this.http.post<ManagedLineOffer>('/voice/managed/cancel', confirm)).payload!;
  }

  async switchManagedToOwn(confirm: Confirmed): Promise<ManagedLineOffer> {
    return (await this.http.post<ManagedLineOffer>('/voice/managed/switch-to-own', confirm)).payload!;
  }

  async readyNumbers(): Promise<{ numbers: Array<Record<string, unknown>>; included: boolean }> {
    return (await this.http.get<{ numbers: Array<Record<string, unknown>>; included: boolean }>('/voice/managed/ready-numbers')).payload!;
  }

  /** Take a ready number (extra numbers beyond the plan are charged monthly). */
  async claimReadyNumber(params: { phoneNumber: string; agentId?: string } & Confirmed): Promise<Record<string, unknown>> {
    return (await this.http.post<Record<string, unknown>>('/voice/managed/ready-numbers/claim', params)).payload!;
  }
}
