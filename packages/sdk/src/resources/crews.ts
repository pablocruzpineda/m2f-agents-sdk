import type { HttpClient } from '../http.js';
import type { Crew, CrewCreateParams, CrewExecution, Pagination } from '../types.js';

export class CrewsResource {
  constructor(private readonly http: HttpClient) {}

  /** List all crews in your account. */
  async list(): Promise<Crew[]> {
    const res = await this.http.get<{ crews: Crew[] }>('/crews');
    return res.payload?.crews ?? [];
  }

  /** Get a single crew by id. */
  async get(crewId: string): Promise<Crew> {
    const res = await this.http.get<{ crew: Crew }>(`/crews/${crewId}`);
    return res.payload!.crew;
  }

  /** Create a new crew (multi-agent workflow). */
  async create(params: CrewCreateParams): Promise<Crew> {
    const res = await this.http.post<{ crew: Crew }>('/crews', params);
    return res.payload!.crew;
  }

  /** Update an existing crew. */
  async update(crewId: string, params: Partial<CrewCreateParams>): Promise<Crew> {
    const res = await this.http.patch<{ crew: Crew }>(`/crews/${crewId}`, params);
    return res.payload!.crew;
  }

  /** Delete a crew. */
  async delete(crewId: string): Promise<void> {
    await this.http.delete(`/crews/${crewId}`);
  }

  /** Execute a crew with optional input data. */
  async execute(crewId: string, input?: unknown): Promise<CrewExecution> {
    const res = await this.http.post<{ execution: CrewExecution }>(
      `/crews/${crewId}/executions`,
      { input },
      { timeoutMs: 300_000 }
    );
    return res.payload!.execution;
  }

  /** List a crew's executions. */
  async executions(
    crewId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ executions: CrewExecution[]; pagination?: Pagination }> {
    const res = await this.http.get<{ executions: CrewExecution[]; pagination?: Pagination }>(
      `/crews/${crewId}/executions`,
      { query: { limit: options.limit, offset: options.offset } }
    );
    return res.payload ?? { executions: [] };
  }

  /** Get one crew execution (poll this for status/result). */
  async getExecution(crewId: string, executionId: string): Promise<CrewExecution> {
    const res = await this.http.get<{ execution: CrewExecution }>(
      `/crews/${crewId}/executions/${executionId}`
    );
    return res.payload!.execution;
  }

  /** Assign a device to a crew. */
  async assignDevice(crewId: string, deviceId: string): Promise<void> {
    await this.http.post(`/crews/${crewId}/devices/${deviceId}`);
  }

  /** Unassign a device from a crew. */
  async unassignDevice(crewId: string, deviceId: string): Promise<void> {
    await this.http.delete(`/crews/${crewId}/devices/${deviceId}`);
  }
}
