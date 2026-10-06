import { M2FError } from '@mind2flow/agents-sdk';
import type { AgentBreakdown } from '@mind2flow/agents-sdk';

/** Print rows as an aligned plain-text table. */
export function printTable(rows: Array<Record<string, unknown>>, columns: string[]): void {
  if (rows.length === 0) {
    console.log('(none)');
    return;
  }

  const cells = rows.map((row) =>
    columns.map((col) => {
      const value = row[col];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );

  const widths = columns.map((col, i) =>
    Math.max(col.length, ...cells.map((row) => row[i].length))
  );

  const line = (parts: string[]) =>
    parts.map((part, i) => part.padEnd(widths[i])).join('  ');

  console.log(line(columns.map((c) => c.toUpperCase())));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const row of cells) console.log(line(row));
}

/** The per-agent split an "all" summary carries; prints nothing for a single agent. */
export function printAgentBreakdown(agents?: AgentBreakdown[]): void {
  if (!agents?.length) return;
  console.log('\nPer agent:');
  printTable(
    agents.map((a) => ({
      agent: a.agentName ?? a.agentId,
      messages: a.messages,
      incoming: a.incoming,
      errors: a.errors,
      'last activity': a.lastAt.slice(0, 16).replace('T', ' '),
    })),
    ['agent', 'messages', 'incoming', 'errors', 'last activity']
  );
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/** Uniform error handling for all commands. */
export function fail(error: unknown): never {
  if (error instanceof M2FError) {
    console.error(`Error (HTTP ${error.status}): ${error.message}`);
    if (error.requiredScope) {
      console.error(`Your API key is missing the "${error.requiredScope}" scope.`);
    }
    if (error.isRateLimited) {
      console.error('You are being rate limited — retry in a minute or raise the key\'s limit.');
    }
  } else {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
}
