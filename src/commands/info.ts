import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder
} from 'discord.js';
import { ModelParser } from '../utils/modelParser.js';
import { UserSessionManager } from '../utils/userSessionManager.js';
import { PermissionManager } from '../utils/permissionManager.js';

export const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('Show bot information, configuration, and storage statistics');

export async function execute(
  interaction: ChatInputCommandInteraction,
  modelParser: ModelParser,
  sessionManager: UserSessionManager,
  t3ChatService: any,
  permissionManager: PermissionManager
) {
  const userId = interaction.user.id;
  
  const permissionCheck = await permissionManager.checkPermissions(interaction);
  if (!permissionCheck.allowed) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle('🚫 Access Denied')
      .setDescription(permissionCheck.reason || 'You do not have permission to use this bot.')
      .setFooter({ text: 'T3.CHAT Discord Bot • Permission Required' })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  try {
    const storageStats = await sessionManager.getStorageStats();
    const models = modelParser.getModels();
    const regularModels = modelParser.getModelsByTier('Regular');
    const premiumModels = modelParser.getModelsByTier('Premium');
    const userSession = sessionManager.getOrCreateSession(userId);
    const usageStats = permissionManager.getUsageStats(userSession.usageTracker);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤖 Bot Information')
      .setAuthor({
        name: 'T3.CHAT Discord Bot',
        iconURL: interaction.client.user?.displayAvatarURL({ size: 32 })
      })
      .setDescription('Current bot configuration and statistics')
      .addFields(
        {
          name: '📊 Model Statistics',
          value: `**Total Models:** ${models.length}\n**Regular Models:** ${regularModels.length}\n**Premium Models:** ${premiumModels.length}\n**Default Model:** ${sessionManager.getDefaultModel()}`,
          inline: true
        },
        {
          name: '⚙️ Rate Limiting',
          value: `**Interval:** ${usageStats.interval}\n**Regular Limit:** ${usageStats.limit.regular}\n**Premium Limit:** ${usageStats.limit.premium}`,
          inline: true
        },
        {
          name: '🔒 Permissions',
          value: getPermissionInfo(),
          inline: false
        },
        {
          name: '👤 Your Stats',
          value: `**Current Model:** ${userSession.currentModel}\n**Total Requests:** ${userSession.requestCount}\n**Last Used:** ${userSession.lastUsed.toLocaleString()}`,
          inline: false
        }
      )
      .setFooter({ text: 'T3.CHAT Discord Bot •' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error in info command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle('❌ Error')
      .setDescription('Failed to retrieve bot information.')
      .setTimestamp();
    
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

function getPermissionInfo(): string {
  const allowedUsers = process.env.ALLOWED_USER_IDS || '';
  const allowedRoles = process.env.ALLOWED_ROLE_IDS || '';
  
  if (!allowedUsers && !allowedRoles) {
    return '🌐 **Open Access** - Everyone can use the bot';
  }
  
  let info = '';
  if (allowedUsers) {
    const userCount = allowedUsers.split(',').filter(id => id.trim()).length;
    info += `👥 **${userCount} Allowed User(s)**\n`;
  }
  if (allowedRoles) {
    const roleCount = allowedRoles.split(',').filter(id => id.trim()).length;
    info += `🎭 **${roleCount} Allowed Role(s)**`;
  }
  
  return info || '🌐 Open Access';
} 