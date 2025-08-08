import fs from 'fs';
import path from 'path';

export interface DebugEntry {
  timestamp: Date;
  type: 'technical_detection' | 'claude_response' | 'gemma_response' | 'error' | 'trust_issue' | 'update_issue' | 'conversation';
  userInput?: string;
  claudeOutput?: string;
  gemmaResponse?: string;
  isTechnical?: boolean;
  source?: string;
  error?: string;
  metadata?: any;
}

export class DebugLogger {
  private debugDir: string;
  private sessionFile: string;
  
  constructor() {
    this.debugDir = path.join(process.cwd(), 'debug');
    this.sessionFile = path.join(
      this.debugDir, 
      `debug_session_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    this.ensureDebugDir();
  }
  
  private ensureDebugDir() {
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }
  
  log(entry: Omit<DebugEntry, 'timestamp'>) {
    const debugEntry: DebugEntry = {
      ...entry,
      timestamp: new Date()
    };
    
    try {
      // Console log for development
      console.log(`[DEBUG-${entry.type.toUpperCase()}]`, {
        time: debugEntry.timestamp.toISOString(),
        user: entry.userInput?.substring(0, 50),
        technical: entry.isTechnical,
        source: entry.source
      });
      
      // Append to session file
      const logLine = JSON.stringify(debugEntry) + '\n';
      fs.appendFileSync(this.sessionFile, logLine);
      
    } catch (error) {
      console.error('Debug logging failed:', error);
    }
  }
  
  logTechnicalDetection(userInput: string, isTechnical: boolean, claudeExists: boolean) {
    this.log({
      type: 'technical_detection',
      userInput,
      isTechnical,
      metadata: { claudeExists, keywords: this.extractKeywords(userInput) }
    });
  }
  
  logClaudeResponse(userInput: string, claudeOutput: string, responseType: string) {
    this.log({
      type: 'claude_response',
      userInput,
      claudeOutput: claudeOutput.substring(0, 500), // Truncate for storage
      metadata: { responseType, outputLength: claudeOutput.length }
    });
  }
  
  logGemmaResponse(userInput: string, gemmaResponse: string, source: string) {
    this.log({
      type: 'gemma_response',
      userInput,
      gemmaResponse: gemmaResponse.substring(0, 500),
      source,
      metadata: { responseLength: gemmaResponse.length }
    });
  }
  
  logError(userInput: string, error: string, context: string) {
    this.log({
      type: 'error',
      userInput,
      error,
      metadata: { context }
    });
  }
  
  logTrustIssue(userInput: string, claudeOutput: string) {
    this.log({
      type: 'trust_issue',
      userInput,
      claudeOutput,
      metadata: { needsWorkspaceTrust: true }
    });
  }
  
  logUpdateIssue(userInput: string, claudeOutput: string) {
    this.log({
      type: 'update_issue',
      userInput,
      claudeOutput,
      metadata: { claudeUpdateFailed: true }
    });
  }
  
  private extractKeywords(input: string): string[] {
    const keywords = [
      'folder', 'file', 'directory', 'read', 'write', 'see', 'view', 'list', 
      'code', 'function', 'debug', 'error', 'ls', 'cd', 'pwd'
    ];
    const inputLower = input.toLowerCase();
    return keywords.filter(keyword => inputLower.includes(keyword));
  }
  
  // Development helper - get recent debug entries
  getRecentEntries(count: number = 10): DebugEntry[] {
    try {
      if (!fs.existsSync(this.sessionFile)) return [];
      
      const content = fs.readFileSync(this.sessionFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      return lines
        .slice(-count)
        .map(line => JSON.parse(line))
        .map(entry => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }));
    } catch (error) {
      console.error('Failed to read debug entries:', error);
      return [];
    }
  }
  
  // Summary for development
  getSummary() {
    const entries = this.getRecentEntries(100);
    
    return {
      total: entries.length,
      technicalQueries: entries.filter(e => e.type === 'technical_detection' && e.isTechnical).length,
      claudeResponses: entries.filter(e => e.type === 'claude_response').length,
      trustIssues: entries.filter(e => e.type === 'trust_issue').length,
      updateIssues: entries.filter(e => e.type === 'update_issue').length,
      errors: entries.filter(e => e.type === 'error').length,
      recentSources: entries.filter(e => e.source).map(e => e.source).slice(-10)
    };
  }
}