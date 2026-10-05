#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth';
import { registerAgentCommands } from './commands/agents';
import { registerCrewCommands } from './commands/crews';
import { registerDeviceCommands } from './commands/devices';
import { registerToolCommands } from './commands/tools';
import { registerTaskCommands } from './commands/tasks';
import { registerMcpCommands } from './commands/mcp';
import { registerKnowledgeCommands } from './commands/knowledge';
import { registerOrganizationCommands } from './commands/organization';
import { registerArtifactCommands } from './commands/artifacts';
import { registerVoiceCommands } from './commands/voice';
import { registerPanelCommands } from './commands/panels';

const program = new Command();

const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
) as { version: string };

program
  .name('m2f')
  .description('Mind2Flow CLI — build, manage and run AI agents from your terminal')
  .version(version);

registerAuthCommands(program);
registerAgentCommands(program);
registerCrewCommands(program);
registerDeviceCommands(program);
registerToolCommands(program);
registerTaskCommands(program);
registerMcpCommands(program);
registerKnowledgeCommands(program);
registerOrganizationCommands(program);
registerArtifactCommands(program);
registerVoiceCommands(program);
registerPanelCommands(program);

program.parseAsync(process.argv);
