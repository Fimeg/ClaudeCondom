import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ChatDisplay, Message } from './ChatDisplay';
import { InputPrompt } from './InputPrompt';
import { StatusBar } from './StatusBar';
import { ThinkingIndicator } from './ThinkingIndicator';
import { AIWrapper } from '../AIWrapper';

export const App: React.FC = () => {
  const [mode, setMode] = useState<'ani' | 'claude'>('ani');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('Initializing...');
  const [connections, setConnections] = useState({ ollama: false, claude: false });
  const [claudeOutput, setClaudeOutput] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [claudeProcessing, setClaudeProcessing] = useState(false);
  const [aiWrapper] = useState(() => new AIWrapper());
  
  // Test connections on startup
  useEffect(() => {
    const testConnections = async () => {
      const result = await aiWrapper.testConnections();
      setConnections(result);
      setStatus('Ready');
      
      // Add welcome message
      addMessage('system', 'Claude-Condom initialized. Press Ctrl+T to switch modes.');
    };
    
    testConnections();
  }, [aiWrapper]);
  
  const addMessage = useCallback((sender: Message['sender'], content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      sender,
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
  }, []);
  
  const handleSubmit = useCallback(async (input: string) => {
    addMessage('user', input);
    
    if (mode === 'claude') {
      // Send to Claude Code
      setStatus('Sending to Claude Code...');
      try {
        await aiWrapper.sendToClaudeCode(input);
        // Claude output will be updated via claudeOutput state
        setStatus('Ready');
      } catch (error) {
        addMessage('error', `Claude Code error: ${error}`);
        setStatus('Ready');
      }
    } else {
      // Process with Ani
      setStatus('Thinking...');
      try {
        const response = await aiWrapper.processRequest(input);
        
        if (response.error) {
          addMessage('error', response.error);
        } else {
          addMessage('ani', response.response);
          setStatus(`Ready | ${response.source || 'unknown'}`);
        }
      } catch (error) {
        addMessage('error', `Processing failed: ${error}`);
        setStatus('Error');
      }
    }
  }, [mode, aiWrapper, addMessage]);
  
  // Handle Ctrl+T toggle
  useInput((input, key) => {
    if (key.ctrl && input.toLowerCase() === 't') {
      setMode(prev => prev === 'ani' ? 'claude' : 'ani');
      setStatus(`Switched to ${mode === 'ani' ? 'Claude' : 'Ani'} mode`);
    }
  });
  
  // Listen for Claude Code output updates
  useEffect(() => {
    const handleClaudeOutput = (output: string[]) => {
      setClaudeOutput(output);
    };
    
    aiWrapper.onClaudeOutput = handleClaudeOutput;
    aiWrapper.onThinking = setIsThinking;
    aiWrapper.onClaudeProcessing = setClaudeProcessing;
    
    return () => {
      aiWrapper.onClaudeOutput = undefined;
      aiWrapper.onThinking = undefined;
      aiWrapper.onClaudeProcessing = undefined;
    };
  }, [aiWrapper]);
  
  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">Claude-Condom: AI Wrapper</Text>
        <Box marginLeft="auto">
          <Text color="magenta">Ctrl+T: Toggle Mode | Ctrl+C: Exit</Text>
        </Box>
      </Box>
      
      {/* Main display area */}
      <Box flexGrow={1} overflow="hidden">
        <ChatDisplay 
          messages={messages} 
          mode={mode}
          claudeOutput={mode === 'claude' ? claudeOutput : undefined}
        />
        <ThinkingIndicator 
          visible={(isThinking || claudeProcessing) && mode === 'ani'} 
          claudeProcessing={claudeProcessing}
        />
      </Box>
      
      {/* Status bar */}
      <Box borderStyle="single">
        <StatusBar mode={mode} status={status} connections={connections} />
      </Box>
      
      {/* Input area */}
      <Box>
        <InputPrompt 
          onSubmit={handleSubmit}
          mode={mode}
          placeholder={mode === 'claude' ? 'Enter Claude Code command...' : 'Chat with Ani...'}
        />
      </Box>
    </Box>
  );
};