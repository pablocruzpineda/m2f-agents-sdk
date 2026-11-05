import { Command } from 'commander';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { getClient } from '../config';
import { printTable, printJson, fail } from '../output';

/** Write a data:image/…;base64 URL to a file. */
export function saveDataUrl(dataUrl: string, file: string): void {
  const m = /^data:[^;,]+;base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('The server did not return an image');
  fs.writeFileSync(file, Buffer.from(m[1], 'base64'));
}

/** Open a file with the system viewer (best effort). */
function openFile(file: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', file] : [file];
  try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref(); } catch { /* the path is printed anyway */ }
}

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

  // ── Linking WhatsApp ─────────────────────────────────────

  const whatsapp = devices.command('whatsapp').description('Link a device to a WhatsApp number (QR or pairing code)');

  whatsapp
    .command('link <deviceId>')
    .description('Show a QR to scan (saved as a PNG and opened), or with --phone a pairing code; waits until the phone links')
    .option('--phone <number>', 'Use a pairing code for this number instead of a QR (full international, e.g. +5215512345678)')
    .option('--out <file>', 'Where to save the QR image', path.join(os.tmpdir(), 'm2f-whatsapp-qr.png'))
    .option('--no-open', 'Do not open the QR image')
    .option('--timeout <seconds>', 'Give up after this long (default 180)')
    .action(async (deviceId: string, opts: { phone?: string; out: string; open: boolean; timeout?: string }) => {
      try {
        const client = getClient();
        const pairing = await client.devices.startPairing(deviceId, opts.phone ? { phoneNumber: opts.phone } : {});
        const showQr = (qr: string) => {
          saveDataUrl(qr, opts.out);
          console.log(`QR saved to ${opts.out} — scan it from WhatsApp → Linked devices → Link a device.`);
          if (opts.open) openFile(opts.out);
        };
        if (pairing.method === 'code') {
          console.log(`Pairing code: ${pairing.pairingCode}`);
          console.log('On the phone: WhatsApp → Linked devices → Link a device → Link with phone number instead.');
        } else if (pairing.qr) {
          showQr(pairing.qr);
        }
        console.log('Waiting for the phone to link…');
        const status = await client.devices.waitForPairing(deviceId, pairing, {
          timeoutMs: opts.timeout ? parseInt(opts.timeout, 10) * 1000 : undefined,
          onQr: (qr) => { saveDataUrl(qr, opts.out); console.log('  (QR refreshed)'); },
        });
        console.log(`Linked: ${status.phoneNumber ?? ''}${status.profileName ? ` (${status.profileName})` : ''}. Assign it to an agent with: m2f agents assign-device <agentId> ${deviceId}`);
      } catch (error) {
        fail(error);
      }
    });

  whatsapp
    .command('status <deviceId>')
    .option('--json', 'Output raw JSON')
    .action(async (deviceId: string, opts: { json?: boolean }) => {
      try {
        const s = await getClient().devices.whatsappStatus(deviceId);
        if (opts.json) return printJson(s);
        console.log(s.connected ? `Connected (${s.channel}) ${s.phoneNumber ?? ''}${s.profileName ? ` · ${s.profileName}` : ''}` : `Not connected (${s.state})`);
      } catch (error) {
        fail(error);
      }
    });

  whatsapp
    .command('disconnect <deviceId>')
    .option('--yes', 'Confirm')
    .action(async (deviceId: string, opts: { yes?: boolean }) => {
      try {
        if (!opts.yes) {
          console.error('The number stops receiving and sending here (for Meta numbers the stored token is deleted). Re-run with --yes to confirm.');
          process.exit(1);
        }
        const r = await getClient().devices.disconnectWhatsApp(deviceId, { confirm: true });
        console.log('Disconnected.');
        if (r.warning) console.log(`Warning: ${r.warning}`);
      } catch (error) {
        fail(error);
      }
    });

  devices
    .command('send-endpoint <deviceId>')
    .description('Create the device\'s send URL (other systems POST { phoneNumber, message } to it), or --remove it')
    .option('--remove', 'Remove it')
    .action(async (deviceId: string, opts: { remove?: boolean }) => {
      try {
        const client = getClient();
        if (opts.remove) { await client.devices.removeSendEndpoint(deviceId); return console.log('Send URL removed.'); }
        console.log((await client.devices.setSendEndpoint(deviceId)).url);
      } catch (error) {
        fail(error);
      }
    });

  // ── Meta (WhatsApp Cloud API) ────────────────────────────

  devices
    .command('connection <deviceId> <state>')
    .description('Mark a device as connected or disconnected (on | off), as the console\'s toggle does')
    .action(async (deviceId: string, state: string) => {
      try {
        if (state !== 'on' && state !== 'off') throw new Error('state must be on or off');
        printJson(await getClient().devices.setConnection(deviceId, state === 'on'));
      } catch (error) { fail(error); }
    });

  whatsapp
    .command('pairing <deviceId> <pairingId>')
    .description('One pairing\'s state (step by step; "whatsapp link" does the whole flow)')
    .action(async (deviceId: string, pairingId: string) => {
      try { printJson(await getClient().devices.pairingStatus(deviceId, pairingId)); } catch (error) { fail(error); }
    });

  whatsapp
    .command('refresh-qr <deviceId> <pairingId>')
    .description('A new QR for a pairing in progress (saved as a PNG with --out)')
    .option('--out <file>', 'Save the QR image here')
    .action(async (deviceId: string, pairingId: string, o: { out?: string }) => {
      try {
        const r = await getClient().devices.refreshQr(deviceId, pairingId);
        if (o.out) { saveDataUrl(r.qr, o.out); console.log(`QR saved to ${o.out}`); } else printJson(r);
      } catch (error) { fail(error); }
    });

  whatsapp
    .command('cancel <deviceId> <pairingId>')
    .description('Stop a pairing in progress')
    .action(async (deviceId: string, pairingId: string) => {
      try { printJson(await getClient().devices.cancelPairing(deviceId, pairingId)); } catch (error) { fail(error); }
    });

  const meta = devices.command('meta').description('Connect and manage Meta (WhatsApp Cloud API) numbers');

  meta.command('saved').description('Meta accounts already used here').action(async () => {
    try { printJson(await getClient().devices.metaSavedAccounts()); } catch (error) { fail(error); }
  });

  meta
    .command('inspect')
    .description('Step 1: what a token can reach (changes nothing)')
    .option('--token <accessToken>', 'System user token (or META_ACCESS_TOKEN)')
    .option('--secret <appSecret>', 'App secret (or META_APP_SECRET)')
    .option('--waba <id>', 'Limit to one WhatsApp Business Account')
    .option('--saved <appId>', 'Use a saved account instead of a token')
    .action(async (opts: { token?: string; secret?: string; waba?: string; saved?: string }) => {
      try {
        const r = await getClient().devices.metaInspect(opts.saved
          ? { savedAppId: opts.saved, wabaId: opts.waba }
          : { accessToken: opts.token || process.env.META_ACCESS_TOKEN, appSecret: opts.secret || process.env.META_APP_SECRET, wabaId: opts.waba });
        console.log(`inspectionId: ${r.inspectionId}`);
        printTable(r.numbers.map((n) => ({ phoneNumberId: n.id, number: n.displayPhoneNumber, name: n.verifiedName ?? '', linked: n.linked ? 'yes' : '' })), ['phoneNumberId', 'number', 'name', 'linked']);
      } catch (error) { fail(error); }
    });

  meta
    .command('connect <deviceId>')
    .description('Step 2: connect a number from the inspection (Meta is configured for it)')
    .requiredOption('--inspection <id>', 'inspectionId from inspect')
    .requiredOption('--number <phoneNumberId>', 'phoneNumberId from inspect')
    .option('--pin <pin>', 'Two-step PIN, when Meta asks for it')
    .option('--overwrite-webhook', 'Replace a webhook the app already has')
    .action(async (deviceId: string, opts: { inspection: string; number: string; pin?: string; overwriteWebhook?: boolean }) => {
      try { printJson(await getClient().devices.metaConnectAuto(deviceId, { inspectionId: opts.inspection, phoneNumberId: opts.number, pin: opts.pin, overwriteWebhook: opts.overwriteWebhook })); } catch (error) { fail(error); }
    });

  meta
    .command('connect-manual <deviceId>')
    .requiredOption('--number <phoneNumberId>', 'Phone number id')
    .requiredOption('--waba <wabaId>', 'WhatsApp Business Account id')
    .option('--token <accessToken>', 'System user token (or META_ACCESS_TOKEN)')
    .option('--secret <appSecret>', 'App secret (or META_APP_SECRET)')
    .action(async (deviceId: string, opts: { number: string; waba: string; token?: string; secret?: string }) => {
      try {
        const token = opts.token || process.env.META_ACCESS_TOKEN;
        if (!token) throw new Error('Pass --token or set META_ACCESS_TOKEN');
        printJson(await getClient().devices.metaConnectManual(deviceId, { phoneNumberId: opts.number, wabaId: opts.waba, accessToken: token, appSecret: opts.secret || process.env.META_APP_SECRET }));
      } catch (error) { fail(error); }
    });

  meta.command('status <deviceId>').description('Setup checks, quality and messaging limit').action(async (deviceId: string) => {
    try { printJson(await getClient().devices.metaStatus(deviceId)); } catch (error) { fail(error); }
  });

  meta.command('templates <deviceId>').option('--refresh', 'Read them again from Meta').action(async (deviceId: string, opts: { refresh?: boolean }) => {
    try { printJson(await getClient().devices.metaTemplates(deviceId, { refresh: opts.refresh })); } catch (error) { fail(error); }
  });

  meta
    .command('profile <deviceId>')
    .description('Show the business profile, or change it with --set')
    .option('--set <json>', 'Fields to change, e.g. \'{"about":"Abierto 9-18"}\'')
    .action(async (deviceId: string, opts: { set?: string }) => {
      try {
        const client = getClient();
        printJson(opts.set ? await client.devices.updateMetaProfile(deviceId, JSON.parse(opts.set)) : await client.devices.metaProfile(deviceId));
      } catch (error) { fail(error); }
    });
}
