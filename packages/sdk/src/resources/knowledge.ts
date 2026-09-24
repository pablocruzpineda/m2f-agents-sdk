import type { HttpClient } from '../http.js';
import type {
  KnowledgeDocument,
  KnowledgeEntityDetail,
  KnowledgeFact,
  KnowledgeGraph,
  KnowledgeJob,
  KnowledgeManualCreateParams,
  KnowledgeManualEntry,
  KnowledgeSource,
  KnowledgeSourceCreateParams,
  KnowledgeUsage,
} from '../types.js';

/**
 * GraphOS knowledge graph: query facts, manage data sources and ingestion.
 *
 * Requires the knowledge:read scope (queries, browsing) and knowledge:write
 * (sources, sync, manual facts). The account needs its own OpenAI key
 * configured in the dashboard — extraction and search bill to it (BYOK).
 */
export class KnowledgeResource {
  constructor(private readonly http: HttpClient) {}

  /** Ask the knowledge graph a natural-language question; returns temporal facts. */
  async query(query: string, options: { numResults?: number } = {}): Promise<KnowledgeFact[]> {
    const res = await this.http.post<{ query: string; results: KnowledgeFact[] }>(
      '/knowledge/query',
      { query, num_results: options.numResults ?? 10 },
      { timeoutMs: 90_000 }
    );
    return res.payload?.results ?? [];
  }

  /** Mark a fact as incorrect — agents stop using it, history is preserved. */
  async invalidateFact(uuid: string): Promise<void> {
    await this.http.post(`/knowledge/facts/${uuid}/invalidate`);
  }

  /** Get the entity/fact graph (top-N seed, name search, or center-expand). */
  async getGraph(
    options: { q?: string; center?: string; limit?: number; includeSources?: boolean } = {}
  ): Promise<KnowledgeGraph> {
    const res = await this.http.get<KnowledgeGraph>('/knowledge/graph', {
      query: {
        q: options.q,
        center: options.center,
        limit: options.limit,
        include_sources: options.includeSources,
      },
    });
    return res.payload ?? { nodes: [], edges: [] };
  }

  /** Get one entity with its fact timeline. */
  async getEntity(uuid: string): Promise<KnowledgeEntityDetail> {
    const res = await this.http.get<KnowledgeEntityDetail>(`/knowledge/graph/entity/${uuid}`);
    return res.payload!;
  }

  /** List data sources. */
  async listSources(): Promise<KnowledgeSource[]> {
    const res = await this.http.get<KnowledgeSource[]>('/knowledge/sources');
    return res.payload ?? [];
  }

  /** Register a data source (file, rest, sql or composio). */
  async createSource(params: KnowledgeSourceCreateParams): Promise<KnowledgeSource> {
    const res = await this.http.post<KnowledgeSource>('/knowledge/sources', params);
    return res.payload!;
  }

  /** Get a data source. */
  async getSource(sourceId: string): Promise<KnowledgeSource> {
    const res = await this.http.get<KnowledgeSource>(`/knowledge/sources/${sourceId}`);
    return res.payload!;
  }

  /** Delete a source. WARNING: purges its episodes and derived knowledge from the graph. */
  async deleteSource(sourceId: string): Promise<void> {
    await this.http.delete(`/knowledge/sources/${sourceId}`);
  }

  /** List a source's documents. */
  async listDocuments(sourceId: string): Promise<KnowledgeDocument[]> {
    const res = await this.http.get<KnowledgeDocument[]>(`/knowledge/sources/${sourceId}/documents`);
    return res.payload ?? [];
  }

  /** Start an ingestion sync (unchanged documents are skipped). */
  async syncSource(sourceId: string): Promise<KnowledgeJob> {
    const res = await this.http.post<KnowledgeJob>(`/knowledge/sources/${sourceId}/sync`);
    return res.payload!;
  }

  /** List ingestion jobs. */
  async listJobs(): Promise<KnowledgeJob[]> {
    const res = await this.http.get<KnowledgeJob[]>('/knowledge/jobs');
    return res.payload ?? [];
  }

  /** Get one ingestion job (poll this after syncSource). */
  async getJob(jobId: string): Promise<KnowledgeJob> {
    const res = await this.http.get<KnowledgeJob>(`/knowledge/jobs/${jobId}`);
    return res.payload!;
  }

  /** List manual knowledge entries. */
  async listManual(): Promise<KnowledgeManualEntry[]> {
    const res = await this.http.get<KnowledgeManualEntry[]>('/knowledge/manual');
    return res.payload ?? [];
  }

  /** Declare a business fact, optionally with a validity window. */
  async addManual(params: KnowledgeManualCreateParams): Promise<KnowledgeManualEntry> {
    const res = await this.http.post<KnowledgeManualEntry>('/knowledge/manual', {
      statement: params.statement,
      valid_from: params.valid_from ?? null,
      valid_until: params.valid_until ?? null,
    });
    return res.payload!;
  }

  /** Remove a manual entry (deletes its facts from the graph). */
  async deleteManual(entryId: string): Promise<void> {
    await this.http.delete(`/knowledge/manual/${entryId}`);
  }

  /** Usage metrics: totals, monthly episodes/queries, and the cost-control limit. */
  async getUsage(options: { months?: number } = {}): Promise<KnowledgeUsage> {
    const res = await this.http.get<KnowledgeUsage>('/knowledge/usage', {
      query: { months: options.months },
    });
    return res.payload!;
  }

  /** Set (or clear with null) the monthly episode ingestion cap. */
  async setMonthlyLimit(limit: number | null): Promise<void> {
    await this.http.post('/knowledge/usage/limit', { monthly_episode_limit: limit });
  }

  /** Check whether the account has the OpenAI key Knowledge requires (BYOK). */
  async keyStatus(): Promise<{ hasKey: boolean; provider: string }> {
    const res = await this.http.get<{ hasKey: boolean; provider: string }>('/knowledge/key-status');
    return res.payload!;
  }
}
