import { Command } from 'commander';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

export function registerDeviceCommands(program: Command): void {
  const devices = program.command('devices').description('Manage devices (WhatsApp, SMS, Email, Web)');

  devices
    .command('list')
    .description('List your devices')
    .option('--json', 'Output raw JSON')
    .option('--available', 'Only devices not assigned to an agent/crew')
    .action(async (opts: { json?: boolean; available?: boolean }) => {
      try {
        const client = getClient();
        const list = opts.available ? await client.devices.listAvailable() : await client.devices.list();
        if (opts.json) return printJson(list);
        printTable(
          list.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            connected: d.isConnected ? 'yes' : 'no',
          })),
          ['id', 'name', 'type', 'connected']
        );
      } catch (error) {
        fail(error);
      }
    });

  devices
    .command('get <deviceId>')
    .description('Show one device')
    .action(async (deviceId: string) => {
      try {
        printJson(await getClient().devices.get(deviceId));
      } catch (error) {
        fail(error);
      }
    });

  devices
    .command('create')
    .description('Create a device')
    .requiredOption('--name <name>', 'Device name')
    .requiredOption('--type <type>', 'Device type: whatsapp | sms | email | web')
    .action(async (opts: { name: string; type: string }) => {
      try {
        const device = await getClient().devices.create({ name: opts.name, type: opts.type });
        console.log(`Device created: ${device.id}`);
        printJson(device);
      } catch (error) {
        fail(error);
      }
    });

  devices
    .command('delete <deviceId>')
    .description('Delete a device')
    .action(async (deviceId: string) => {
      try {
        await getClient().devices.delete(deviceId);
        console.log(`Device ${deviceId} deleted.`);
      } catch (error) {
        fail(error);
      }
    });
}
