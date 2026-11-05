import { M2FError } from './errors.js';
import type { Envelope } from './types.js';

export interface HttpClientOptions {
  apiKey: string;
  baseUrl: string;
  /** Default request timeout in milliseconds. */
  timeoutMs: number;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (defaults to global fetch, Node 18+). */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Per-request timeout override in milliseconds. */
  timeoutMs?: number;
}

export class HttpClient {
  private readonly opts: HttpClientOptions;
  /** Sent on every request of this client (e.g. agentId for an agent's own graph). */
  private readonly defaultQuery: Record<string, string>;

  constructor(opts: HttpClientOptions, defaultQuery: Record<string, string> = {}) {
    this.opts = opts;
    this.defaultQuery = defaultQuery;
  }

  /** The same client with these query parameters on every request. */
  withQuery(query: Record<string, string>): HttpClient {
    return new HttpClient(this.opts, { ...this.defaultQuery, ...query });
  }

  async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
    const fetchImpl = this.opts.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new M2FError('No fetch implementation available. Use Node 18+ or pass a custom fetch.', 0);
    }

    const url = new URL(this.opts.baseUrl.replace(/\/$/, '') + path);
    for (const [key, value] of Object.entries(this.defaultQuery)) url.searchParams.set(key, value);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.opts.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // FormData goes as multipart: fetch sets the Content-Type with its boundary, so we must not.
    const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      'x-api-key': this.opts.apiKey,
      'User-Agent': '@mind2flow/agents-sdk',
      ...this.opts.headers,
    };
    if (!multipart) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        method,
        headers,
        body: multipart
          ? (options.body as FormData)
          : options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new M2FError(`Request timed out after ${timeoutMs}ms: ${method} ${path}`, 0);
      }
      throw new M2FError(
        `Network error calling ${method} ${path}: ${error instanceof Error ? error.message : String(error)}`,
        0
      );
    } finally {
      clearTimeout(timer);
    }

    let body: unknown;
    const text = await response.text();
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }

    if (!response.ok) {
      const message =
        body && typeof body === 'object' && 'message' in body
          ? String((body as { message: unknown }).message)
          : `HTTP ${response.status} on ${method} ${path}`;
      throw new M2FError(message, response.status, body);
    }

    return body as Envelope<T>;
  }

  get<T>(path: string, options?: RequestOptions): Promise<Envelope<T>> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<Envelope<T>> {
    return this.request<T>('POST', path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<Envelope<T>> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<Envelope<T>> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<Envelope<T>> {
    return this.request<T>('DELETE', path, options);
  }
}
