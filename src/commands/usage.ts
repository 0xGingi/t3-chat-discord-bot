import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder
} from 'discord.js';
import { ModelParser } from '../utils/modelParser.js';
import { UserSessionManager } from '../utils/userSessionManager.js';
import { PermissionManager } from '../utils/permissionManager.js';

export const data = new SlashCommandBuilder()
  .setName('usage')
  .setDescription('Check your current rate limit usage and remaining quota');

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

  const userSession = sessionManager.getOrCreateSession(userId);
  const usageStats = permissionManager.getUsageStats(userSession.usageTracker);
  const remainingQuota = permissionManager.getRemainingQuota(userSession.usageTracker);

  const regularPercentage = Math.round((usageStats.regular / usageStats.limit.regular) * 100);
  const premiumPercentage = Math.round((usageStats.premium / usageStats.limit.premium) * 100);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📊 Your Usage Statistics')
    .setAuthor({
      name: interaction.user.displayName,
      iconURL: interaction.user.displayAvatarURL({ size: 32 })
    })
    .setDescription(`Current usage for the ${usageStats.interval} period`)
    .addFields(
      {
        name: '🔵 Regular Models',
        value: `**Used:** ${usageStats.regular}/${usageStats.limit.regular} (${regularPercentage}%)\n**Remaining:** ${remainingQuota.regular} requests\n**Progress:** ${'█'.repeat(Math.floor(regularPercentage / 10))}${'░'.repeat(10 - Math.floor(regularPercentage / 10))} ${regularPercentage}%`,
        inline: true
      },
      {
        name: '💎 Premium Models',
        value: `**Used:** ${usageStats.premium}/${usageStats.limit.premium} (${premiumPercentage}%)\n**Remaining:** ${remainingQuota.premium} requests\n**Progress:** ${'█'.repeat(Math.floor(premiumPercentage / 10))}${'░'.repeat(10 - Math.floor(premiumPercentage / 10))} ${premiumPercentage}%`,
        inline: true
      },
      {
        name: '⏰ Rate Limit Period',
        value: `**Current Period:** ${usageStats.interval.charAt(0).toUpperCase() + usageStats.interval.slice(1)}\n**Total Requests:** ${userSession.requestCount || 0}`,
        inline: false
      }
    )
    .setFooter({ text: 'T3.CHAT Discord Bot • Usage tracking resets each period' })
    .setTimestamp();

  if (regularPercentage >= 90 || premiumPercentage >= 90) {
    embed.setColor(0xff4757);
    embed.addFields({
      name: '⚠️ Warning',
      value: 'You are approaching your rate limits. Consider upgrading or waiting for the next period.',
      inline: false
    });
  } else if (regularPercentage >= 70 || premiumPercentage >= 70) {
    embed.setColor(0xffa502);
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
} 