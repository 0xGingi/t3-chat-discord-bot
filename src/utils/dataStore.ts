import { UserSession } from '../types/index.js';

export interface DataStore {
  sessions: { [userId: string]: UserSession };
  lastSaved: string;
}

export class DataStoreManager {
  private dataFilePath = 'data/bot-data.json';
  private dataDir = 'data';

  constructor() {
    this.ensureDataStructure();
  }

  private async ensureDataStructure(): Promise<void> {
    console.log('🔍 Checking data storage structure...');
    
    try {
      await this.ensureDataDirectory();
      await this.ensureDataFile();
    } catch (error) {
      console.error('❌ Error setting up data storage:', error);
      throw error;
    }
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      const fs = require('fs');
      
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        console.log(`📁 Created data directory: ${this.dataDir}`);
      } else {
        console.log(`✅ Data directory exists: ${this.dataDir}`);
      }
    } catch (error) {
      console.error('❌ Error creating data directory:', error);
      throw error;
    }
  }

  private async ensureDataFile(): Promise<void> {
    try {
      const file = Bun.file(this.dataFilePath);
      
      if (!(await file.exists())) {
        const initialData: DataStore = {
          sessions: {},
          lastSaved: new Date().toISOString()
        };
        
        await Bun.write(this.dataFilePath, JSON.stringify(initialData, null, 2));
        console.log(`📄 Created data file: ${this.dataFilePath}`);
      } else {
        console.log(`✅ Data file exists: ${this.dataFilePath}`);
        
        try {
          const content = await file.text();
          JSON.parse(content);
          console.log(`✅ Data file is valid JSON`);
        } catch (parseError) {
          console.warn(`⚠️ Data file is corrupted, creating backup and recreating...`);
          await this.createBackupAndResetDataFile();
        }
      }
    } catch (error) {
      console.error('❌ Error ensuring data file:', error);
      throw error;
    }
  }

  private async createBackupAndResetDataFile(): Promise<void> {
    try {
      const fs = require('fs');
      const backupPath = `${this.dataFilePath}.backup.${Date.now()}`;
      
      if (fs.existsSync(this.dataFilePath)) {
        fs.copyFileSync(this.dataFilePath, backupPath);
        console.log(`💾 Created backup: ${backupPath}`);
      }
      
      const initialData: DataStore = {
        sessions: {},
        lastSaved: new Date().toISOString()
      };
      
      await Bun.write(this.dataFilePath, JSON.stringify(initialData, null, 2));
      console.log(`🔄 Reset data file with clean structure`);
    } catch (error) {
      console.error('❌ Error creating backup and resetting data file:', error);
      throw error;
    }
  }

  async loadData(): Promise<DataStore> {
    try {
      await this.ensureDataStructure();
      
      const file = Bun.file(this.dataFilePath);
      
      if (await file.exists()) {
        const content = await file.text();
        const data = JSON.parse(content) as DataStore;
        
        for (const [userId, session] of Object.entries(data.sessions)) {
          session.lastUsed = new Date(session.lastUsed);
          
          if (session.usageTracker?.regularUsage) {
            session.usageTracker.regularUsage = session.usageTracker.regularUsage.map(date => new Date(date));
          }
          if (session.usageTracker?.premiumUsage) {
            session.usageTracker.premiumUsage = session.usageTracker.premiumUsage.map(date => new Date(date));
          }
          
          if (!session.usageTracker) {
            session.usageTracker = {
              regularUsage: [],
              premiumUsage: []
            };
          }
        }
        
        console.log(`📊 Loaded ${Object.keys(data.sessions).length} user sessions from storage`);
        return data;
      }
    } catch (error) {
      console.error('❌ Error loading data from storage:', error);
      console.log('🔄 Falling back to empty data structure');
    }

    return {
      sessions: {},
      lastSaved: new Date().toISOString()
    };
  }

  async saveData(sessions: Map<string, UserSession>): Promise<void> {
    try {
      await this.ensureDataStructure();
      
      const data: DataStore = {
        sessions: Object.fromEntries(sessions),
        lastSaved: new Date().toISOString()
      };

      await Bun.write(this.dataFilePath, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${sessions.size} user sessions to storage`);
    } catch (error) {
      console.error('❌ Error saving data to storage:', error);
    }
  }

  async clearOldData(): Promise<void> {
    try {
      const data = await this.loadData();
      const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      let removedCount = 0;
      for (const [userId, session] of Object.entries(data.sessions)) {
        if (new Date(session.lastUsed) < cutoffTime) {
          delete data.sessions[userId];
          removedCount++;
        }
      }

      if (removedCount > 0) {
        await Bun.write(this.dataFilePath, JSON.stringify(data, null, 2));
        console.log(`🧹 Removed ${removedCount} old user sessions from storage`);
      }
    } catch (error) {
      console.error('❌ Error clearing old data:', error);
    }
  }

  async getStorageStats(): Promise<{ sessionCount: number; fileSize: string; lastSaved: string }> {
    try {
      const data = await this.loadData();
      const file = Bun.file(this.dataFilePath);
      let fileSize = '0KB';
      
      if (await file.exists()) {
        try {
          const fs = require('fs');
          const stat = fs.statSync(this.dataFilePath);
          fileSize = `${Math.round(stat.size / 1024)}KB`;
        } catch {
          fileSize = 'Unknown';
        }
      }
      
      const stats = {
        sessionCount: Object.keys(data.sessions).length,
        fileSize,
        lastSaved: data.lastSaved
      };
      return stats;
    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      return { sessionCount: 0, fileSize: '0KB', lastSaved: 'Never' };
    }
  }

  async validateDataIntegrity(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const fs = require('fs');
      
      if (!fs.existsSync(this.dataDir)) {
        issues.push('Data directory does not exist');
      }
      
      if (!fs.existsSync(this.dataFilePath)) {
        issues.push('Data file does not exist');
      } else {
        try {
          const content = await Bun.file(this.dataFilePath).text();
          const data = JSON.parse(content);
          
          if (!data.sessions) {
            issues.push('Data file missing sessions object');
          }
          
          if (!data.lastSaved) {
            issues.push('Data file missing lastSaved timestamp');
          }
        } catch (parseError) {
          issues.push('Data file contains invalid JSON');
        }
      }
      
      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return { isValid: false, issues };
    }
  }
} 