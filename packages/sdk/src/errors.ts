/** Error thrown for any non-2xx API response. */
export class M2FError extends Error {
  /** HTTP status code (0 for network/transport failures). */
  readonly status: number;
  /** Parsed response body, when the server returned JSON. */
  readonly body?: unknown;
  /** The scope the API key was missing, when the server reports one. */
  readonly requiredScope?: string;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'M2FError';
    this.status = status;
    this.body = body;
    if (body && typeof body === 'object' && 'requiredScope' in body) {
      this.requiredScope = String((body as { requiredScope: unknown }).requiredScope);
    }
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isPermissionError(): boolean {
    return this.status === 403;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** Every problem the server listed, e.g. for a crew blueprint that does not compile. */
  get errors(): string[] {
    const list = this.body && typeof this.body === 'object' ? (this.body as { errors?: unknown }).errors : undefined;
    return Array.isArray(list) ? list.map(String) : [];
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}
