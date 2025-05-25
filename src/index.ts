import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import * as dotenv from 'dotenv';
import { ModelParser } from './utils/modelParser.js';
import { UserSessionManager } from './utils/userSessionManager.js';
import { PermissionManager } from './utils/permissionManager.js';
import { T3ChatService } from './services/t3ChatService.js';
import * as modelCommand from './commands/model.js';
import * as askCommand from './commands/ask.js';
import * as usageCommand from './commands/usage.js';
import * as infoCommand from './commands/info.js';

dotenv.config();

interface ExtendedClient extends Client {
  commands: Collection<string, any>;
}

const client = new Client({ 
  intents: [GatewayIntentBits.Guilds] 
}) as ExtendedClient;

client.commands = new Collection();

const modelParser = new ModelParser();
const sessionManager = new UserSessionManager();

let permissionManager: PermissionManager;

const initializeManagers = async () => {
  permissionManager = new PermissionManager(() => {
    sessionManager.saveData().catch(console.error);
  });
};

const t3ChatService = new T3ChatService(
  process.env.T3_ACCESS_TOKEN || 'default_token',
  process.env.USE_BETA_DOMAIN === 'true'
);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🚀 Ready! Logged in as ${readyClient.user.tag}`);
  
  try {
    console.log('🔧 Initializing bot components...');
    
    await initializeManagers();
    
    client.commands.set(modelCommand.data.name, modelCommand);
    client.commands.set(askCommand.data.name, askCommand);
    client.commands.set(usageCommand.data.name, usageCommand);
    client.commands.set(infoCommand.data.name, infoCommand);
    
    await modelParser.loadModels();
    console.log(`🤖 Loaded ${modelParser.getModels().length} AI models`);
    
    await sessionManager.initialize();
    console.log(`⚙️ Default model set to: ${sessionManager.getDefaultModel()}`);
    console.log('💾 Realtime data saving enabled');
    
    if (process.env.T3_ACCESS_TOKEN) {
      const connectionTest = await t3ChatService.testConnection();
      if (connectionTest) {
        console.log('🔗 T3.CHAT connection test successful');
      } else {
        console.warn('⚠️ T3.CHAT connection test failed - check your access token or network');
      }
    } else {
      console.warn('⚠️ No T3_ACCESS_TOKEN provided - bot will provide direct links instead of responses');
    }
    
    console.log('✅ Bot initialization complete!');
  } catch (error) {
    console.error('❌ Error during initialization:', error);
  }

  setInterval(async () => {
    await sessionManager.cleanupOldSessions();
  }, 60 * 60 * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, modelParser, sessionManager, t3ChatService, permissionManager);
    } catch (error) {
      console.error('Error executing command:', error);
      
      const errorMessage = 'There was an error while executing this command!';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found for autocomplete.`);
      return;
    }

    try {
      if (command.autocomplete) {
        await command.autocomplete(interaction, modelParser, sessionManager, t3ChatService, permissionManager);
      }
    } catch (error) {
      console.error('Error executing autocomplete:', error);
    }
  }
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await sessionManager.shutdown();
  await t3ChatService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await sessionManager.shutdown();
  await t3ChatService.cleanup();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);