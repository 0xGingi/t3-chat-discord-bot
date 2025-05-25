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
  tier?: 'Regular' | 'Premium';
}

export interface BotConfig {
  useBetaDomain: boolean;
  accessToken: string;
  currentModel: string;
}

export interface UserUsageTracker {
  regularUsage: Date[];
  premiumUsage: Date[];
}

export interface PermissionConfig {
  allowedUserIds: string[];
  allowedRoleIds: string[];
  rateLimitInterval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  rateLimitRegular: number;
  rateLimitPremium: number;
}

export interface UserSession {
  userId: string;
  currentModel: string;
  lastUsed: Date;
  requestCount: number;
  usageTracker: UserUsageTracker;
} 