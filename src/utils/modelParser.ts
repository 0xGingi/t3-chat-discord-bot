import { Model, ModelFeatures } from '../types/index.js';

export class ModelParser {
  private models: Model[] = [];

  async loadModels(): Promise<void> {
    try {
      const file = Bun.file('models.md');
      const content = await file.text();
      this.models = this.parseModels(content);
    } catch (error) {
      console.error('Error loading models.md:', error);
      throw error;
    }
  }

  private parseModels(content: string): Model[] {
    const lines = content.split('\n');
    const models: Model[] = [];
    let currentProvider = '';

    for (const line of lines) {
      if (line.startsWith('# ') && line.includes('Models')) {
        currentProvider = line.replace('# ', '').replace(' Models', '');
        continue;
      }

      if (line.includes('https://beta.t3.chat/new?model=')) {
        const model = this.parseModelLine(line, currentProvider);
        if (model) {
          models.push(model);
        }
      }
    }

    return models;
  }

  private parseModelLine(line: string, provider: string): Model | null {
    const match = line.match(/^(.+?)\s*\(([^)]*)\)\s*-\s*(https:\/\/beta\.t3\.chat\/new\?model=([^&]+)&q=%s)(.*)$/);
    
    if (!match) return null;

    const [, name, featuresStr, url, modelId, notes] = match;
    
    const features = this.parseFeatures(featuresStr);
    const specialNotes = notes.trim();
    const tier = this.parseTier(specialNotes);

    if (name.toLowerCase().includes('imagegen') || name.toLowerCase().includes('image gen')) {
      features.imageGen = true;
    }

    return {
      name: name.trim(),
      provider,
      url,
      features,
      specialNotes: specialNotes || undefined,
      tier
    };
  }

  private parseTier(notes: string): 'Regular' | 'Premium' {
    const lowerNotes = notes.toLowerCase();
    if (lowerNotes.includes('premium')) {
      return 'Premium';
    } else if (lowerNotes.includes('regular')) {
      return 'Regular';
    }
    return 'Regular';
  }

  private parseFeatures(featuresStr: string): ModelFeatures {
    const features: ModelFeatures = {};
    const featureList = featuresStr.split(',').map(f => f.trim().toLowerCase());

    for (const feature of featureList) {
      switch (feature) {
        case 'vision':
          features.vision = true;
          break;
        case 'reasoning':
          features.reasoning = true;
          break;
        case 'pdf':
          features.pdf = true;
          break;
        case 'search':
          features.search = true;
          break;
        case 'effort control':
          features.effortControl = true;
          break;
        case 'fast':
          features.fast = true;
          break;
      }
    }

    return features;
  }

  getModels(): Model[] {
    return this.models;
  }

  getModelByName(name: string): Model | undefined {
    return this.models.find(model => 
      model.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  getModelsByProvider(provider: string): Model[] {
    return this.models.filter(model => 
      model.provider.toLowerCase() === provider.toLowerCase()
    );
  }

  getModelsByFeature(feature: keyof ModelFeatures): Model[] {
    return this.models.filter(model => model.features[feature]);
  }

  getModelsByTier(tier: 'Regular' | 'Premium'): Model[] {
    return this.models.filter(model => model.tier === tier);
  }
} 