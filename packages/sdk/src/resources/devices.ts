import type { HttpClient } from '../http.js';
import type {
  Device, DeviceCreateParams, MetaBusinessProfileUpdate, MetaInspection,
  WhatsAppLinkStatus, WhatsAppPairing, WhatsAppPairingStatus,
} from '../types.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const seg = encodeURIComponent;

export class DevicesResource {
  constructor(private readonly http: HttpClient) {}

  /** List all devices in your account. */
  async list(): Promise<Device[]> {
    const res = await this.http.get<{ devices: Device[] }>('/devices');
    return res.payload?.devices ?? [];
  }

  /** List devices not yet assigned to an agent or crew. */
  async listAvailable(): Promise<Device[]> {
    const res = await this.http.get<{ devices: Device[] }>('/devices/available');
    return res.payload?.devices ?? [];
  }

  /** Get a single device by id. */
  async get(deviceId: string): Promise<Device> {
    const res = await this.http.get<{ device: Device }>(`/devices/${deviceId}`);
    return res.payload!.device;
  }

  /** Create a new device. */
  async create(params: DeviceCreateParams): Promise<Device> {
    const res = await this.http.post<{ device: Device }>('/devices', params);
    return res.payload!.device;
  }

  /** Update an existing device. */
  async update(deviceId: string, params: Partial<DeviceCreateParams>): Promise<Device> {
    const res = await this.http.patch<{ device: Device }>(`/devices/${deviceId}`, params);
    return res.payload!.device;
  }

  /** Delete a device. */
  async delete(deviceId: string): Promise<void> {
    await this.http.delete(`/devices/${deviceId}`);
  }

  /** Mark a device connected/disconnected. */
  async setConnection(deviceId: string, isConnected: boolean): Promise<Device> {
    const res = await this.http.patch<{ device: Device }>(`/devices/${deviceId}/connection`, {
      isConnected,
    });
    return res.payload!.device;
  }

  // ── Linking WhatsApp ──────────────────────────────────────

  /** Start linking: a QR (data URL) to scan, or with `phoneNumber` a pairing code to type. Then waitForPairing(). */
  async startPairing(deviceId: string, options: { phoneNumber?: string } = {}): Promise<WhatsAppPairing> {
    return (await this.http.post<WhatsAppPairing>(`/devices/${seg(deviceId)}/whatsapp/pair`, options)).payload!;
  }

  async pairingStatus(deviceId: string, pairingId: string): Promise<WhatsAppPairingStatus> {
    return (await this.http.get<WhatsAppPairingStatus>(`/devices/${seg(deviceId)}/whatsapp/pair/${seg(pairingId)}`)).payload!;
  }

  /** A new QR when the previous one expired (~20 s). */
  async refreshQr(deviceId: string, pairingId: string): Promise<{ pairingId: string; qr: string }> {
    return (await this.http.post<{ pairingId: string; qr: string }>(`/devices/${seg(deviceId)}/whatsapp/pair/${seg(pairingId)}/qr`)).payload!;
  }

  async cancelPairing(deviceId: string, pairingId: string): Promise<{ cancelled: boolean }> {
    return (await this.http.delete<{ cancelled: boolean }>(`/devices/${seg(deviceId)}/whatsapp/pair/${seg(pairingId)}`)).payload!;
  }

  /**
   * Poll until the phone links (the connection is recorded then). `onQr` gets a
   * fresh QR whenever the previous one expires; times out after 3 minutes.
   */
  async waitForPairing(
    deviceId: string,
    pairing: WhatsAppPairing,
    options: { intervalMs?: number; timeoutMs?: number; qrEveryMs?: number; onQr?: (qr: string) => void } = {}
  ): Promise<WhatsAppPairingStatus> {
    const deadline = Date.now() + (options.timeoutMs ?? 180_000);
    let lastQr = Date.now();
    for (;;) {
      const status = await this.pairingStatus(deviceId, pairing.pairingId);
      if (status.connected) return status;
      if (Date.now() > deadline) throw new Error(`The phone did not link within ${(options.timeoutMs ?? 180_000) / 1000}s`);
      if (pairing.method === 'qr' && options.onQr && Date.now() - lastQr > (options.qrEveryMs ?? 20_000)) {
        options.onQr((await this.refreshQr(deviceId, pairing.pairingId)).qr);
        lastQr = Date.now();
      }
      await sleep(options.intervalMs ?? 3_000);
    }
  }

  async whatsappStatus(deviceId: string): Promise<WhatsAppLinkStatus> {
    return (await this.http.get<WhatsAppLinkStatus>(`/devices/${seg(deviceId)}/whatsapp`)).payload!;
  }

  /** Unlink the number (for Meta, the stored token is deleted too). */
  async disconnectWhatsApp(deviceId: string, confirm: { confirm: true }): Promise<{ disconnected: boolean; channel: string; instanceRemoved: boolean; warning?: string }> {
    return (await this.http.request<{ disconnected: boolean; channel: string; instanceRemoved: boolean; warning?: string }>('DELETE', `/devices/${seg(deviceId)}/whatsapp`, { body: confirm })).payload!;
  }

  /** The device's send URL: other systems POST { phoneNumber, message } to it. */
  async setSendEndpoint(deviceId: string): Promise<{ url: string }> {
    return (await this.http.post<{ url: string }>(`/devices/${seg(deviceId)}/send-endpoint`)).payload!;
  }

  async removeSendEndpoint(deviceId: string): Promise<{ removed: boolean }> {
    return (await this.http.delete<{ removed: boolean }>(`/devices/${seg(deviceId)}/send-endpoint`)).payload!;
  }

  // ── Meta (WhatsApp Cloud API) ─────────────────────────────

  async metaSavedAccounts(): Promise<Array<Record<string, unknown>>> {
    return (await this.http.get<Array<Record<string, unknown>>>('/devices/whatsapp-cloud/saved-accounts')).payload ?? [];
  }

  /** Step 1: what a token can reach (or a saved account, with savedAppId). Changes nothing. */
  async metaInspect(params: { accessToken?: string; appSecret?: string; wabaId?: string; savedAppId?: string }): Promise<MetaInspection> {
    return (await this.http.post<MetaInspection>('/devices/whatsapp-cloud/inspect', params)).payload!;
  }

  /** Step 2: connect the chosen number; Meta is configured for it. */
  async metaConnectAuto(deviceId: string, params: { inspectionId: string; phoneNumberId: string; pin?: string; overwriteWebhook?: boolean }): Promise<Record<string, unknown>> {
    return (await this.http.post<Record<string, unknown>>(`/devices/${seg(deviceId)}/whatsapp-cloud/auto`, params)).payload!;
  }

  async metaConnectManual(deviceId: string, params: { phoneNumberId: string; wabaId: string; accessToken: string; appSecret?: string }): Promise<Record<string, unknown>> {
    return (await this.http.post<Record<string, unknown>>(`/devices/${seg(deviceId)}/whatsapp-cloud`, params)).payload!;
  }

  /** Setup checks, quality rating and messaging limit. Never the token. */
  async metaStatus(deviceId: string): Promise<Record<string, unknown>> {
    return (await this.http.get<Record<string, unknown>>(`/devices/${seg(deviceId)}/whatsapp-cloud`)).payload!;
  }

  async metaTemplates(deviceId: string, options: { refresh?: boolean } = {}): Promise<Record<string, unknown>> {
    return (await this.http.get<Record<string, unknown>>(`/devices/${seg(deviceId)}/whatsapp-cloud/templates`, { query: { refresh: options.refresh ? 'true' : undefined } })).payload!;
  }

  async metaProfile(deviceId: string): Promise<Record<string, unknown>> {
    return (await this.http.get<Record<string, unknown>>(`/devices/${seg(deviceId)}/whatsapp-cloud/profile`)).payload!;
  }

  async updateMetaProfile(deviceId: string, patch: MetaBusinessProfileUpdate): Promise<Record<string, unknown>> {
    return (await this.http.put<Record<string, unknown>>(`/devices/${seg(deviceId)}/whatsapp-cloud/profile`, patch)).payload!;
  }
}
