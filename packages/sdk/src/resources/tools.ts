import type { HttpClient } from '../http.js';
import type {
  CustomTool,
  CustomToolCreateParams,
  ExecutePythonParams,
  PythonExecution,
} from '../types.js';

export class ToolsResource {
  constructor(private readonly http: HttpClient) {}

  /** List your custom tools. */
  async list(): Promise<CustomTool[]> {
    const res = await this.http.get<{ tools: CustomTool[] }>('/tools');
    return res.payload?.tools ?? [];
  }

  /** Discover public tools shared by the community. */
  async listPublic(options: { limit?: number; offset?: number } = {}): Promise<CustomTool[]> {
    const res = await this.http.get<{ tools: CustomTool[] }>('/tools/public', {
      query: { limit: options.limit, offset: options.offset },
    });
    return res.payload?.tools ?? [];
  }

  /** Get a single custom tool by id. */
  async get(toolId: string): Promise<CustomTool> {
    const res = await this.http.get<{ tool: CustomTool }>(`/tools/${toolId}`);
    return res.payload!.tool;
  }

  /** Create a custom Python tool that agents can call. */
  async create(params: CustomToolCreateParams): Promise<CustomTool> {
    const res = await this.http.post<{ tool: CustomTool }>('/tools', params);
    return res.payload!.tool;
  }

  /** Update a custom tool. */
  async update(toolId: string, params: Partial<CustomToolCreateParams>): Promise<CustomTool> {
    const res = await this.http.patch<{ tool: CustomTool }>(`/tools/${toolId}`, params);
    return res.payload!.tool;
  }

  /** Delete a custom tool. */
  async delete(toolId: string): Promise<void> {
    await this.http.delete(`/tools/${toolId}`);
  }

  /** Execute Python code in the sandbox (requires the tools:execute scope). */
  async executePython(params: ExecutePythonParams): Promise<PythonExecution> {
    const res = await this.http.post<{ execution: PythonExecution }>('/tools/execute', params, {
      timeoutMs: ((params.timeout ?? 60) + 15) * 1000,
    });
    return res.payload!.execution;
  }
}
