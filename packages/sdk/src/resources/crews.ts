import type { HttpClient } from '../http.js';
import type {
  CompiledCrew,
  Crew,
  CrewBlueprint,
  CrewBlueprintTeam,
  CrewCreateParams,
  CrewExecution,
  CrewRunResult,
  Pagination,
} from '../types.js';

export interface BlueprintOptions {
  /** Validate and compile only: nothing is created or changed. */
  dryRun?: boolean;
}

export interface CreateTeamParams extends CrewBlueprintTeam {
  name: string;
  description?: string;
}

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

  /**
   * Create a crew from a blueprint: steps, teams, if/switch branches, API and WhatsApp
   * sends, compiled by the server into the same flow and diagram the builder draws.
   * A blueprint with problems throws an M2FError whose `errors` lists all of them.
   * With `dryRun`, returns the compiled crew without creating it.
   */
  async createFromBlueprint(blueprint: CrewBlueprint, options: BlueprintOptions & { dryRun: true }): Promise<CompiledCrew>;
  async createFromBlueprint(blueprint: CrewBlueprint, options?: BlueprintOptions): Promise<Crew>;
  async createFromBlueprint(blueprint: CrewBlueprint, options: BlueprintOptions = {}): Promise<Crew | CompiledCrew> {
    const res = await this.http.post<{ crew: Crew | CompiledCrew }>(
      '/crews/blueprint',
      { blueprint },
      { query: { dryRun: options.dryRun || undefined } }
    );
    return res.payload!.crew;
  }

  /** Replace a crew's steps, diagram, agents and settings with a blueprint. */
  async updateFromBlueprint(crewId: string, blueprint: CrewBlueprint, options: BlueprintOptions & { dryRun: true }): Promise<CompiledCrew>;
  async updateFromBlueprint(crewId: string, blueprint: CrewBlueprint, options?: BlueprintOptions): Promise<Crew>;
  async updateFromBlueprint(crewId: string, blueprint: CrewBlueprint, options: BlueprintOptions = {}): Promise<Crew | CompiledCrew> {
    const res = await this.http.put<{ crew: Crew | CompiledCrew }>(
      `/crews/${crewId}/blueprint`,
      { blueprint },
      { query: { dryRun: options.dryRun || undefined } }
    );
    return res.payload!.crew;
  }

  /** Create a crew that is one orchestrator (the lead) and its team of 1–5 agents. */
  async createTeam(params: CreateTeamParams, options: BlueprintOptions & { dryRun: true }): Promise<CompiledCrew>;
  async createTeam(params: CreateTeamParams, options?: BlueprintOptions): Promise<Crew>;
  async createTeam(params: CreateTeamParams, options: BlueprintOptions = {}): Promise<Crew | CompiledCrew> {
    const { name, description, ...team } = params;
    return this.createFromBlueprint({ name, description, team }, options);
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

  /**
   * Run a crew and wait for it (up to ~5 minutes). The execution's `result` holds the
   * final answer, every step (an orchestrator's with its delegations) and, for a run
   * paused on a question, the question and who must answer it.
   */
  async execute(crewId: string, input?: unknown): Promise<CrewExecution & { result?: CrewRunResult }> {
    const res = await this.http.post<{ execution: CrewExecution; result?: CrewRunResult }>(
      `/crews/${crewId}/executions`,
      { input },
      { timeoutMs: 320_000 }
    );
    const { execution, result } = res.payload!;
    return result ? { ...execution, result } : execution;
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
