#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth';
import { registerAgentCommands } from './commands/agents';
import { registerCrewCommands } from './commands/crews';
import { registerDeviceCommands } from './commands/devices';
import { registerToolCommands } from './commands/tools';
import { registerTaskCommands } from './commands/tasks';
import { registerMcpCommands } from './commands/mcp';

const program = new Command();

program
  .name('m2f')
  .description('Mind2Flow CLI — build, manage and run AI agents from your terminal')
  .version('0.1.0');

registerAuthCommands(program);
registerAgentCommands(program);
registerCrewCommands(program);
registerDeviceCommands(program);
registerToolCommands(program);
registerTaskCommands(program);
registerMcpCommands(program);

program.parseAsync(process.argv);
