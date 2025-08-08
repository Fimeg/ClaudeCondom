export interface OllamaOptions {
  num_gpu?: number;
  num_thread?: number;
  num_ctx?: number;  // Context window size
  temperature?: number;
  top_p?: number;
  repeat_penalty?: number;
}

export class OllamaConfigManager {
  private defaultOptions: OllamaOptions = {
    num_gpu: -1,  // Use all available GPUs
    num_thread: 8,  // CPU threads for offload
    num_ctx: 8192,  // Context size - balance memory vs conversation length
    temperature: 0.7,
    top_p: 0.9,
    repeat_penalty: 1.1
  };
  
  // Performance profiles
  static readonly profiles = {
    // Balanced: Good performance with reasonable memory usage
    balanced: {
      num_gpu: -1,
      num_thread: 8,
      num_ctx: 4096,
      temperature: 0.7
    },
    
    // Memory optimized: Lower GPU usage, more CPU offload
    memoryOptimized: {
      num_gpu: 20,  // Limit GPU layers
      num_thread: 12,
      num_ctx: 2048,  // Smaller context
      temperature: 0.7
    },
    
    // Performance: Maximum GPU usage
    performance: {
      num_gpu: -1,
      num_thread: 4,
      num_ctx: 8192,
      temperature: 0.7
    },
    
    // Long conversation: Optimized for extended chats
    longConversation: {
      num_gpu: 30,
      num_thread: 8,
      num_ctx: 16384,  // Large context for memory
      temperature: 0.8
    }
  };
  
  constructor(private profile: keyof typeof OllamaConfigManager.profiles = 'balanced') {
    this.defaultOptions = { ...OllamaConfigManager.profiles[profile] };
  }
  
  getOptions(): OllamaOptions {
    return { ...this.defaultOptions };
  }
  
  setProfile(profile: keyof typeof OllamaConfigManager.profiles) {
    this.profile = profile;
    this.defaultOptions = { ...OllamaConfigManager.profiles[profile] };
  }
  
  updateOptions(options: Partial<OllamaOptions>) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }
  
  // Quick technical detection for simple routing
  static isSimpleTechnical(input: string): boolean {
    const simpleTechKeywords = [
      'ls', 'cd', 'pwd', 'file', 'folder', 'directory', 'path',
      'code', 'function', 'class', 'import', 'export',
      'error', 'debug', 'log', 'console', 'print',
      'git', 'npm', 'pip', 'install', 'run',
      'read', 'write', 'edit', 'create', 'delete'
    ];
    
    const inputLower = input.toLowerCase();
    return simpleTechKeywords.some(keyword => inputLower.includes(keyword));
  }
}