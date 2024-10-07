import '@/env';
import { InteractionResponseType, InteractionType } from 'discord-interactions';
import {
  type APIApplicationCommandInteraction,
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';

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

  // Créer un serveur Fastify pour les interactions Discord
  const fastify = Fastify();
  const PORT = process.env.PORT || 3000;

  const rest = new REST({ version: '14' }).setToken(global.env.CLIENT_TOKEN);

  // Point de terminaison pour la route racine
  fastify.get('/', async (_: FastifyRequest, reply: FastifyReply) => {
    reply.send(
      'Le serveur est opérationnel et prêt à recevoir des interactions.',
    );
  });

  // Middleware pour vérifier la clé de signature des requêtes Discord
  fastify.post('/interactions', {
    // preHandler: (request: FastifyRequest, reply: FastifyReply) => {
    //   const rawBody = request.body;
    //   if (!rawBody) {
    //     reply.status(400).send('Bad Request: Missing raw body');
    //     return;
    //   }
    //   verifyKeyMiddleware(global.env.PUBLIC_KEY)(rawBody, rawBody, reply.raw);
    // },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const interaction = request.body as {
        type?: unknown;
        id?: string;
        token?: string;
      };

      if (
        typeof interaction?.type === 'undefined' ||
        typeof interaction?.id === 'undefined'
      ) {
        reply.status(400).send('Bad Request: Missing interaction type');
        return;
      }

      if (typeof interaction?.id === 'undefined') {
        reply.status(400).send('Bad Request: Missing interaction type');
        return;
      }

      if (typeof interaction?.token === 'undefined') {
        reply.status(400).send('Bad Request: Missing interaction type');
        return;
      }

      // Gérer les différents types d'interactions
      if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const commandInteraction =
          interaction as APIApplicationCommandInteraction;
        const command = global.client.commands.get(
          commandInteraction.data.name,
        );
        if (command) {
          try {
            await rest.post(
              Routes.interactionCallback(interaction.id, interaction.token),
              {
                body: {
                  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                  data: {
                    content: `Commande ${commandInteraction.data.name} exécutée avec succès.`,
                  },
                },
              },
            );
            reply.status(200).send("Réponse à l'interaction");
          } catch (error) {
            console.error("Erreur lors de l'exécution de la commande :", error);
            reply.status(500).send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: `Erreur lors de l'exécution de la commande ${commandInteraction.data.name}.`,
              },
            });
          }
        } else {
          reply.status(404).send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Commande ${commandInteraction.data.name} non reconnue.`,
            },
          });
        }
      }
    },
  });

  // Middleware pour parser le corps des requêtes en JSON (Fastify le gère automatiquement)
  // fastify.addContentTypeParser(
  //   'application/json',
  //   { parseAs: 'string' },
  //   (req, body, done) => {
  //     try {
  //       done(null, JSON.parse(body));
  //     } catch (error) {
  //       done(error, undefined);
  //     }
  //   },
  // );

  fastify.listen({ port: Number(PORT), host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Serveur HTTP démarré sur ${address}`);
  });
}

main();

export { client, client as default, type ExtendedClient };
