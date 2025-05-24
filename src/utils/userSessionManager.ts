import { UserSession } from '../types/index.js';

export class UserSessionManager {
  private sessions: Map<string, UserSession> = new Map();
  private defaultModel: string = 'Gemini 2.5 Flash Thinking';

  getUserSession(userId: string): UserSession | undefined {
    return this.sessions.get(userId);
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
        requestCount: 0
      });
    }
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
        requestCount: 1
      });
    }
  }

  getAllSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  cleanupOldSessions(maxAgeHours: number = 24 * 7): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [userId, session] of this.sessions.entries()) {
      if (session.lastUsed < cutoffTime) {
        this.sessions.delete(userId);
      }
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  setDefaultModel(modelName: string): void {
    this.defaultModel = modelName;
  }
} 