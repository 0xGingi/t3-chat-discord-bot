export interface ModelFeatures {
  vision?: boolean;
  reasoning?: boolean;
  pdf?: boolean;
  search?: boolean;
  effortControl?: boolean;
  fast?: boolean;
  imageGen?: boolean;
}

export interface Model {
  name: string;
  provider: string;
  url: string;
  features: ModelFeatures;
  specialNotes?: string;
}

export interface BotConfig {
  useBetaDomain: boolean;
  accessToken: string;
  currentModel: string;
}

export interface UserSession {
  userId: string;
  currentModel: string;
  lastUsed: Date;
  requestCount: number;
} 