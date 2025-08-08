import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as pty from 'node-pty';
import { DebugLogger } from './DebugLogger';

interface OllamaClient {
  generate(prompt: string): Promise<{ response?: string; error?: string }>;
  testConnection(): Promise<boolean>;
}

class SimpleOllamaClient implements OllamaClient {
  private baseUrl: string;
  private model: string;
  
  constructor(host = '10.10.20.19', port = 11434) {
    this.baseUrl = `http://${host}:${port}`;
    this.model = 'gemma3n:e4b';
  }
  
  async generate(prompt: string): Promise<{ response?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
        }),
      });
      
      if (!response.ok) {
        return { error: `Ollama request failed: ${response.statusText}` };
      }
      
      const data = await response.json();
      return { response: data.response };
    } catch (error) {
      return { error: `Ollama connection failed: ${error}` };
    }
  }
  
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export class AIWrapper {
  private ollama: OllamaClient;
  private personalityPrompt: string = '';
  private claudeProcess: pty.IPty | null = null;
  private claudeOutputBuffer: string[] = [];
  private debugLogger: DebugLogger;
  public onClaudeOutput?: (output: string[]) => void;
  public onThinking?: (isThinking: boolean) => void;
  public onClaudeProcessing?: (isProcessing: boolean) => void;
  
  constructor() {
    this.ollama = new SimpleOllamaClient();
    this.debugLogger = new DebugLogger();
    this.loadPersonalityPrompt();
    this.startClaudeCode();
  }
  
  private loadPersonalityPrompt() {
    try {
      if (fs.existsSync('personality.txt')) {
        this.personalityPrompt = fs.readFileSync('personality.txt', 'utf8').trim();
      } else {
        this.personalityPrompt = 'You are a helpful AI assistant.';
      }
    } catch (error) {
      console.error('Failed to load personality prompt:', error);
      this.personalityPrompt = 'You are a helpful AI assistant.';
    }
  }
  
  private startClaudeCode() {
    try {
      this.claudeProcess = pty.spawn('claude', [], {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: process.cwd(),
        env: process.env,
      });
      
      this.claudeProcess.onData((data) => {
        // Filter out ANSI escape codes and UI noise
        const cleanData = data
          .replace(/\x1b\[[0-9;]*m/g, '') // Remove color codes
          .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '') // Remove other escape sequences
          .replace(/\r/g, ''); // Remove carriage returns
          
        const allLines = cleanData.split('\n').map(line => line.trim());
        
        // Extract meaningful content blocks instead of filtering line by line
        const meaningfulContent = this.extractMeaningfulContent(allLines);
        
        // Always push meaningful content to buffer
        if (meaningfulContent.length > 0) {
          // Only log when debug flag is enabled
          if (process.env.CLAUDE_CONDOM_DEBUG === 'true') {
            console.log('[CLAUDE-CONTENT]', meaningfulContent);
          }
          this.claudeOutputBuffer.push(...meaningfulContent);
        }
        
        // Keep buffer manageable but allow much longer context
        if (this.claudeOutputBuffer.length > 5000) {
          this.claudeOutputBuffer = this.claudeOutputBuffer.slice(-2500);
        }
        
        // Notify listeners of all output for Claude mode
        if (this.onClaudeOutput) {
          this.onClaudeOutput([...this.claudeOutputBuffer]);
        }
      });
      
      this.claudeProcess.onExit(() => {
        console.log('Claude Code process exited');
        this.claudeProcess = null;
      });
    } catch (error) {
      console.error('Failed to start Claude Code:', error);
    }
  }
  
  private extractMeaningfulContent(lines: string[]): string[] {
    const meaningfulLines = [];
    
    for (const line of lines) {
      // Skip empty lines
      if (!line || line.trim().length === 0) continue;
      
      // Skip pure thinking animations (symbols + word + ellipsis)
      if (line.match(/^[✻✽✶*✢·⚒]\s*\w+…/)) continue;
      
      // Skip obvious UI noise but keep everything else
      if (line.match(/^(\?.*for shortcuts|Press Ctrl-C|Try "refactor|Auto-updating to v|✗.*Auto-update failed)$/)) continue;
      
      // Clean up the line but preserve content
      let cleanLine = line
        .replace(/^[│┌┐└┘├┤┬┴┼─═║╔╗╚╝╠╣╦╩╬╭╮╰╯\s]*/, '') // Remove leading box chars
        .replace(/[│┌┐└┘├┤┬┴┼─═║╔╗╚╝╠╣╦╩╬╭╮╰╯\s]*$/, '') // Remove trailing box chars
        .replace(/\(\d+s\s*·.*?\)/, '') // Remove timing indicators
        .trim();
      
      // If there's still meaningful content after cleaning, keep it
      if (cleanLine.length > 2) {
        meaningfulLines.push(cleanLine);
      }
    }
    
    return meaningfulLines;
  }
  
  private extractKeyContent(fullResponse: string): string {
    const lines = fullResponse.split('\n');
    const keyContent = [];
    
    // Look for Claude's actual output markers and file listings
    for (const line of lines) {
      const cleanLine = line.trim();
      
      // Keep lines that are actual content, not repeated UI noise
      if (cleanLine.startsWith('●') || // Claude's output markers
          cleanLine.startsWith('-') || // File listings
          cleanLine.includes('directory contains') ||
          cleanLine.includes('files in') ||
          (cleanLine.includes('.') && (cleanLine.includes('py') || cleanLine.includes('js') || cleanLine.includes('md') || cleanLine.includes('json'))) // File names
         ) {
        keyContent.push(cleanLine);
      }
    }
    
    // Debug logging
    if (process.env.CLAUDE_CONDOM_DEBUG === 'true') {
      console.log(`[KEY-CONTENT] Extracted ${keyContent.length} lines from ${lines.length} total lines`);
      console.log(`[KEY-CONTENT] Key content:`, keyContent);
    }
    
    // If we found meaningful content, return just that. Otherwise return a summary.
    if (keyContent.length > 0) {
      return keyContent.join('\n');
    }
    
    // Fallback: try to extract any meaningful sentences
    const sentences = fullResponse.match(/[A-Z][^.!?]*[.!?]/g) || [];
    const meaningfulSentences = sentences.filter(s => 
      s.length > 20 && 
      !s.includes('shortcuts') && 
      !s.includes('Auto-update') &&
      !s.includes('Try "')
    );
    
    if (process.env.CLAUDE_CONDOM_DEBUG === 'true') {
      console.log(`[KEY-CONTENT] Fallback: ${meaningfulSentences.length} sentences`);
    }
    
    return meaningfulSentences.slice(0, 3).join(' '); // Max 3 sentences
  }
  
  private isMeaningfulResponse(response: string): boolean {
    // Check if response contains actual content vs just UI elements
    const meaningfulIndicators = [
      /\b(file|directory|folder|error|found|created|updated|deleted|structure)\b/i,
      /\b(Yes|No|Here|This|That|I can|I found|Looking at|Based on|Root files|main project files)\b/i,
      /\b(cannot|unable|permission|denied|exists|not found)\b/i,
      /\b(Total|Count|Size|Modified|Created|Python|TypeScript|components)\b/i,
      /\b(project|workspace|claude-condom|src|debug|node_modules)\b/i,
      /.{50,}/, // Responses longer than 50 chars are likely meaningful
      /\w+\.(js|ts|py|md|txt|json|html|css|tsx)/, // File extensions
      /\/home\/\w+/, // File paths
      /package\.json|README\.md|tsconfig\.json/, // Common project files
      /- \w+\.(js|ts|py|md|txt|json|html|css|tsx)/, // File listing format like "- src/index.ts"
    ];
    
    // Split into lines and check if any line has meaningful content
    const lines = response.split(/[.!?]/).filter(line => line.trim().length > 10);
    const hasMeaningfulLines = lines.some(line => 
      meaningfulIndicators.some(pattern => pattern.test(line.trim()))
    );
    
    // Also check the overall response
    const hasOverallContent = meaningfulIndicators.some(pattern => pattern.test(response));
    
    const isNotJustUI = !this.isUIElement(response);
    
    if (process.env.CLAUDE_CONDOM_DEBUG === 'true') {
      console.log(`[MEANINGFUL-CHECK] Response: "${response.substring(0, 100)}..."`);
      console.log(`[MEANINGFUL-CHECK] Lines meaningful: ${hasMeaningfulLines}, Overall: ${hasOverallContent}, Not UI: ${isNotJustUI}`);
    }
    
    return (hasMeaningfulLines || hasOverallContent) && isNotJustUI;
  }
  
  private hasPermissionPrompt(output: string): boolean {
    const promptPatterns = [
      /Do you want to proceed\?/,
      /❯\s*1\.\s*Yes/,
      /2\.\s*Yes.*don't ask again/,
      /3\.\s*No.*tell Claude/,
      /Bash command/,
      /List all files and folders/,
      /find \/home\/casey\/claude-condom/,
      /\[Y\/n\]/,
      /Continue\?\s*\(/,
      /Press.*to continue/,
    ];
    
    const hasPrompt = promptPatterns.some(pattern => pattern.test(output));
    
    if (process.env.CLAUDE_CONDOM_DEBUG === 'true') {
      console.log(`[PROMPT-DEBUG] Testing patterns against: "${output.substring(0, 200)}..."`);
      console.log(`[PROMPT-DEBUG] Result: ${hasPrompt}`);
    }
    
    return hasPrompt;
  }
  
  private isSafeCommand(output: string): boolean {
    const safeCommands = [
      /find.*-type\s+f/, // find files
      /find.*-type\s+d/, // find directories  
      /ls\s*/, // list files
      /ls\s+-[lah]*/, // list with flags
      /pwd/, // print working directory
      /head\s+/, // show file beginning
      /tail\s+/, // show file end
      /cat\s+.*\.(md|txt|json|js|ts|py)/, // read text files
      /grep\s+/, // search text
      /wc\s+/, // word count
      /file\s+/, // file type detection
    ];
    
    return safeCommands.some(pattern => pattern.test(output));
  }
  
  private async autoApprovePrompt(output: string): Promise<void> {
    // Auto-respond to common prompt formats
    if (output.includes('❯ 1. Yes')) {
      console.log(`[CLAUDE-AUTO] Selecting option 1 (Yes)`);
      await this.sendToClaudeCode('1');
    } else if (output.includes('[Y/n]')) {
      console.log(`[CLAUDE-AUTO] Responding Y`);
      await this.sendToClaudeCode('Y');
    } else if (output.includes('Do you want to proceed?')) {
      console.log(`[CLAUDE-AUTO] Responding yes`);
      await this.sendToClaudeCode('y');
    }
    
    // Wait for Claude to process the response
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  private async handlePromptViaAni(userInput: string, claudePrompt: string): Promise<{response: string; source: string} | null> {
    // Let Ani see the prompt and ask the user what to do
    const aniPrompt = `
User asked: "${userInput}"
Claude is asking for permission: ${claudePrompt}

${this.personalityPrompt}

Claude needs permission to proceed. Please explain to the user what Claude wants to do and ask if they want to proceed. Be helpful and clear about what the command will do.
    `;
    
    try {
      const result = await this.ollama.generate(aniPrompt);
      
      if (result.response && !result.error) {
        console.log(`[ANI-PROMPT] Ani is asking user about Claude's permission request`);
        this.debugLogger.logGemmaResponse(userInput, result.response, 'claude+prompt+gemma');
        
        return {
          response: result.response,
          source: 'claude+prompt+gemma',
        };
      }
    } catch (error) {
      console.log(`[ANI-PROMPT-ERROR] Failed to get Ani's response: ${error}`);
    }
    
    return null;
  }

  async sendToClaudeCode(input: string): Promise<void> {
    if (this.claudeProcess) {
      if (process.env.CLAUDE_CONDOM_DEBUG === 'true') {
        console.log(`[CLAUDE-SEND] Sending: "${input}"`);
      }
      
      // Clear any existing input first
      this.claudeProcess.write('\u0003'); // Ctrl+C to clear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send the input
      this.claudeProcess.write(input);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Press Enter
      this.claudeProcess.write('\r');
      
      if (process.env.CLAUDE_CONDOM_DEBUG === 'true') {
        console.log('[CLAUDE-SEND] Input sent with Enter');
      }
    } else {
      throw new Error('Claude Code is not running');
    }
  }
  
  async testConnections(): Promise<{ ollama: boolean; claude: boolean }> {
    const ollamaStatus = await this.ollama.testConnection();
    const claudeStatus = this.claudeProcess !== null;
    
    return {
      ollama: ollamaStatus,
      claude: claudeStatus,
    };
  }
  
  private isEcho(input: string, response: string): boolean {
    return response.toLowerCase().includes(input.toLowerCase()) && input.length > 10;
  }
  
  async processRequest(userInput: string): Promise<{
    response: string;
    source?: string;
    error?: string;
  }> {
    // Reload personality for real-time updates
    this.loadPersonalityPrompt();
    
    // Check if this should use Claude Code for technical queries
    const technicalKeywords = [
      'code', 'function', 'debug', 'error', 'programming', 'algorithm',
      'api', 'database', 'server', 'framework', 'library', 'bug', 'test',
      'file', 'files', 'read', 'write', 'edit', 'folder', 'folders', 'directory',
      'see the folder', 'view', 'list', 'ls', 'cd', 'pwd', 'show me',
      'backspace', 'typo', 'typos', 'implementation', 'see the', 'ability',
      'project', 'summary', 'what is this', 'about', 'analyze', 'explain'
    ];
    
    const inputLower = userInput.toLowerCase();
    const isTechnical = technicalKeywords.some(keyword => 
      inputLower.includes(keyword)
    );
    
    // Debug logging
    this.debugLogger.logTechnicalDetection(userInput, isTechnical, !!this.claudeProcess);
    
    if (isTechnical && this.claudeProcess) {
      try {
        // Store buffer length before sending
        const initialBufferLength = this.claudeOutputBuffer.length;
        
        // Notify that Claude is processing
        if (this.onClaudeProcessing) this.onClaudeProcessing(true);
        
        // Make the request more explicit so Claude actually executes
        let enhancedInput = userInput;
        if (userInput.toLowerCase().includes('files') || userInput.toLowerCase().includes('folder')) {
          enhancedInput = `${userInput}. Please actually run the command to show me the real files, don't just describe what you would do.`;
        }
        
        console.log(`[CLAUDE-COMMAND] Sending: "${enhancedInput}"`);
        await this.sendToClaudeCode(enhancedInput);
        
        // Wait for Claude to finish responding, handling prompts along the way
        let lastBufferLength = initialBufferLength;
        let stableCount = 0;
        const maxWait = 60; // Maximum 30 seconds for complex interactions
        
        for (let attempt = 0; attempt < maxWait; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if buffer has grown
          if (this.claudeOutputBuffer.length > lastBufferLength) {
            lastBufferLength = this.claudeOutputBuffer.length;
            stableCount = 0; // Reset stability counter
            
            // Check for permission prompts in the latest output
            const latestOutput = this.claudeOutputBuffer.slice(-10).join('\n'); // Check more lines
            
            console.log(`[DEBUG-PROMPT] Checking for prompts in: "${latestOutput.substring(0, 300)}..."`);
            console.log(`[DEBUG-PROMPT] Has permission prompt: ${this.hasPermissionPrompt(latestOutput)}`);
            
            if (this.hasPermissionPrompt(latestOutput)) {
              // Check if it's a safe command we can auto-approve
              if (this.isSafeCommand(latestOutput)) {
                console.log(`[CLAUDE-AUTO] Auto-approving safe command`);
                await this.autoApprovePrompt(latestOutput);
                // Reset counters to continue waiting for the actual response
                lastBufferLength = this.claudeOutputBuffer.length;
                stableCount = 0;
                continue;
              } else {
                console.log(`[CLAUDE-PROMPT] Detected permission prompt, asking user via Ani`);
                
                // Send the prompt to Gemma so Ani can ask the user
                const promptResponse = await this.handlePromptViaAni(userInput, latestOutput);
                if (promptResponse) {
                  return promptResponse;
                }
                
                // If we get here, something went wrong, fall through to normal handling
                break;
              }
            }
          } else {
            stableCount++;
            // If buffer hasn't changed for 3 seconds, Claude is likely done
            if (stableCount >= 6 && this.claudeOutputBuffer.length > initialBufferLength) {
              break;
            }
          }
        }
        
        // Get Claude's complete response
        if (this.claudeOutputBuffer.length > initialBufferLength) {
          const fullResponse = this.claudeOutputBuffer.slice(initialBufferLength).join('\n').trim();
          
          // Extract only the meaningful content for Gemma (not the full spam)
          const claudeResponse = this.extractKeyContent(fullResponse);
          
          if (claudeResponse && claudeResponse.length > 10) {
            console.log(`[CLAUDE-RESPONSE] Got response: "${claudeResponse.substring(0, 200)}..."`);
            
            // Claude finished processing
            if (this.onClaudeProcessing) this.onClaudeProcessing(false);
            
            // Send only clean, concise content to Gemma
            const simplePrompt = `
User asked: "${userInput}"
Claude found: ${claudeResponse}

${this.personalityPrompt}

Please respond as Ani using the information Claude provided.
            `;
            
            const result = await this.ollama.generate(simplePrompt);
            
            if (result.response && !result.error) {
              this.debugLogger.logGemmaResponse(userInput, result.response, 'claude+gemma');
              return {
                response: result.response,
                source: 'claude+gemma',
              };
            }
          }
        }
        
        // If Claude didn't respond, fall through to pure Gemma
        if (this.onClaudeProcessing) this.onClaudeProcessing(false);
        console.log(`[CLAUDE-TIMEOUT] No response from Claude, using pure Gemma`);
      } catch (error) {
        // Fall through to pure Gemma response
        if (this.onClaudeProcessing) this.onClaudeProcessing(false);
        console.log(`[CLAUDE-ERROR] ${error}, using pure Gemma`);
      }
    }
    
    // Pure Gemma response
    const fullPrompt = `
User Query: ${userInput}

${this.personalityPrompt}

Please respond to the user's query in character.
    `;
    
    const result = await this.ollama.generate(fullPrompt);
    
    if (result.error) {
      return { error: result.error };
    }
    
    const response = result.response || 'No response generated.';
    this.debugLogger.logGemmaResponse(userInput, response, 'gemma');
    
    return {
      response,
      source: 'gemma',
    };
  }
  
  getDebugSummary() {
    return this.debugLogger.getSummary();
  }
  
  cleanup() {
    if (this.claudeProcess) {
      this.claudeProcess.kill();
      this.claudeProcess = null;
    }
  }
}