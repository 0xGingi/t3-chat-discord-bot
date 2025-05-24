import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder
} from 'discord.js';
import { ModelParser } from '../utils/modelParser.js';
import { UserSessionManager } from '../utils/userSessionManager.js';

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
  .setName('model')
  .setDescription('Change or view the current AI model')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set a specific model by name')
      .addStringOption(option =>
        option
          .setName('name')
          .setDescription('The model name to use')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List all available models')
      .addStringOption(option =>
        option
          .setName('provider')
          .setDescription('Filter by provider')
          .setRequired(false)
          .addChoices(
            { name: 'OpenAI', value: 'openai' },
            { name: 'Anthropic', value: 'anthropic' },
            { name: 'Google', value: 'google' },
            { name: 'Meta', value: 'meta' },
            { name: 'Deepseek', value: 'deepseek' },
            { name: 'Grok', value: 'grok' },
            { name: 'Qwen', value: 'qwen' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('current')
      .setDescription('Show your current model')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('features')
      .setDescription('List models by feature')
      .addStringOption(option =>
        option
          .setName('feature')
          .setDescription('Feature to filter by')
          .setRequired(true)
          .addChoices(
            { name: 'Vision (Image Processing)', value: 'vision' },
            { name: 'Web Search', value: 'search' },
            { name: 'PDF Processing', value: 'pdf' },
            { name: 'Advanced Reasoning', value: 'reasoning' },
            { name: 'Image Generation', value: 'imageGen' },
            { name: 'Fast Response', value: 'fast' },
            { name: 'Effort Control', value: 'effortControl' }
          )
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction, 
  modelParser: ModelParser, 
  sessionManager: UserSessionManager
) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'set':
      await handleSetModel(interaction, modelParser, sessionManager);
      break;
    case 'list':
      await handleListModels(interaction, modelParser);
      break;
    case 'current':
      await handleCurrentModel(interaction, sessionManager, modelParser);
      break;
    case 'features':
      await handleFeatureFilter(interaction, modelParser);
      break;
    default:
      await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
  }
}

export async function autocomplete(
  interaction: any,
  modelParser: ModelParser
) {
  const focusedValue = interaction.options.getFocused();
  const allModels = modelParser.getModels();
  
  const filtered = allModels
    .filter(model => 
      model.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
      model.provider.toLowerCase().includes(focusedValue.toLowerCase())
    )
    .sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().startsWith(focusedValue.toLowerCase());
      const bNameMatch = b.name.toLowerCase().startsWith(focusedValue.toLowerCase());
      
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      
      const aProviderMatch = a.provider.toLowerCase().startsWith(focusedValue.toLowerCase());
      const bProviderMatch = b.provider.toLowerCase().startsWith(focusedValue.toLowerCase());
      
      if (aProviderMatch && !bProviderMatch) return -1;
      if (!aProviderMatch && bProviderMatch) return 1;
      
      return a.name.localeCompare(b.name);
    })
    .slice(0, 25)
    .map(model => {
      const features = Object.entries(model.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => FEATURE_EMOJIS[feature as keyof typeof FEATURE_EMOJIS] || '✓')
        .slice(0, 3)
        .join('');
      
      return {
        name: `${getProviderEmoji(model.provider)} ${model.name} ${features}`,
        value: model.name
      };
    });

  await interaction.respond(filtered);
}

async function handleSetModel(
  interaction: ChatInputCommandInteraction, 
  modelParser: ModelParser, 
  sessionManager: UserSessionManager
) {
  const modelName = interaction.options.get('name')?.value as string;
  const model = modelParser.getModelByName(modelName);

  if (!model) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle('❌ Model Not Found')
      .setDescription(`**"${modelName}"** is not available.`)
      .addFields({
        name: '💡 Suggestions',
        value: '• Use `/model list` to see all available models\n• Check your spelling\n• Try `/model list provider:google` to filter by provider',
        inline: false
      })
      .setFooter({ text: 'T3.CHAT Discord Bot • Model Selection' })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  sessionManager.setUserModel(interaction.user.id, model.name);

  const embed = new EmbedBuilder()
    .setColor(getProviderColor(model.provider))
    .setTitle('✅ Model Changed Successfully')
    .setAuthor({
      name: `${getProviderEmoji(model.provider)} ${model.name}`,
      iconURL: interaction.user.displayAvatarURL({ size: 32 })
    })
    .setDescription(`You are now using **${model.name}** by ${model.provider}`)
    .addFields(
      { 
        name: '🔧 Features', 
        value: formatFeatures(model.features), 
        inline: true 
      },
      {
        name: '📊 Provider Info',
        value: `**Company:** ${model.provider}\n**Type:** AI Language Model`,
        inline: true
      }
    )
    .setFooter({ text: `Ready to chat! Use /ask to start asking questions.` })
    .setTimestamp();

  if (model.specialNotes) {
    embed.addFields({ 
      name: '📌 Special Notes', 
      value: model.specialNotes, 
      inline: false 
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleListModels(interaction: ChatInputCommandInteraction, modelParser: ModelParser) {
  const provider = interaction.options.get('provider')?.value as string;
  let models = modelParser.getModels();

  if (provider) {
    models = modelParser.getModelsByProvider(provider);
  }

  if (models.length === 0) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xffa502)
      .setTitle('🔍 No Models Found')
      .setDescription(`No models found for ${provider ? `provider **${provider}**` : 'the specified criteria'}.`)
      .addFields({
        name: '💡 Try',
        value: '• Remove filters to see all models\n• Check provider spelling\n• Use different search criteria',
        inline: false
      })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(provider ? getProviderColor(provider) : 0x5865f2)
    .setTitle(`🤖 ${provider ? `${provider.charAt(0).toUpperCase() + provider.slice(1)} Models` : 'All Available Models'}`)
    .setDescription(`Found **${models.length}** AI models${provider ? ` from ${provider}` : ' across all providers'}`)
    .setFooter({ text: `Use /model set <name> to select a model • Total: ${models.length} models` })
    .setTimestamp();

  const groupedModels: { [key: string]: typeof models } = {};
  
  for (const model of models) {
    if (!groupedModels[model.provider]) {
      groupedModels[model.provider] = [];
    }
    groupedModels[model.provider].push(model);
  }

  for (const [providerName, providerModels] of Object.entries(groupedModels)) {
    const modelList = providerModels
      .map(model => `${getProviderEmoji(providerName)} **${model.name}** ${formatFeaturesCompact(model.features)}`)
      .join('\n');
    
    embed.addFields({ 
      name: `${providerName} (${providerModels.length} models)`, 
      value: modelList.substring(0, 1020) + (modelList.length > 1020 ? '...' : ''), 
      inline: false 
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleCurrentModel(
  interaction: ChatInputCommandInteraction, 
  sessionManager: UserSessionManager, 
  modelParser: ModelParser
) {
  const userSession = sessionManager.getUserSession(interaction.user.id);
  
  if (!userSession) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xffa502)
      .setTitle('🎯 No Model Selected')
      .setDescription('You haven\'t set a model yet. Let\'s get you started!')
      .addFields({
        name: '🚀 Quick Start',
        value: '• Use `/model set <name>` to choose a model\n• Try `/model list` to see all options\n• Use `/model list provider:google` for Google models',
        inline: false
      })
      .setFooter({ text: 'T3.CHAT Discord Bot • Ready to help!' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const model = modelParser.getModelByName(userSession.currentModel);
  
  if (!model) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff4757)
      .setTitle('⚠️ Model Unavailable')
      .setDescription('Your current model is no longer available.')
      .addFields({
        name: '🔧 What to do',
        value: '• Use `/model set` to choose a new model\n• Try `/model list` to see current options\n• Your previous selection may have been updated',
        inline: false
      })
      .setFooter({ text: 'Model compatibility check failed' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(getProviderColor(model.provider))
    .setTitle('🎯 Your Current Model')
    .setAuthor({
      name: `${getProviderEmoji(model.provider)} ${model.name}`,
      iconURL: interaction.user.displayAvatarURL({ size: 32 })
    })
    .setDescription(`**${model.name}** by ${model.provider}`)
    .addFields(
      { 
        name: '🔧 Features', 
        value: formatFeatures(model.features), 
        inline: true 
      },
      { 
        name: '📊 Usage Stats', 
        value: `**Last Used:** ${userSession.lastUsed.toLocaleString()}\n**Total Requests:** ${userSession.requestCount}`, 
        inline: true 
      },
      {
        name: '👤 Session Info',
        value: `**User:** ${interaction.user.displayName}\n**Provider:** ${model.provider}`,
        inline: true
      }
    )
    .setFooter({ text: 'Ready to chat! Use /ask to start asking questions.' })
    .setTimestamp();

  if (model.specialNotes) {
    embed.addFields({ 
      name: '📌 Special Notes', 
      value: model.specialNotes, 
      inline: false 
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleFeatureFilter(interaction: ChatInputCommandInteraction, modelParser: ModelParser) {
  const feature = interaction.options.get('feature')?.value as string;
  const models = modelParser.getModelsByFeature(feature as any);

  if (models.length === 0) {
    const errorEmbed = new EmbedBuilder()
      .setColor(0xffa502)
      .setTitle('🔍 No Models Found')
      .setDescription(`No models found with the **${feature}** feature.`)
      .addFields({
        name: '💡 Suggestions',
        value: '• Try a different feature filter\n• Use `/model list` to see all models\n• Some features may be limited to specific providers',
        inline: false
      })
      .setFooter({ text: 'Feature search completed' })
      .setTimestamp();
    
    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    return;
  }

  const featureEmoji = FEATURE_EMOJIS[feature as keyof typeof FEATURE_EMOJIS] || '✨';
  const featureName = feature.charAt(0).toUpperCase() + feature.slice(1);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${featureEmoji} Models with ${featureName}`)
    .setDescription(`Found **${models.length}** model(s) with **${featureName}** capabilities`)
    .setFooter({ text: `Use /model set <name> to select • ${models.length} models found` })
    .setTimestamp();

  const groupedModels: { [key: string]: typeof models } = {};
  
  for (const model of models) {
    if (!groupedModels[model.provider]) {
      groupedModels[model.provider] = [];
    }
    groupedModels[model.provider].push(model);
  }

  for (const [providerName, providerModels] of Object.entries(groupedModels)) {
    const modelList = providerModels
      .map(model => `${getProviderEmoji(providerName)} **${model.name}** ${formatFeaturesCompact(model.features)}`)
      .join('\n');
    
    embed.addFields({ 
      name: `${providerName} (${providerModels.length} models)`, 
      value: modelList.substring(0, 1020) + (modelList.length > 1020 ? '...' : ''), 
      inline: false 
    });
  }

  await interaction.reply({ embeds: [embed] });
}

function formatFeatures(features: any): string {
  const activeFeatures = Object.entries(features)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => {
      const emoji = FEATURE_EMOJIS[feature as keyof typeof FEATURE_EMOJIS] || '✓';
      const name = feature === 'effortControl' ? 'Effort Control' : 
                  feature === 'imageGen' ? 'Image Gen' :
                  feature.charAt(0).toUpperCase() + feature.slice(1);
      return `${emoji} ${name}`;
    });

  return activeFeatures.length > 0 ? activeFeatures.join('\n') : '📋 Standard Features';
}

function formatFeaturesCompact(features: any): string {
  const activeFeatures = Object.entries(features)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => FEATURE_EMOJIS[feature as keyof typeof FEATURE_EMOJIS] || '✓');

  return activeFeatures.length > 0 ? activeFeatures.join('') : '📋';
}

function getProviderColor(provider: string): number {
  return PROVIDER_COLORS[provider.toLowerCase() as keyof typeof PROVIDER_COLORS] || PROVIDER_COLORS.default;
}

function getProviderEmoji(provider: string): string {
  return PROVIDER_EMOJIS[provider.toLowerCase() as keyof typeof PROVIDER_EMOJIS] || PROVIDER_EMOJIS.default;
} 