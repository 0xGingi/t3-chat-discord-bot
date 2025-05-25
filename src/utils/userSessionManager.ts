import { UserSession, UserUsageTracker } from '../types/index.js';
import { DataStoreManager } from './dataStore.js';

export class UserSessionManager {
  private sessions: Map<string, UserSession> = new Map();
  private defaultModel: string;
  private dataStore: DataStoreManager;
  private saveTimer: Timer | null = null;
  private saveDebounceTimer: Timer | null = null;

  constructor() {
    this.defaultModel = process.env.DEFAULT_MODEL || 'Gemini 2.5 Flash';
    this.dataStore = new DataStoreManager();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing UserSessionManager...');
      
      const validation = await this.dataStore.validateDataIntegrity();
      if (validation.isValid) {
        console.log('✅ Data integrity check passed');
      } else {
        console.warn('⚠️ Data integrity issues found:');
        validation.issues.forEach(issue => console.warn(`  - ${issue}`));
        console.log('🔧 Attempting to fix issues...');
      }
      
      const data = await this.dataStore.loadData();
      this.sessions = new Map(Object.entries(data.sessions));
      console.log(`📊 UserSessionManager initialized with ${this.sessions.size} sessions`);
      
      this.startPeriodicCleanup();
    } catch (error) {
      console.error('❌ Error initializing UserSessionManager:', error);
      throw error;
    }
  }

  private startPeriodicCleanup(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    
    this.saveTimer = setInterval(async () => {
      await this.cleanupOldSessions();
    }, 60 * 60 * 1000);
  }

  private debouncedSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    
    this.saveDebounceTimer = setTimeout(async () => {
      await this.saveData();
    }, 1000);
  }

  async saveData(): Promise<void> {
    try {
      await this.dataStore.saveData(this.sessions);
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    await this.saveData();
    console.log('UserSessionManager shutdown complete');
  }

  getUserSession(userId: string): UserSession | undefined {
    return this.sessions.get(userId);
  }

  private createEmptyUsageTracker(): UserUsageTracker {
    return {
      regularUsage: [],
      premiumUsage: []
    };
  }

  setUserModel(userId: string, modelName: string): void {
    const existingSession = this.sessions.get(userId);
    
    if (existingSession) {
      existingSession.currentModel = modelName;
      existingSession.lastUsed = new Date();
    } else {
      this.sessions.set(userId, {
        userId,
        currentModel: modelName,
        lastUsed: new Date(),
        requestCount: 0,
        usageTracker: this.createEmptyUsageTracker()
      });
    }
    
    this.debouncedSave();
  }

  getCurrentModel(userId: string): string {
    const session = this.sessions.get(userId);
    return session?.currentModel || this.defaultModel;
  }

  updateLastUsed(userId: string): void {
    const session = this.sessions.get(userId);
    if (session) {
      session.lastUsed = new Date();
      session.requestCount = (session.requestCount || 0) + 1;
    } else {
      this.sessions.set(userId, {
        userId,
        currentModel: this.defaultModel,
        lastUsed: new Date(),
        requestCount: 1,
        usageTracker: this.createEmptyUsageTracker()
      });
    }
    
    this.debouncedSave();
  }

  getOrCreateSession(userId: string): UserSession {
    let session = this.sessions.get(userId);
    let needsSave = false;
    
    if (!session) {
      session = {
        userId,
        currentModel: this.defaultModel,
        lastUsed: new Date(),
        requestCount: 0,
        usageTracker: this.createEmptyUsageTracker()
      };
      this.sessions.set(userId, session);
      needsSave = true;
    }
    
    if (!session.usageTracker) {
      session.usageTracker = this.createEmptyUsageTracker();
      needsSave = true;
    }
    
    if (needsSave) {
      this.debouncedSave();
    }
    
    return session;
  }

  updateSession(userId: string, updates: Partial<UserSession>): void {
    const session = this.getOrCreateSession(userId);
    Object.assign(session, updates);
    this.debouncedSave();
  }

  getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  async cleanupOldSessions(maxAgeHours: number = 24 * 7): Promise<void> {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let removedCount = 0;
    
    for (const [userId, session] of this.sessions.entries()) {
      if (session.lastUsed < cutoffTime) {
        this.sessions.delete(userId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old sessions`);
      await this.saveData();
    }
    
    await this.dataStore.clearOldData();
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  setDefaultModel(modelName: string): void {
    this.defaultModel = modelName;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async getStorageStats(): Promise<{ sessionCount: number; fileSize: string; lastSaved: string }> {
    return await this.dataStore.getStorageStats();
  }
}