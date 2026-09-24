import type { HttpClient } from '../http.js';
import type { AccountMe } from '../types.js';

export class AccountResource {
  constructor(private readonly http: HttpClient) {}

  /** Get the identity and scopes behind the current API key. */
  async me(): Promise<AccountMe> {
    const res = await this.http.get<AccountMe>('/account/me');
    return res.payload!;
  }

  /** Get the account's credit balance. */
  async credits(): Promise<unknown> {
    const res = await this.http.get<unknown>('/account/credits');
    return res.payload;
  }
}
