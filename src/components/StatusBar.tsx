import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  mode: 'ani' | 'claude';
  status: string;
  connections: {
    ollama: boolean;
    claude: boolean;
  };
}

export const StatusBar: React.FC<StatusBarProps> = ({ mode, status, connections }) => {
  const modeText = mode === 'claude' ? '[Claude Mode]' : '[Ani Mode]';
  const modeColor = mode === 'claude' ? 'blue' : 'yellow';
  
  const connectionStatus = [
    `Gemma: ${connections.ollama ? '✓' : '✗'}`,
    `Claude: ${connections.claude ? '✓' : '✗'}`,
  ].join(' | ');
  
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color={modeColor} bold>{modeText}</Text>
        <Text> {status}</Text>
      </Box>
      <Text color="gray">{connectionStatus}</Text>
    </Box>
  );
};