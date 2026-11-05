import { Command } from 'commander';
import { getClient } from '../config';
import { printJson, fail } from '../output';

/** Dashboard reporting (read-only). */
export function registerDashboardCommands(program: Command): void {
  const dash = program.command('dashboard').description('Reporting: consumption, credits, LLM token usage, subaccount metrics');
  const range = (c: Command) => c.option('--from <YYYY-MM-DD>', 'Start (default 30 days ago)').option('--to <YYYY-MM-DD>', 'End (default today)');
  const scope = (c: Command) => c.option('--account <accountId>', 'One client account').option('--subaccount <subaccountId>', 'One subaccount');
  type O = { from?: string; to?: string; account?: string; subaccount?: string; groupBy?: 'day' | 'week' | 'month'; tz?: string };
  const run = (fn: () => Promise<unknown>) => fn().then(printJson, fail);

  scope(range(dash.command('consumption'))).action((o: O) => run(() => getClient().dashboard.consumption({ startDate: o.from, endDate: o.to, accountId: o.account, subaccountId: o.subaccount })));
  range(dash.command('agent <agentId>')).option('--group-by <day|week|month>').action((id: string, o: O) => run(() => getClient().dashboard.agentConsumption(id, { startDate: o.from, endDate: o.to, groupBy: o.groupBy })));
  range(dash.command('crew <crewId>')).option('--group-by <day|week|month>').action((id: string, o: O) => run(() => getClient().dashboard.crewConsumption(id, { startDate: o.from, endDate: o.to, groupBy: o.groupBy })));
  scope(range(dash.command('credits'))).action((o: O) => run(() => getClient().dashboard.credits({ startDate: o.from, endDate: o.to, accountId: o.account, subaccountId: o.subaccount })));
  scope(range(dash.command('tokens'))).option('--tz <zone>', 'IANA time zone').description('LLM tokens and USD cost by model and day')
    .action((o: O) => run(() => getClient().dashboard.tokenUsage({ startDate: o.from, endDate: o.to, accountId: o.account, subaccountId: o.subaccount, tz: o.tz })));
  dash.command('subaccounts').option('--subaccount <id>').option('--costs', 'Costs instead of metrics').action((o: { subaccount?: string; costs?: boolean }) =>
    run(() => (o.costs ? getClient().dashboard.subaccountCosts({ subaccountId: o.subaccount }) : getClient().dashboard.subaccountMetrics(o.subaccount))));
  dash.command('org-agents').description('Every agent of your organisation').action(() => run(() => getClient().dashboard.organizationAgents()));
}
