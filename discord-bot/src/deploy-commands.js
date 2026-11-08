import { REST, Routes } from 'discord.js';
import { commandJson } from './commands.js';

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
  throw new Error('Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID before deploying commands.');
}

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
const route = DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
  : Routes.applicationCommands(DISCORD_CLIENT_ID);

await rest.put(route, { body: commandJson });
console.log(`Registered ${commandJson.length} commands${DISCORD_GUILD_ID ? ' for the development server' : ' globally'}.`);
