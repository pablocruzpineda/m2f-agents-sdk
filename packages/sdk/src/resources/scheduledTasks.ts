import type { HttpClient } from '../http';
import type {
  ScheduledTask,
  ScheduledTaskCreateParams,
  ScheduledTaskUpdateParams,
} from '../types';

export class ScheduledTasksResource {
  constructor(private readonly http: HttpClient) {}

  /** List scheduled tasks, optionally filtered by agent. */
  async list(options: { agentId?: string } = {}): Promise<ScheduledTask[]> {
    const res = await this.http.get<{ tasks: ScheduledTask[] }>('/scheduled-tasks', {
      query: { agentId: options.agentId },
    });
    return res.payload?.tasks ?? [];
  }

  /** Get a single scheduled task by id. */
  async get(taskId: string): Promise<ScheduledTask> {
    const res = await this.http.get<{ task: ScheduledTask }>(`/scheduled-tasks/${taskId}`);
    return res.payload!.task;
  }

  /** Create a scheduled task (cron, interval or one-shot). */
  async create(params: ScheduledTaskCreateParams): Promise<ScheduledTask> {
    const res = await this.http.post<{ task: ScheduledTask }>('/scheduled-tasks', params);
    return res.payload!.task;
  }

  /** Update a scheduled task. */
  async update(taskId: string, params: ScheduledTaskUpdateParams): Promise<ScheduledTask> {
    const res = await this.http.patch<{ task: ScheduledTask }>(`/scheduled-tasks/${taskId}`, params);
    return res.payload!.task;
  }

  /** Delete a scheduled task. */
  async delete(taskId: string): Promise<void> {
    await this.http.delete(`/scheduled-tasks/${taskId}`);
  }

  /** Toggle a task between enabled and disabled. */
  async toggle(taskId: string): Promise<ScheduledTask> {
    const res = await this.http.post<{ task: ScheduledTask }>(`/scheduled-tasks/${taskId}/toggle`);
    return res.payload!.task;
  }

  /** Trigger a task to run immediately. */
  async run(taskId: string): Promise<unknown> {
    const res = await this.http.post<{ result: unknown }>(`/scheduled-tasks/${taskId}/run`);
    return res.payload?.result;
  }

  /** Get a task's execution history. */
  async executions(taskId: string, options: { limit?: number } = {}): Promise<unknown[]> {
    const res = await this.http.get<{ executions: unknown[] }>(
      `/scheduled-tasks/${taskId}/executions`,
      { query: { limit: options.limit } }
    );
    return res.payload?.executions ?? [];
  }
}
