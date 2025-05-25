import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} from 'discord.js';
import { ModelParser } from '../utils/modelParser.js';
import { UserSessionManager } from '../utils/userSessionManager.js';
import { PermissionManager } from '../utils/permissionManager.js';
import { T3ChatService } from '../services/t3ChatService.js';

const PROVIDER_COLORS = {
  'openai': 0x00a67e,
  'anthropic': 0xd97757,
  'google': 0x4285f4,
  'meta': 0x1877f2,
  'deepseek': 0x7c3aed,
  'grok': 0x000000,
  'qwen': 0x7c2d12,
  'default': 0x5865f2
};

const PROVIDER_EMOJIS = {
  'openai': '🤖',
  'anthropic': '🧠',
  'google': '✨',
  'meta': '🦙',
  'deepseek': '🔮',
  'grok': '⚡',
  'qwen': '🎯',
  'default': '🤖'
};

const FEATURE_EMOJIS = {
  vision: '👁️',
  reasoning: '🧠',
  pdf: '📄',
  search: '🔍',
  fast: '⚡',
  effortControl: '🎛️',
  imageGen: '🎨'
};

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask a question to the AI model')
  .addStringOption(option =>
    option
      .setName('question')
      .setDescription('Your question for the AI')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('image_url')
      .setDescription('URL of visual content (for vision models)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('pdf_url')
      .setDescription('URL of document or content (for document-capable models)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('search')
      .setDescription('Enable web search (for models that support it)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('ephemeral')
      .setDescription('Make the response visible only to you')
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  modelParser: ModelParser,
  sessionManager: UserSessionManager,
  t3ChatService: T3ChatService,
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

  const question = interaction.options.getString('question', true);
  const imageUrl = interaction.options.getString('image_url');
  const pdfUrl = interaction.options.getString('pdf_url');
  const searchOption = interaction.options.getBoolean('search');
  const isEphemeral = interaction.options.getBoolean('ephemeral') || false;

  const currentModelName = sessionManager.getCurrentModel(userId);
  const model = modelParser.getModelByName(currentModelName);

  if (!model) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle('❌ No Model Selected')
      .setDescription('You need to set a model first to start chatting with AI!')
      .addFields({
        name: '🎯 Quick Start',
        value: 'Use `/model set` to choose an AI model\nTry `/model list` to see all available options',
        inline: false
      })
      .setFooter({ text: 'T3.CHAT Discord Bot • Model Selection Required' })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const userSession = sessionManager.getOrCreateSession(userId);
  const isPremium = model.tier === 'Premium';
  
  const rateLimitCheck = permissionManager.checkRateLimit(userSession.usageTracker, isPremium);
  if (!rateLimitCheck.allowed) {
    const remainingQuota = permissionManager.getRemainingQuota(userSession.usageTracker);
    const usageStats = permissionManager.getUsageStats(userSession.usageTracker);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xffa502)
      .setTitle('⏱️ Rate Limit Exceeded')
      .setDescription(rateLimitCheck.reason || 'You have exceeded your rate limit.')
      .addFields(
        {
          name: '📊 Current Usage',
          value: `**Regular Models:** ${usageStats.regular}/${usageStats.limit.regular}\n**Premium Models:** ${usageStats.premium}/${usageStats.limit.premium}`,
          inline: true
        },
        {
          name: '🔄 Reset Time',
          value: rateLimitCheck.nextReset ? `<t:${Math.floor(rateLimitCheck.nextReset.getTime() / 1000)}:R>` : 'Unknown',
          inline: true
        },
        {
          name: '💡 Available Quota',
          value: `**Regular:** ${remainingQuota.regular} requests\n**Premium:** ${remainingQuota.premium} requests`,
          inline: false
        }
      )
      .setFooter({ text: `Rate limit period: ${usageStats.interval}` })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  let enableSearch = false;
  if (searchOption !== null) {
    enableSearch = searchOption;
  } else if (model.features.search) {
    enableSearch = true;
  }

  if (imageUrl && !model.features.vision) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xffa502)
      .setTitle('🚫 Vision Not Supported')
      .setDescription(`**${model.name}** doesn't support image processing capabilities.`)
      .addFields({
        name: '💡 Suggestions',
        value: '• Remove the image URL and try again\n• Switch to a vision-enabled model\n• Use `/model features vision` to see compatible models',
        inline: false
      })
      .setFooter({ text: `Current Model: ${model.name} by ${model.provider}` })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  if (pdfUrl && !model.features.pdf) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xffa502)
      .setTitle('🚫 PDF Not Supported')
      .setDescription(`**${model.name}** doesn't support PDF processing capabilities.`)
      .addFields({
        name: '💡 Suggestions',
        value: '• Remove the PDF URL and try again\n• Switch to a PDF-enabled model\n• Use `/model features pdf` to see compatible models',
        inline: false
      })
      .setFooter({ text: `Current Model: ${model.name} by ${model.provider}` })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  if (imageUrl && !isValidUrl(imageUrl)) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle('❌ Invalid Image URL')
      .setDescription('Please provide a valid URL.')
      .addFields({
        name: '📋 Requirements',
        value: '• Must be a valid URL\n• URL must be publicly accessible\n• Can be any image or visual content',
        inline: false
      })
      .setFooter({ text: 'URL validation failed' })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  if (pdfUrl && !isValidUrl(pdfUrl)) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle('❌ Invalid Content URL')
      .setDescription('Please provide a valid URL.')
      .addFields({
        name: '📋 Requirements',
        value: '• Must be a valid URL\n• URL must be publicly accessible\n• Can be any document or content',
        inline: false
      })
      .setFooter({ text: 'URL validation failed' })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  if (enableSearch && !model.features.search) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xffa502)
      .setTitle('🚫 Search Not Supported')
      .setDescription(`**${model.name}** doesn't support web search capabilities.`)
      .addFields({
        name: '💡 Suggestions',
        value: '• Disable search and try again\n• Switch to a search-enabled model\n• Use `/model features search` to see compatible models',
        inline: false
      })
      .setFooter({ text: `Current Model: ${model.name} by ${model.provider}` })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const loadingEmbed = new EmbedBuilder()
    .setColor(getProviderColor(model.provider))
    .setTitle('🤔 Thinking...')
    .setDescription(`${getProviderEmoji(model.provider)} **${model.name}** is processing your ${imageUrl ? 'visual content and ' : ''}${pdfUrl ? 'document content and ' : ''}question...${model.features.imageGen && model.name.includes('Imagegen') ? '\n\n⏳ *Image generation may take 1-3 minutes...*' : ''}`)
    .addFields({
      name: '📝 Your Question',
      value: truncateText(question, 500),
      inline: false
    })
    .setFooter({ 
      text: `${model.provider} • ${enableSearch ? 'Web Search Enabled' : 'Standard Mode'}${imageUrl ? ' • Visual Content' : ''}${pdfUrl ? ' • Document Content' : ''}${model.features.imageGen && model.name.includes('Imagegen') ? ' • Extended Timeout for Image Generation' : ''}` 
    })
    .setTimestamp();

  if (imageUrl) {
    loadingEmbed.addFields({
      name: '🖼️ Visual Content',
      value: `**URL:** ${imageUrl}`,
      inline: true
    });
  }

  if (pdfUrl) {
    loadingEmbed.addFields({
      name: '📄 Document Content',
      value: `**URL:** ${pdfUrl}`,
      inline: true
    });
  }

  if (model.features.imageGen && model.name.includes('Imagegen')) {
    loadingEmbed.addFields({
      name: '🎨 Image Generation',
      value: 'This model generates images which may take longer than usual. Please be patient...',
      inline: false
    });
  }

  await interaction.deferReply({ 
    flags: isEphemeral ? 64 : undefined
  });

  await interaction.editReply({ embeds: [loadingEmbed] });

  try {
    const startTime = Date.now();
    sessionManager.updateLastUsed(userId);

    const response = await t3ChatService.askModel(model, question, enableSearch, imageUrl || undefined, pdfUrl || undefined);
    
    permissionManager.recordUsage(userSession.usageTracker, isPremium);
    
    const responseTime = ((Date.now() - startTime) / 1000).toFixed(1);

    if (typeof response === 'object' && response.type === 'image') {
      console.log('Received image response, sending as attachment');
      
      const embed = new EmbedBuilder()
        .setColor(getProviderColor(model.provider))
        .setAuthor({
          name: `${getProviderEmoji(model.provider)} ${model.name}`,
          iconURL: getUserAvatarUrl(interaction.user)
        })
        .setTitle('🎨 Generated Image')
        .setDescription(`Your image has been generated successfully!`)
        .addFields(
          {
            name: '🔧 Model Info',
            value: `**Provider:** ${model.provider}\n**Features:** ${Object.entries(model.features).filter(([_, enabled]) => enabled).map(([feature, _]) => FEATURE_EMOJIS[feature as keyof typeof FEATURE_EMOJIS] || '✓').join(' ') || 'Standard'}`,
            inline: true
          },
          {
            name: '⚡ Performance',
            value: `**Response Time:** ${responseTime}s\n**Search:** ${enableSearch ? 'Enabled' : 'Disabled'}`,
            inline: true
          },
          {
            name: '👤 Request Info',
            value: `**User:** ${interaction.user.displayName}\n**Privacy:** ${isEphemeral ? 'Private' : 'Public'}`,
            inline: true
          }
        )
        .setFooter({ 
          text: `T3.CHAT via ${model.provider} • Response ${sessionManager.getUserSession(userId)?.requestCount || 1}`,
          iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
        })
        .setTimestamp();

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`regenerate_${interaction.id}`)
            .setLabel('🔄 Regenerate')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`change_model_${interaction.id}`)
            .setLabel('🔧 Change Model')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setURL(createT3ChatUrl(model, question))
            .setLabel('🌐 Open in T3.CHAT')
            .setStyle(ButtonStyle.Link)
        );

      const attachment = new AttachmentBuilder(response.buffer!, { name: 'generated_image.png' });

      await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow],
        files: [attachment]
      });
      return;
    }

    const textResponse = response as string;
    const isDirectLink = textResponse.includes('https://') && (textResponse.includes('visit this link') || textResponse.includes('automatically'));

    if (isDirectLink) {
      const embed = new EmbedBuilder()
        .setColor(0xffa502)
        .setAuthor({
          name: `${getProviderEmoji(model.provider)} ${model.name}`,
          iconURL: getUserAvatarUrl(interaction.user)
        })
        .setTitle('🔗 T3.CHAT Link Generated')
        .setDescription('The response couldn\'t be extracted automatically. Click the link below to view it in T3.CHAT.')
        .addFields(
          {
            name: '🌐 Open in Browser',
            value: textResponse,
            inline: false
          },
          {
            name: '💡 Pro Tip',
            value: 'Your question has been pre-filled in T3.CHAT. Just click send when the page loads!',
            inline: false
          }
        );

      const features = Object.entries(model.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => FEATURE_EMOJIS[feature as keyof typeof FEATURE_EMOJIS] || '✓')
        .join(' ');

      embed.addFields(
        {
          name: '🔧 Model Info',
          value: `**Provider:** ${model.provider}\n**Features:** ${features || 'Standard'}`,
          inline: true
        },
        {
          name: '⚡ Performance',
          value: `**Response Time:** ${responseTime}s\n**Search:** ${enableSearch ? 'Enabled' : 'Disabled'}`,
          inline: true
        },
        {
          name: '👤 Request Info',
          value: `**User:** ${interaction.user.displayName}\n**Privacy:** ${isEphemeral ? 'Private' : 'Public'}`,
          inline: true
        }
      );

      embed
        .setFooter({ 
          text: `T3.CHAT via ${model.provider} • Response ${sessionManager.getUserSession(userId)?.requestCount || 1}`,
          iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
        })
        .setTimestamp();

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`regenerate_${interaction.id}`)
            .setLabel('🔄 Regenerate')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`change_model_${interaction.id}`)
            .setLabel('🔧 Change Model')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow] 
      });
      return;
    }

    const formattedResponse = formatResponse(textResponse);
    
    if (formattedResponse.length >= 1850) {
      await sendMultipleMessages(interaction, model, formattedResponse, question, enableSearch, isEphemeral, responseTime, sessionManager, userId);
    } else {
      await sendSingleMessage(interaction, model, formattedResponse, question, enableSearch, isEphemeral, responseTime, sessionManager, userId);
    }

  } catch (error) {
    console.error('Error in ask command:', error);

    let errorMessage = 'An unexpected error occurred while processing your request.';
    let errorType = 'Unknown Error';
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'The request timed out. T3.CHAT might be experiencing high load or the model is taking longer than usual to respond.';
        errorType = 'Timeout Error';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
        errorType = 'Network Error';
      } else if (error.message.includes('authentication')) {
        errorMessage = 'Authentication failed. Please check your T3.CHAT access token.';
        errorType = 'Auth Error';
      } else {
        errorMessage = error.message;
        errorType = 'Service Error';
      }
    }

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle(`❌ ${errorType}`)
      .setDescription(errorMessage)
      .addFields(
        {
          name: '🔧 Troubleshooting',
          value: '• Try again in a few moments\n• Check if T3.CHAT is accessible\n• Use `/model set` to try a different model',
          inline: false
        },
        {
          name: '📊 Request Details',
          value: `**Model:** ${model.name}\n**Provider:** ${model.provider}\n**Search:** ${enableSearch ? 'Enabled' : 'Disabled'}`,
          inline: true
        }
      )
      .setFooter({ 
        text: `Error occurred at ${new Date().toLocaleTimeString()}` 
      })
      .setTimestamp();

    const retryRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`retry_${interaction.id}`)
          .setLabel('🔄 Retry')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`change_model_${interaction.id}`)
          .setLabel('🔧 Try Different Model')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ 
      embeds: [errorEmbed], 
      components: [retryRow] 
    });
  }
}

function formatResponse(response: string): string {
  let formatted = response;
  
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '**$1**');
  formatted = formatted.replace(/\*(.*?)\*/g, '*$1*');
  formatted = formatted.replace(/`([^`]+)`/g, '`$1`');
  formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, '```$1\n$2```');
  
  formatted = formatted.replace(/^\d+\.\s/gm, '• ');
  formatted = formatted.replace(/^-\s/gm, '• ');
  
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  formatted = formatted.trim();
  
  return formatted;
}

function splitResponse(text: string, maxLength: number = 1850): string[] {
  if (text.length <= maxLength) return [text];
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks: { start: number; end: number; content: string }[] = [];
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    codeBlocks.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[0]
    });
  }
  
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    const isInCodeBlock = codeBlocks.some(block => 
      text.indexOf(sentence) >= block.start && text.indexOf(sentence) < block.end
    );
    
    if (isInCodeBlock) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      const relevantBlock = codeBlocks.find(block => 
        text.indexOf(sentence) >= block.start && text.indexOf(sentence) < block.end
      );
      
      if (relevantBlock && relevantBlock.content.length > maxLength) {
        const lines = relevantBlock.content.split('\n');
        const lang = lines[0].replace('```', '');
        let codeChunk = '```' + lang + '\n';
        
        for (let i = 1; i < lines.length - 1; i++) {
          if (codeChunk.length + lines[i].length + 4 > maxLength) {
            codeChunk += '```';
            chunks.push(codeChunk);
            codeChunk = '```' + lang + '\n' + lines[i] + '\n';
          } else {
            codeChunk += lines[i] + '\n';
          }
        }
        codeChunk += '```';
        chunks.push(codeChunk);
      } else if (relevantBlock) {
        chunks.push(relevantBlock.content);
      }
      continue;
    }
    
    if (currentChunk.length + sentence.length + 1 > maxLength) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        const words = sentence.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          if (wordChunk.length + word.length + 1 > maxLength) {
            if (wordChunk.length > 0) {
              chunks.push(wordChunk.trim());
              wordChunk = word;
            } else {
              chunks.push(word);
            }
          } else {
            wordChunk += (wordChunk.length > 0 ? ' ' : '') + word;
          }
        }
        
        if (wordChunk.length > 0) {
          currentChunk = wordChunk;
        }
      }
    } else {
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

async function sendSingleMessage(
  interaction: ChatInputCommandInteraction,
  model: any,
  response: string,
  question: string,
  enableSearch: boolean,
  isEphemeral: boolean,
  responseTime: string,
  sessionManager: UserSessionManager,
  userId: string
) {
  const embed = new EmbedBuilder()
    .setColor(getProviderColor(model.provider))
    .setAuthor({
      name: `${getProviderEmoji(model.provider)} ${model.name}`,
      iconURL: getUserAvatarUrl(interaction.user)
    })
    .setTitle('💬 AI Response')
    .setDescription(response);

  if (model.features.imageGen && model.name.includes('Imagegen')) {
    embed
      .setTitle('🎨 Generated Image')
      .setDescription('Your image has been generated! Click the link to view it.');
  }

  const features = Object.entries(model.features)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => FEATURE_EMOJIS[feature as keyof typeof FEATURE_EMOJIS] || '✓')
    .join(' ');

  embed.addFields(
    {
      name: '🔧 Model Info',
      value: `**Provider:** ${model.provider}\n**Features:** ${features || 'Standard'}`,
      inline: true
    },
    {
      name: '⚡ Performance',
      value: `**Response Time:** ${responseTime}s\n**Search:** ${enableSearch ? 'Enabled' : 'Disabled'}`,
      inline: true
    },
    {
      name: '👤 Request Info',
      value: `**User:** ${interaction.user.displayName}\n**Privacy:** ${isEphemeral ? 'Private' : 'Public'}`,
      inline: true
    }
  );

  embed
    .setFooter({ 
      text: `T3.CHAT via ${model.provider} • Response ${sessionManager.getUserSession(userId)?.requestCount || 1}`,
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
    })
    .setTimestamp();

  const actionRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`regenerate_${interaction.id}`)
        .setLabel('🔄 Regenerate')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`change_model_${interaction.id}`)
        .setLabel('🔧 Change Model')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setURL(createT3ChatUrl(model, question))
        .setLabel('🌐 Open in T3.CHAT')
        .setStyle(ButtonStyle.Link)
    );

  await interaction.editReply({ 
    embeds: [embed], 
    components: [actionRow] 
  });
}

async function sendMultipleMessages(
  interaction: ChatInputCommandInteraction,
  model: any,
  response: string,
  question: string,
  enableSearch: boolean,
  isEphemeral: boolean,
  responseTime: string,
  sessionManager: UserSessionManager,
  userId: string
) {
  const chunks = splitResponse(response, 1850);
  const totalChunks = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const isFirstMessage = i === 0;
    const isLastMessage = i === chunks.length - 1;
    
    if (isFirstMessage) {
      const embed = new EmbedBuilder()
        .setColor(getProviderColor(model.provider))
        .setAuthor({
          name: `${getProviderEmoji(model.provider)} ${model.name}`,
          iconURL: getUserAvatarUrl(interaction.user)
        })
        .setTitle(`💬 AI Response (Part ${i + 1}/${totalChunks})`)
        .setDescription(chunks[i]);

      if (model.features.imageGen && model.name.includes('Imagegen')) {
        embed.setTitle('🎨 Generated Image');
      }

      const features = Object.entries(model.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => FEATURE_EMOJIS[feature as keyof typeof FEATURE_EMOJIS] || '✓')
        .join(' ');

      embed.addFields(
        {
          name: '🔧 Model Info',
          value: `**Provider:** ${model.provider}\n**Features:** ${features || 'Standard'}`,
          inline: true
        },
        {
          name: '⚡ Performance',
          value: `**Response Time:** ${responseTime}s\n**Search:** ${enableSearch ? 'Enabled' : 'Disabled'}`,
          inline: true
        },
        {
          name: '👤 Request Info',
          value: `**User:** ${interaction.user.displayName}\n**Privacy:** ${isEphemeral ? 'Private' : 'Public'}`,
          inline: true
        }
      );

      if (totalChunks > 1) {
        embed.addFields({
          name: '📄 Multi-Part Response',
          value: `This response has been split into ${totalChunks} parts due to length.`,
          inline: false
        });
      }

      embed.setFooter({ 
        text: `T3.CHAT via ${model.provider} • Response ${sessionManager.getUserSession(userId)?.requestCount || 1}`,
        iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
      });

      await interaction.editReply({ embeds: [embed] });
      
    } else {
      const embed = new EmbedBuilder()
        .setColor(getProviderColor(model.provider))
        .setTitle(`💬 AI Response (Part ${i + 1}/${totalChunks})`)
        .setDescription(chunks[i])
        .setFooter({ 
          text: `Continued from previous message • Part ${i + 1} of ${totalChunks}` 
        });

      if (isLastMessage) {
        embed.setTimestamp();

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`regenerate_${interaction.id}`)
              .setLabel('🔄 Regenerate')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`change_model_${interaction.id}`)
              .setLabel('🔧 Change Model')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setURL(createT3ChatUrl(model, question))
              .setLabel('🌐 Open in T3.CHAT')
              .setStyle(ButtonStyle.Link)
          );

        await interaction.followUp({ 
          embeds: [embed], 
          components: [actionRow],
          flags: isEphemeral ? 64 : undefined
        });
      } else {
        await interaction.followUp({ 
          embeds: [embed],
          flags: isEphemeral ? 64 : undefined
        });
      }
    }
  }
}

function getProviderColor(provider: string): number {
  return PROVIDER_COLORS[provider.toLowerCase() as keyof typeof PROVIDER_COLORS] || PROVIDER_COLORS.default;
}

function getProviderEmoji(provider: string): string {
  return PROVIDER_EMOJIS[provider.toLowerCase() as keyof typeof PROVIDER_EMOJIS] || PROVIDER_EMOJIS.default;
}

function getUserAvatarUrl(user: any): string {
  return user.displayAvatarURL({ size: 32 });
}

function createT3ChatUrl(model: any, question: string): string {
  return model.url.replace('%s', encodeURIComponent(question));
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function isValidUrl(url: string): boolean {
  if (!url || url.trim().length === 0) {
    return false;
  }
  
  const trimmedUrl = url.trim();
  
  return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');
} 