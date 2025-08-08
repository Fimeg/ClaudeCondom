import React from 'react';
import { Box, Text } from 'ink';

export interface Message {
  id: string;
  sender: 'user' | 'ani' | 'claude' | 'system' | 'error';
  content: string;
  timestamp: Date;
}

interface ChatDisplayProps {
  messages: Message[];
  mode: 'ani' | 'claude';
  claudeOutput?: string[];
}

export const ChatDisplay: React.FC<ChatDisplayProps> = ({ 
  messages, 
  mode, 
  claudeOutput = [] 
}) => {
  const renderMessage = (message: Message) => {
    const time = message.timestamp.toLocaleTimeString();
    
    switch (message.sender) {
      case 'user':
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="green" bold>[{time}] You: </Text>
            <Text>{message.content}</Text>
          </Box>
        );
      
      case 'ani':
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="yellow" bold>[{time}] Ani: </Text>
            <Text>{message.content}</Text>
          </Box>
        );
      
      case 'claude':
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="blue" bold>[{time}] Claude: </Text>
            <Text>{message.content}</Text>
          </Box>
        );
      
      case 'system':
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="cyan" bold>[{time}] System: </Text>
            <Text>{message.content}</Text>
          </Box>
        );
      
      case 'error':
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="red" bold>[{time}] Error: </Text>
            <Text>{message.content}</Text>
          </Box>
        );
      
      default:
        return (
          <Box key={message.id} marginBottom={1}>
            <Text color="white">[{time}] {message.content}</Text>
          </Box>
        );
    }
  };
  
  if (mode === 'claude' && claudeOutput.length > 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="blue" bold>Claude Code Output:</Text>
        {claudeOutput.slice(-50).map((line, index) => (
          <Text key={index} color="blue">
            {line}
          </Text>
        ))}
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" padding={1}>
      {messages.slice(-50).map(renderMessage)}
    </Box>
  );
};