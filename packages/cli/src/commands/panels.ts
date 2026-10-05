import { Command } from 'commander';
import { getClient } from '../config';
import { printJson, fail } from '../output';

export function registerPanelCommands(program: Command): void {
  const panels = program
    .command('panels')
    .description('External panels (CRMs, inboxes): subscribe to a WhatsApp device and send through it');

  panels
    .command('subscribe <deviceId> <url>')
    .description("Deliver the device's messages, statuses and connection changes to a signed webhook")
    .action(async (deviceId: string, url: string) => {
      try {
        const subscription = await getClient().panels.subscribe(deviceId, url);
        console.log(`Subscribed. Store this secret on your server — it verifies every delivery:\n${subscription.secret}`);
      } catch (error) {
        fail(error);
      }
    });

  panels
    .command('show <deviceId>')
    .description("Show the device's subscription")
    .action(async (deviceId: string) => {
      try {
        const subscription = await getClient().panels.getSubscription(deviceId);
        if (!subscription) return console.log('This device has no subscription.');
        printJson(subscription);
      } catch (error) {
        fail(error);
      }
    });

  panels
    .command('unsubscribe <deviceId>')
    .description("Stop delivering the device's events")
    .action(async (deviceId: string) => {
      try {
        await getClient().panels.unsubscribe(deviceId);
        console.log(`Device ${deviceId} unsubscribed.`);
      } catch (error) {
        fail(error);
      }
    });

  panels
    .command('send <deviceId> <phoneNumber> <message>')
    .description('Send a WhatsApp text through the device')
    .action(async (deviceId: string, phoneNumber: string, message: string) => {
      try {
        printJson(await getClient().panels.sendMessage(deviceId, { phoneNumber, message }));
      } catch (error) {
        fail(error);
      }
    });
}
