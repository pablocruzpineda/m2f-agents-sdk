/**
 * Execute an existing crew and poll its execution until it finishes.
 *
 *   export M2F_API_KEY=rest_xxx        (needs crews:*)
 *   npx ts-node examples/run-crew.ts <crewId> "input text"
 */
import { M2FClient } from '@mind2flow/agents-sdk';

async function main() {
  const [crewId, input] = process.argv.slice(2);
  if (!crewId) {
    console.error('Usage: ts-node examples/run-crew.ts <crewId> [input]');
    process.exit(1);
  }

  const m2f = new M2FClient({
    apiKey: process.env.M2F_API_KEY!,
    baseUrl: process.env.M2F_BASE_URL,
  });

  let execution = await m2f.crews.execute(crewId, input ?? 'Hello crew!');
  console.log(`Execution ${execution.id} → ${execution.status}`);

  // Poll until terminal state
  while (execution.status === 'pending' || execution.status === 'running') {
    await new Promise((r) => setTimeout(r, 2000));
    execution = await m2f.crews.getExecution(crewId, execution.id);
    console.log(`… ${execution.status}`);
  }

  console.log(JSON.stringify(execution.result ?? execution, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
