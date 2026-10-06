import type { HttpClient } from '../http.js';
import type { PanelSendParams, PanelSendResult, PanelSubscription } from '../types.js';

/**
 * For external panels — a CRM, a shared inbox, a dashboard — working with a
 * WhatsApp device of the account.
 *
 * Subscribe once with the URL of your webhook; from then on every message
 * the device receives or sends (agent replies included), every delivery
 * status and every connection change is POSTed there as a `PanelEvent`,
 * signed. Verify each delivery with `verifyPanelWebhook`. A message can
 * arrive more than once (always with the same `message.id`): store it once.
 *
 * A number is answered either by people through your panel (`inbox`) or by a
 * Mind2Flow agent the panel follows (`agent`): `subscribe()` says which.
 */
export class PanelsResource {
  constructor(private readonly http: HttpClient) {}

  /** Subscribe (or re-point) a device to your webhook. Returns the signing secret. */
  async subscribe(deviceId: string, url: string): Promise<PanelSubscription> {
    const res = await this.http.put<PanelSubscription>(`/panels/devices/${deviceId}/webhook`, { url });
    return res.payload!;
  }

  /** The device's current subscription, or null when it has none. */
  async getSubscription(deviceId: string): Promise<PanelSubscription | null> {
    const res = await this.http.get<PanelSubscription | null>(`/panels/devices/${deviceId}/webhook`);
    return res.payload ?? null;
  }

  /** Stop receiving the device's events. */
  async unsubscribe(deviceId: string): Promise<void> {
    await this.http.delete(`/panels/devices/${deviceId}/webhook`);
  }

  /**
   * Send a WhatsApp message through the device. On official Cloud API numbers
   * a free-form message only reaches a contact within 24 hours of their last
   * one (M2FError 409); send a template outside that window.
   */
  async sendMessage(deviceId: string, params: PanelSendParams): Promise<PanelSendResult> {
    const res = await this.http.post<unknown>(`/panels/devices/${deviceId}/messages`, params, { timeoutMs: 90_000 });
    return { messageType: params.messageType ?? 'text', payload: res.payload };
  }
}

export interface PanelWebhookVerification {
  /** The subscription's secret (whsec_…). */
  secret: string;
  /** The request body exactly as received — verify before parsing it. */
  body: string;
  /** `X-M2F-Signature` header. */
  signature: string | null | undefined;
  /** `X-M2F-Timestamp` header. */
  timestamp: string | null | undefined;
  /** Reject deliveries older or newer than this many seconds (default 300). */
  toleranceSeconds?: number;
}

/** The two Web Crypto calls an HMAC needs, spelled out so the SDK asks nothing of the host's type definitions. */
interface HmacCrypto {
  importKey(format: 'raw', key: Uint8Array, algorithm: { name: 'HMAC'; hash: 'SHA-256' }, extractable: false, usages: ['sign']): Promise<unknown>;
  sign(algorithm: 'HMAC', key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
}

async function webCrypto(): Promise<HmacCrypto> {
  // Web Crypto is a global in Deno, edge runtimes and Node 20+; Node 18 only has it on its crypto module.
  const global = (globalThis as { crypto?: { subtle?: HmacCrypto } }).crypto?.subtle;
  if (global) return global;
  // Named through a variable so bundlers for non-Node targets do not try to resolve it.
  const nodeModule = 'node:crypto';
  const { webcrypto } = (await import(nodeModule)) as { webcrypto: { subtle: HmacCrypto } };
  return webcrypto.subtle;
}

const toHex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Whether a webhook delivery really comes from Mind2Flow. Runs anywhere Web
 * Crypto exists (Node 18+, Deno, edge functions).
 *
 * ```ts
 * const body = await req.text();
 * const ok = await verifyPanelWebhook({
 *   secret,
 *   body,
 *   signature: req.headers.get('x-m2f-signature'),
 *   timestamp: req.headers.get('x-m2f-timestamp'),
 * });
 * if (!ok) return new Response('invalid signature', { status: 401 });
 * const event = JSON.parse(body) as PanelEvent;
 * ```
 */
export async function verifyPanelWebhook(input: PanelWebhookVerification): Promise<boolean> {
  const { secret, body, signature, timestamp } = input;
  if (!secret || !signature || !timestamp || !/^\d+$/.test(timestamp)) return false;

  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerance) return false;

  const crypto = await webCrypto();
  const encoder = new TextEncoder();
  const key = await crypto.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = `sha256=${toHex(await crypto.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`)))}`;

  // Compare every character regardless of where the first difference is.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
