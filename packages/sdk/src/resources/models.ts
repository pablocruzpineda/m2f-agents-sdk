import type { HttpClient } from '../http.js';

export interface ProviderModel {
  id: string;
  name: string;
  [key: string]: unknown;
}

/** The model catalog the console's model picker shows. */
export class ModelsResource {
  constructor(private readonly http: HttpClient) {}

  /** Providers an agent can use, and whether each needs a key on the account. */
  async providers(): Promise<Array<{ provider: string; needsKey: boolean }>> {
    return (await this.http.get<Array<{ provider: string; needsKey: boolean }>>('/models/providers')).payload ?? [];
  }

  /** Model ids a provider offers (read with the account's own key), for an agent's `models`. */
  async list(provider: string, options: { search?: string } = {}): Promise<ProviderModel[]> {
    return (await this.http.get<ProviderModel[]>(`/models/${encodeURIComponent(provider)}`, { query: { search: options.search } })).payload ?? [];
  }

  /** What each model can do (tool calls, reasoning, vision, audio input, image output, search, streaming). Up to 50 ids. */
  async capabilities(models: string[]): Promise<Array<{ modelId: string; known: boolean; capabilities: Record<string, unknown> | null }>> {
    return (await this.http.post<Array<{ modelId: string; known: boolean; capabilities: Record<string, unknown> | null }>>('/models/capabilities', { models })).payload ?? [];
  }
}
