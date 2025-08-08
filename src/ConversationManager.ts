import fs from 'fs';
import path from 'path';

export interface ConversationEntry {
  id: string;
  timestamp: Date;
  userInput: string;
  aniResponse: string;
  claudeResponse?: string;
  source: string;
}

export class ConversationManager {
  private conversationsDir: string;
  private currentConversationFile: string;
  private conversations: ConversationEntry[] = [];
  private maxMemoryEntries = 100; // Keep last 100 exchanges in memory for context
  
  constructor() {
    this.conversationsDir = path.join(process.cwd(), 'conversations');
    this.currentConversationFile = path.join(
      this.conversationsDir, 
      `conversation_${new Date().toISOString().split('T')[0]}.json`
    );
    this.ensureDirectoryExists();
    this.loadTodaysConversation();
  }
  
  private ensureDirectoryExists() {
    if (!fs.existsSync(this.conversationsDir)) {
      fs.mkdirSync(this.conversationsDir, { recursive: true });
    }
  }
  
  private loadTodaysConversation() {
    try {
      if (fs.existsSync(this.currentConversationFile)) {
        const data = fs.readFileSync(this.currentConversationFile, 'utf8');
        const entries = JSON.parse(data);
        this.conversations = entries.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      this.conversations = [];
    }
  }
  
  addEntry(userInput: string, aniResponse: string, claudeResponse?: string, source = 'gemma') {
    const entry: ConversationEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      userInput,
      aniResponse,
      claudeResponse,
      source
    };
    
    this.conversations.push(entry);
    this.saveConversation();
    
    // Keep memory manageable
    if (this.conversations.length > 500) {
      // Keep recent entries in file, trim memory
      this.conversations = this.conversations.slice(-this.maxMemoryEntries);
    }
  }
  
  private saveConversation() {
    try {
      fs.writeFileSync(
        this.currentConversationFile, 
        JSON.stringify(this.conversations, null, 2)
      );
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }
  
  getRecentContext(limit = 5): string {
    const recent = this.conversations.slice(-limit);
    return recent.map(entry => 
      `User: ${entry.userInput}\nAni: ${entry.aniResponse}`
    ).join('\n\n');
  }
  
  getConversationStats() {
    return {
      totalEntries: this.conversations.length,
      memoryEntries: Math.min(this.conversations.length, this.maxMemoryEntries),
      claudeUsage: this.conversations.filter(c => c.source.includes('claude')).length,
      gemmaOnly: this.conversations.filter(c => c.source === 'gemma').length
    };
  }
}