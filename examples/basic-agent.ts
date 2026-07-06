/**
 * Create an agent, run it, and clean up.
 *
 *   export M2F_API_KEY=rest_xxx
 *   npx ts-node examples/basic-agent.ts
 */
import { M2FClient } from '@mind2flow/agents-sdk';

async function main() {
  const m2f = new M2FClient({
    apiKey: process.env.M2F_API_KEY!,
    baseUrl: process.env.M2F_BASE_URL, // optional, defaults to production
  });

  const agent = await m2f.agents.create({
    name: 'SDK Example Bot',
    description: 'Created by the basic-agent example',
    systemPrompt: 'You are a concise assistant. Answer in one sentence.',
  });
  console.log(`Created agent ${agent.id}`);

  const { result } = await m2f.agents.execute(agent.id, {
    input: 'In one sentence: what is an AI agent?',
  });
  console.log('Agent said:', JSON.stringify(result, null, 2));

  await m2f.agents.delete(agent.id);
  console.log('Cleaned up.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
