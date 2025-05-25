import { ChatInputCommandInteraction } from 'discord.js';
import { PermissionConfig, UserUsageTracker } from '../types/index.js';

export class PermissionManager {
  private config: PermissionConfig;
  private onDataChanged?: () => void;

  constructor(onDataChanged?: () => void) {
    this.onDataChanged = onDataChanged;
    this.config = {
      allowedUserIds: this.parseIds(process.env.ALLOWED_USER_IDS || ''),
      allowedRoleIds: this.parseIds(process.env.ALLOWED_ROLE_IDS || ''),
      rateLimitInterval: (process.env.RATE_LIMIT_INTERVAL as 'hourly' | 'daily' | 'weekly' | 'monthly') || 'daily',
      rateLimitRegular: parseInt(process.env.RATE_LIMIT_REGULAR || '100'),
      rateLimitPremium: parseInt(process.env.RATE_LIMIT_PREMIUM || '10')
    };
  }

  private parseIds(idsString: string): string[] {
    return idsString
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }

  async checkPermissions(interaction: ChatInputCommandInteraction): Promise<{ allowed: boolean; reason?: string }> {
    const userId = interaction.user.id;
    
    if (this.config.allowedUserIds.length === 0 && this.config.allowedRoleIds.length === 0) {
      return { allowed: true };
    }

    if (this.config.allowedUserIds.includes(userId)) {
      return { allowed: true };
    }

    if (this.config.allowedRoleIds.length > 0 && interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        const userRoles = member.roles.cache.map(role => role.id);
        
        const hasAllowedRole = this.config.allowedRoleIds.some(roleId => 
          userRoles.includes(roleId)
        );
        
        if (hasAllowedRole) {
          return { allowed: true };
        }
      } catch (error) {
        console.error('Error fetching member roles:', error);
      }
    }

    return { 
      allowed: false, 
      reason: 'You do not have permission to use this bot.' 
    };
  }

  checkRateLimit(usageTracker: UserUsageTracker, isPremium: boolean): { allowed: boolean; reason?: string; nextReset?: Date } {
    const now = new Date();
    const limit = isPremium ? this.config.rateLimitPremium : this.config.rateLimitRegular;
    const usage = isPremium ? usageTracker.premiumUsage : usageTracker.regularUsage;

    this.cleanupOldUsage(usageTracker, now);

    if (usage.length >= limit) {
      const periodStart = this.getPeriodStart(now);
      const nextReset = this.getNextReset(now);
      
      return {
        allowed: false,
        reason: `Rate limit exceeded for ${this.config.rateLimitInterval}. You've used ${usage.length}/${limit} ${isPremium ? 'premium' : 'regular'} requests.`,
        nextReset
      };
    }

    return { allowed: true };
  }

  recordUsage(usageTracker: UserUsageTracker, isPremium: boolean): void {
    const now = new Date();
    const usage = isPremium ? usageTracker.premiumUsage : usageTracker.regularUsage;

    usage.push(now);
    this.cleanupOldUsage(usageTracker, now);
    
    if (this.onDataChanged) {
      this.onDataChanged();
    }
  }

  private cleanupOldUsage(usageTracker: UserUsageTracker, now: Date): void {
    const cutoffTime = this.getPeriodStart(now);

    usageTracker.regularUsage = usageTracker.regularUsage.filter(date => date >= cutoffTime);
    usageTracker.premiumUsage = usageTracker.premiumUsage.filter(date => date >= cutoffTime);
  }

  private getPeriodStart(now: Date): Date {
    const date = new Date(now);
    
    switch (this.config.rateLimitInterval) {
      case 'hourly':
        date.setMinutes(0, 0, 0);
        break;
      case 'daily':
        date.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        const dayOfWeek = date.getDay();
        date.setDate(date.getDate() - dayOfWeek);
        date.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
    }
    
    return date;
  }

  private getNextReset(now: Date): Date {
    const date = new Date(now);
    
    switch (this.config.rateLimitInterval) {
      case 'hourly':
        date.setHours(date.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        const dayOfWeek = date.getDay();
        date.setDate(date.getDate() + (7 - dayOfWeek));
        date.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1, 1);
        date.setHours(0, 0, 0, 0);
        break;
    }
    
    return date;
  }

  getUsageStats(usageTracker: UserUsageTracker): { regular: number; premium: number; limit: { regular: number; premium: number }; interval: string } {
    this.cleanupOldUsage(usageTracker, new Date());
    
    return {
      regular: usageTracker.regularUsage.length,
      premium: usageTracker.premiumUsage.length,
      limit: {
        regular: this.config.rateLimitRegular,
        premium: this.config.rateLimitPremium
      },
      interval: this.config.rateLimitInterval
    };
  }

  getRemainingQuota(usageTracker: UserUsageTracker): { regular: number; premium: number } {
    const stats = this.getUsageStats(usageTracker);
    
    return {
      regular: Math.max(0, stats.limit.regular - stats.regular),
      premium: Math.max(0, stats.limit.premium - stats.premium)
    };
  }
} 