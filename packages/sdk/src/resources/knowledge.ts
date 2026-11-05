import type { HttpClient } from '../http.js';
import { M2FError } from '../errors.js';
import { fileForm, type UploadData } from '../upload.js';
import type {
  KnowledgeDocument,
  KnowledgeExactValue,
  KnowledgeRecord,
  KnowledgeRecords,
  KnowledgeRecordsQuery,
  KnowledgeSchemaConfirmation,
  KnowledgeTabularSchema,
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

export type { UploadData } from '../upload.js';
const seg = (value: string) => encodeURIComponent(value);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GraphOS knowledge graph: query facts, manage data sources and ingestion.
 *
 * Requires the knowledge:read scope (queries, browsing) and knowledge:write
 * (sources, sync, manual facts). The account needs its own OpenAI key
 * configured in the dashboard — extraction and search bill to it (BYOK).
 */
export class KnowledgeResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * The same calls inside one of your agents' own graph instead of the shared one:
   * `m2f.knowledge.forAgent(agentId).createSource(...)`, `.uploadDocument(...)`, `.syncSource(...)`,
   * `.query(...)`, records, column mappings, manual facts. A file uploaded there is recorded on the
   * agent, which is what makes the agent read its own graph; deleting a source there removes it.
   */
  forAgent(agentId: string): KnowledgeResource {
    return new KnowledgeResource(this.http.withQuery({ agentId }));
  }

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

  // ── Files and spreadsheets ────────────────────────────────

  /**
   * Upload a document to a "file" source (multipart). Documents come back
   * `pending` — then call syncSource. Spreadsheets (Excel/CSV) come back
   * `needs_mapping` — confirm their columns with confirmSchema first.
   *
   * In Node: `uploadDocument(id, await fs.promises.readFile(path), 'catalogo.xlsx')`.
   */
  async uploadDocument(
    sourceId: string,
    data: UploadData,
    filename: string,
    options: { contentType?: string } = {}
  ): Promise<KnowledgeDocument> {
    const form = fileForm(data, filename, options.contentType);
    const res = await this.http.post<KnowledgeDocument>(`/knowledge/sources/${seg(sourceId)}/upload`, form, {
      timeoutMs: 180_000,
    });
    return res.payload!;
  }

  /** Column mappings of a source's spreadsheets — proposed (confirmed: false), confirmed, or drifted. */
  async listSchemas(sourceId: string): Promise<KnowledgeTabularSchema[]> {
    const res = await this.http.get<KnowledgeTabularSchema[]>(`/knowledge/sources/${seg(sourceId)}/schemas`);
    return res.payload ?? [];
  }

  /** One file's column mapping, or null when GraphOS has none for it. */
  async getSchema(sourceId: string, filename: string): Promise<KnowledgeTabularSchema | null> {
    return (await this.listSchemas(sourceId)).find((s) => s.filename === filename) ?? null;
  }

  /**
   * Confirm a spreadsheet's column mapping, releasing it for ingestion (then
   * call syncSource). Start from getSchema() and send every column back.
   */
  async confirmSchema(
    sourceId: string,
    filename: string,
    mapping: KnowledgeSchemaConfirmation
  ): Promise<KnowledgeTabularSchema> {
    const res = await this.http.put<KnowledgeTabularSchema>(
      `/knowledge/sources/${seg(sourceId)}/schemas/${seg(filename)}`,
      {
        columns: mapping.columns.map(({ header, field, type, include }) => ({ header, field, type, include })),
        name_field: mapping.name_field,
        entity_type: mapping.entity_type,
      }
    );
    return res.payload!;
  }

  /** Process one document again from scratch (bills extraction again). Then call syncSource. */
  async reingestDocument(sourceId: string, filename: string): Promise<{ reingesting: number; filename: string }> {
    const res = await this.http.post<{ reingesting: number; filename: string }>(
      `/knowledge/sources/${seg(sourceId)}/documents/${seg(filename)}/reingest`
    );
    return res.payload!;
  }

  /**
   * Poll an ingestion job until it completes or fails. Throws M2FError on
   * timeout (default 10 minutes); a failed job is returned, not thrown.
   */
  async waitForJob(
    jobId: string,
    options: { intervalMs?: number; timeoutMs?: number; onPoll?: (job: KnowledgeJob) => void } = {}
  ): Promise<KnowledgeJob> {
    const intervalMs = options.intervalMs ?? 3_000;
    const deadline = Date.now() + (options.timeoutMs ?? 600_000);
    for (;;) {
      const job = await this.getJob(jobId);
      options.onPoll?.(job);
      if (job.status === 'completed' || job.status === 'failed') return job;
      if (Date.now() + intervalMs > deadline) {
        throw new M2FError(`Ingestion job ${jobId} still ${job.status} after ${options.timeoutMs ?? 600_000}ms`, 0, job);
      }
      await sleep(intervalMs);
    }
  }

  // ── Exact values and records ──────────────────────────────

  /** The exact values the graph stores for item names (prices, stock…) — what agents quote. Max 50 names. */
  async exactValues(names: string[]): Promise<KnowledgeExactValue[]> {
    const res = await this.http.post<{ results: KnowledgeExactValue[] }>('/knowledge/exact-values', { names });
    return res.payload?.results ?? [];
  }

  /** Spreadsheet rows stored in the graph, as a table. */
  async listRecords(query: KnowledgeRecordsQuery = {}): Promise<KnowledgeRecords> {
    const res = await this.http.get<KnowledgeRecords>('/knowledge/records', {
      query: { label: query.label, q: query.q, limit: query.limit, offset: query.offset },
    });
    return res.payload ?? { columns: [], rows: [], total: 0 };
  }

  /** Add one row by hand. */
  async createRecord(params: { name: string; values?: Record<string, unknown> }): Promise<KnowledgeRecord> {
    const res = await this.http.post<KnowledgeRecord>('/knowledge/records', { name: params.name, values: params.values ?? {} });
    return res.payload!;
  }

  /** Correct one row: a partial patch (null clears a cell). */
  async updateRecord(uuid: string, patch: { name?: string; values?: Record<string, unknown> }): Promise<KnowledgeRecord> {
    const res = await this.http.patch<KnowledgeRecord>(`/knowledge/records/${seg(uuid)}`, patch);
    return res.payload!;
  }

  /** Remove one row (re-ingesting its source brings it back). */
  async deleteRecord(uuid: string): Promise<void> {
    await this.http.delete(`/knowledge/records/${seg(uuid)}`);
  }

  /** The agents that have a graph of their own besides the shared one. */
  async listNamespaces(): Promise<Array<{ namespace: string; agent_id: string; source_count: number }>> {
    return (await this.http.get<Array<{ namespace: string; agent_id: string; source_count: number }>>('/knowledge/graph/namespaces')).payload ?? [];
  }

  /** How much is in the graph, by type — the shared graph, or one agent's own with `agentId`. */
  async graphSummary(options: { agentId?: string } = {}): Promise<Record<string, unknown>> {
    return (await this.http.get<Record<string, unknown>>('/knowledge/graph/summary', { query: { agentId: options.agentId } })).payload!;
  }
}
