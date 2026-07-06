import { Command } from 'commander';
import { createInterface } from 'readline';
import { loadConfig, saveConfig, configPath, getClient } from '../config';
import { fail, printJson } from '../output';

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('Save your API key to ~/.m2f/config.json')
    .option('--api-key <key>', 'REST API key (rest_...); prompts when omitted')
    .option('--base-url <url>', 'API base URL (default: https://api.mind2flow.io/api/v1)')
    .action(async (opts: { apiKey?: string; baseUrl?: string }) => {
      try {
        const apiKey = opts.apiKey || (await prompt('Paste your REST API key (rest_...): '));
        if (!apiKey.startsWith('rest_')) {
          console.error('That does not look like a Mind2Flow REST API key (must start with rest_).');
          process.exit(1);
        }

        const config = loadConfig();
        config.apiKey = apiKey;
        if (opts.baseUrl) config.baseUrl = opts.baseUrl;
        saveConfig(config);

        // Verify the key actually works
        const client = getClient();
        const me = await client.account.me();
        console.log(`Logged in as ${me.user.email}`);
        console.log(`Scopes: ${(me.auth.scopes ?? []).join(', ')}`);
        console.log(`Config saved to ${configPath()}`);
      } catch (error) {
        fail(error);
      }
    });

  program
    .command('logout')
    .description('Remove the stored API key')
    .action(() => {
      const config = loadConfig();
      delete config.apiKey;
      saveConfig(config);
      console.log('Logged out. API key removed from config.');
    });

  program
    .command('whoami')
    .description('Show the account behind the configured API key')
    .action(async () => {
      try {
        const me = await getClient().account.me();
        printJson(me);
      } catch (error) {
        fail(error);
      }
    });

  program
    .command('credits')
    .description('Show your credit balance')
    .action(async () => {
      try {
        printJson(await getClient().account.credits());
      } catch (error) {
        fail(error);
      }
    });
}
