/**
 * Create a custom Python tool, test it in the sandbox, and attach it
 * to an agent.
 *
 *   export M2F_API_KEY=rest_xxx        (needs tools:* and agents:write)
 *   npx ts-node examples/custom-tool.ts
 */
import { M2FClient } from '@mind2flow/agents-sdk';

const TOOL_CODE = `
import json
# A trivial tool: returns a fixed catalog. Replace with real API calls.
catalog = [
    {"sku": "A-100", "name": "Widget", "price": 9.99},
    {"sku": "B-200", "name": "Gadget", "price": 24.5},
]
print(json.dumps({"products": catalog}))
`;

async function main() {
  const m2f = new M2FClient({
    apiKey: process.env.M2F_API_KEY!,
    baseUrl: process.env.M2F_BASE_URL,
  });

  // Test the code in the sandbox first
  const run = await m2f.tools.executePython({ code: TOOL_CODE });
  console.log('Sandbox output:', run.stdout.trim());

  // Publish it as a tool
  const tool = await m2f.tools.create({
    name: `product_catalog_${Date.now()}`,
    description: 'Returns the current product catalog with prices',
    code: TOOL_CODE,
    examples: ['What products do you sell?', 'How much is the Widget?'],
    isPublic: false,
  });
  console.log(`Tool created: ${tool.id}`);

  // Attach it to a new agent
  const agent = await m2f.agents.create({
    name: 'Catalog Bot',
    systemPrompt: 'Answer product questions using the catalog tool.',
    customToolId: tool.id,
  });
  console.log(`Agent ${agent.id} created with tool ${tool.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
