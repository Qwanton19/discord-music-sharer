import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { SHARE_MUSIC_COMMAND } from './commands';
import 'dotenv/config';

async function registerCommands() {
  const appId = process.env.DISCORD_APP_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!appId || !botToken) {
    console.error('DISCORD_APP_ID and DISCORD_BOT_TOKEN must be set in .env');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(botToken);

  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(appId), { body: [SHARE_MUSIC_COMMAND] });
    console.log('Successfully registered commands!');
    console.log('Command: /sharemusic');
    console.log('Integration types: Guild Install, User Install');
    console.log('Contexts: Guild, Bot DM, Private Channel');
  } catch (error) {
    console.error('Error registering commands:', error);
    process.exit(1);
  }
}

registerCommands();
