import type { HttpClient } from '../http';
import type {
  Artifact,
  ArtifactCreateParams,
  ArtifactShare,
  ArtifactSummary,
} from '../types';

/**
 * Artifacts: documents built from typed blocks — reports, test runs, prompt
 * changes. Their figures come from data sources the server resolves from the
 * database as you, never from typed numbers. Versioned, and shareable by a
 * public link that hides end customers' details by default.
 */
export class ArtifactsResource {
  constructor(private readonly http: HttpClient) {}

  /** Latest version of each artifact, newest first. */
  async list(options: { agentId?: string; kind?: string; limit?: number } = {}): Promise<ArtifactSummary[]> {
    const res = await this.http.get<{ artifacts: ArtifactSummary[] }>('/artifacts', {
      query: { agentId: options.agentId, kind: options.kind, limit: options.limit },
    });
    return res.payload?.artifacts ?? [];
  }

  /** One artifact (any version), with the list of its versions. */
  async get(id: string): Promise<Artifact> {
    const res = await this.http.get<Artifact>(`/artifacts/${id}`);
    return res.payload!;
  }

  /**
   * Create from your own blocks and sources, or from a template
   * (`{ template: 'operation_report', agentId }`). An `analysis` source — and
   * the operation report — run an LLM on your own key.
   */
  async create(params: ArtifactCreateParams): Promise<Artifact> {
    const res = await this.http.post<Artifact>('/artifacts', params);
    return res.payload!;
  }

  /** Resolve the data again. Returns the new version; the old one is kept. */
  async refresh(id: string): Promise<Artifact> {
    const res = await this.http.post<Artifact>(`/artifacts/${id}/refresh`);
    return res.payload!;
  }

  async rename(id: string, title: string): Promise<Artifact> {
    const res = await this.http.patch<Artifact>(`/artifacts/${id}`, { title });
    return res.payload!;
  }

  /** Archive every version and revoke the public link. */
  async archive(id: string): Promise<Artifact> {
    const res = await this.http.patch<Artifact>(`/artifacts/${id}`, { archived: true });
    return res.payload!;
  }

  /**
   * Public link: `<app>/a/<token>`, the latest version, no sign-in. Internal
   * ids are always removed; with `redact` (default) customers' names, phones
   * and emails are replaced too.
   */
  async share(id: string, options: { redact?: boolean; expiresInDays?: number | null } = {}): Promise<ArtifactShare> {
    const res = await this.http.post<ArtifactShare>(`/artifacts/${id}/share`, options);
    return res.payload!;
  }

  async unshare(id: string): Promise<void> {
    await this.http.delete(`/artifacts/${id}/share`);
  }
}
