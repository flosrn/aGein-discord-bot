import '@/env';
import {
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';
import express, { type Request, type Response } from 'express';

import { type Button, register as registerButtons } from '@/lib/buttons';
import { type Command, register as registerCommands } from '@/lib/commands';
import { register as registerEvents } from '@/lib/events';
import type { ModalResolver } from '@/lib/modals';
import { register as registerScripts } from '@/lib/scripts';
import {
  type Selection,
  register as registerSelections,
} from '@/lib/selections';

interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
  buttons: Collection<string, Button>;
  modals: Collection<string, ModalResolver>;
  selections: Collection<string, Selection>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMembers, // Needed for 'guildMemberUpdate' event
  ],
}) as ExtendedClient;

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();
client.selections = new Collection();

global.client = client;

async function main() {
  // Initialisation du bot Discord
  await registerEvents();
  await registerCommands();
  await registerButtons();
  await registerSelections();
  await registerScripts();

  try {
    await client.login(global.env.CLIENT_TOKEN);
    console.log('Bot Discord connecté avec succès.');
  } catch (error) {
    console.error('Erreur lors de la connexion du bot :', error);
    process.exit(1);
  }

  // Créer un serveur Express pour les interactions Discord
  const app = express();
  const PORT = process.env.PORT || 3000;

  const rest = new REST({ version: '10' }).setToken(global.env.CLIENT_TOKEN);

  // Point de terminaison pour la route racine
  app.get('/', (_: Request, res: Response) => {
    res.send(
      'Le serveur est opérationnel et prêt à recevoir des interactions.',
    );
  });

  // Middleware pour vérifier la clé de signature des requêtes Discord
  app.post(
    '/interactions',
    express.raw({ type: 'application/json' }),
    verifyKeyMiddleware(global.env.PUBLIC_KEY),
    async (req: Request, res: Response) => {
      const interaction = req.body;

      // if (interaction.type === InteractionType.PING) {
      //   // Répondre à la vérification PING
      //   return res.send({
      //     type: InteractionResponseType.PONG,
      //   });
      // }

      // Gérer d'autres types d'interactions (commandes slash, boutons, etc.)
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const command = global.client.commands.get(interaction.data.name);
        if (command) {
          try {
            await rest.post(
              Routes.interactionCallback(interaction.id, interaction.token),
              {
                body: {
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content: `Commande ${interaction.data.name} exécutée avec succès.`,
                  },
                },
              },
            );
            res.status(200).send("Réponse à l'interaction");
          } catch (error) {
            console.error("Erreur lors de l'exécution de la commande :", error);
            res.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Erreur lors de l'exécution de la commande ${interaction.data.name}.`,
              },
            });
            res.status(500).send('Erreur interne du serveur');
          }
          res.status(200).end();
        } else {
          res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Commande ${interaction.data.name} non reconnue.`,
            },
          });
        }
      }
    },
  );

  // Middleware pour parser le corps des requêtes en JSON
  app.use(express.json());

  app.listen(PORT, () => {
    console.log(`Serveur HTTP démarré sur le port ${PORT}`);
  });
}

main();

export { client, client as default, type ExtendedClient };
