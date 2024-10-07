import '@/env';
import { Client, Collection, GatewayIntentBits } from 'discord.js';

import { existsSync } from 'node:fs';

import { type Button, register as registerButtons } from '@/lib/buttons';
import { type Command, register as registerCommands } from '@/lib/commands';
import { register as registerEvents } from '@/lib/events';
import type { ModalResolver } from '@/lib/modals';
import { register as registerScripts } from '@/lib/scripts';
import {
  type Selection,
  register as registerSelections
} from '@/lib/selections';

interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
  buttons: Collection<string, Button>;
  modals: Collection<string, ModalResolver>;
  selections: Collection<string, Selection>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMembers // Needed for 'guildMemberUpdate' event
  ]
}) as ExtendedClient;

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();
client.selections = new Collection();

global.client = client;

async function main() {
  if (existsSync('./config.json') || existsSync('../config.json')) {
    const file = await import('../config.json', {
      assert: {
        type: 'json'
      }
    });

    global.config = 'default' in file ? file.default : file;
  }

  await registerEvents();
  await registerCommands();
  await registerButtons();
  await registerSelections();
  await registerScripts();

  try {
    await client.login(global.env.CLIENT_TOKEN);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();

export { client, client as default, type ExtendedClient };
