import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as modelCommand from './commands/model.js';
import * as askCommand from './commands/ask.js';

dotenv.config();

const commands = [
  modelCommand.data.toJSON(),
  askCommand.data.toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands },
    );

    console.log(`Successfully reloaded ${(data as any).length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})(); 