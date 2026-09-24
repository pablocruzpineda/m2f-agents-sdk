import type { HttpClient } from '../http.js';
import type { Voice, VoiceCall, VoiceCallParams, VoiceCallStarted, VoiceLine, VoiceLineUpdate, VoicePricing } from '../types.js';

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
}
