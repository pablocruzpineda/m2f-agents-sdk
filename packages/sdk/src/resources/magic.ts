import type { HttpClient } from '../http.js';

type Json = Record<string, unknown>;
export type MagicItem = { resourceType: 'agent'; agentId: string; displayOrder?: number }
  | { resourceType: 'crew'; crewId: string; displayOrder?: number }
  | { resourceType: 'custom_tool'; customToolId: string; displayOrder?: number };
export interface MagicPackageFields {
  name?: string;
  description?: string;
  targetAccountId?: string;
  targetSubaccountId?: string;
  /** Credits each signup gets from your balance; > 0 needs confirm: true. */
  initialCredits?: number;
  maxRedemptions?: number;
  expiresAt?: string | null;
  confirm?: true;
}
export interface MagicLinkFields { customLabel?: string; maxRedemptions?: number; expiresAt?: string | null; isActive?: boolean }
export type MagicLink = Json & { id: string; code: string; url: string };

/** TENANTS: Magic packages, their signup links and redemptions. */
export class MagicResource {
  constructor(private readonly http: HttpClient) {}

  async listPackages(): Promise<Json[]> { return (await this.http.get<Json[]>('/magic/packages')).payload!; }
  async getPackage(packageId: string): Promise<Json> { return (await this.http.get<Json>(`/magic/packages/${encodeURIComponent(packageId)}`)).payload!; }
  async createPackage(fields: MagicPackageFields & { name: string; slug?: string; items?: MagicItem[] }): Promise<Json> { return (await this.http.post<Json>('/magic/packages', fields)).payload!; }
  async updatePackage(packageId: string, fields: MagicPackageFields & { isActive?: boolean }): Promise<Json> { return (await this.http.patch<Json>(`/magic/packages/${encodeURIComponent(packageId)}`, fields)).payload!; }
  async deletePackage(packageId: string, confirm: { confirm: true }): Promise<unknown> { return (await this.http.request<unknown>('DELETE', `/magic/packages/${encodeURIComponent(packageId)}`, { body: confirm })).payload; }

  async addItem(packageId: string, item: MagicItem): Promise<Json> { return (await this.http.post<Json>(`/magic/packages/${encodeURIComponent(packageId)}/items`, item)).payload!; }
  async removeItem(packageId: string, itemId: string): Promise<unknown> { return (await this.http.delete<unknown>(`/magic/packages/${encodeURIComponent(packageId)}/items/${encodeURIComponent(itemId)}`)).payload; }
  async reorderItems(packageId: string, itemIds: string[]): Promise<unknown> { return (await this.http.put<unknown>(`/magic/packages/${encodeURIComponent(packageId)}/items/order`, { itemIds })).payload; }

  async listLinks(packageId: string): Promise<MagicLink[]> { return (await this.http.get<MagicLink[]>(`/magic/packages/${encodeURIComponent(packageId)}/links`)).payload!; }
  /** A new signup link; `url` is what you share. */
  async createLink(packageId: string, fields: Omit<MagicLinkFields, 'isActive'> = {}): Promise<MagicLink> { return (await this.http.post<MagicLink>(`/magic/packages/${encodeURIComponent(packageId)}/links`, fields)).payload!; }
  async updateLink(linkId: string, fields: MagicLinkFields): Promise<MagicLink> { return (await this.http.patch<MagicLink>(`/magic/links/${encodeURIComponent(linkId)}`, fields)).payload!; }
  async deleteLink(linkId: string, confirm: { confirm: true }): Promise<unknown> { return (await this.http.request<unknown>('DELETE', `/magic/links/${encodeURIComponent(linkId)}`, { body: confirm })).payload; }

  async packageRedemptions(packageId: string): Promise<Json[]> { return (await this.http.get<Json[]>(`/magic/packages/${encodeURIComponent(packageId)}/redemptions`)).payload!; }
  async linkRedemptions(linkId: string): Promise<Json[]> { return (await this.http.get<Json[]>(`/magic/links/${encodeURIComponent(linkId)}/redemptions`)).payload!; }
}
