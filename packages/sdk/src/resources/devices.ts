import type { HttpClient } from '../http';
import type { Device, DeviceCreateParams } from '../types';

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
}
