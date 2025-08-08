import React, { useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTextBuffer } from './TextBuffer';
import chalk from 'chalk';

interface InputPromptProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
  mode: 'ani' | 'claude';
}

export const InputPrompt: React.FC<InputPromptProps> = ({
  onSubmit,
  placeholder = 'Type your message...',
  focus = true,
  mode,
}) => {
  const buffer = useTextBuffer('');
  
  const handleSubmit = useCallback(() => {
    if (buffer.text.trim()) {
      const text = buffer.text;
      buffer.setText('');
      onSubmit(text);
    }
  }, [buffer, onSubmit]);
  
  useInput((input, key) => {
    if (!focus) return;
    
    // Ctrl+T is handled by parent
    if (key.ctrl && input.toLowerCase() === 't') {
      return;
    }
    
    // Enter to submit (unless multiline with Ctrl+Enter)
    if (key.return && !key.ctrl) {
      if (buffer.text.trim()) {
        handleSubmit();
      }
      return;
    }
    
    // Ctrl+Enter for newline
    if (key.return && key.ctrl) {
      buffer.newline();
      return;
    }
    
    // Handle backspace directly - multiple ways to detect it
    if (key.backspace || input === '\u007f' || input === '\u0008' || input === '\x08' || input === '\x7f') {
      buffer.backspace();
      return;
    }
    
    // Handle arrow keys
    if (key.leftArrow) {
      // Use the existing handleInput method for arrow keys
      buffer.handleInput({ name: 'left', sequence: input });
      return;
    }
    if (key.rightArrow) {
      buffer.handleInput({ name: 'right', sequence: input });
      return;
    }
    
    // Handle regular character input
    if (input && !key.ctrl && !key.meta && input.length === 1 && input >= ' ') {
      buffer.insert(input);
    }
  }, { isActive: focus });
  
  const promptSymbol = mode === 'claude' ? '>>>' : 'Ani>';
  const promptColor = mode === 'claude' ? 'blue' : 'yellow';
  
  // Render input with cursor
  const renderInput = () => {
    const lines = buffer.lines;
    const [cursorRow, cursorCol] = buffer.cursor;
    
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
      if (focus) {
        return (
          <Text>
            {chalk.inverse(' ')}
            <Text color="gray">{placeholder.slice(1)}</Text>
          </Text>
        );
      } else {
        return <Text color="gray">{placeholder}</Text>;
      }
    }
    
    return (
      <Box flexDirection="column">
        {lines.map((line, lineIndex) => {
          if (!focus || lineIndex !== cursorRow) {
            return <Text key={lineIndex}>{line || ' '}</Text>;
          }
          
          // Render line with cursor
          const beforeCursor = line.slice(0, cursorCol);
          const atCursor = line.slice(cursorCol, cursorCol + 1) || ' ';
          const afterCursor = line.slice(cursorCol + 1);
          
          return (
            <Text key={lineIndex}>
              {beforeCursor}
              {chalk.inverse(atCursor)}
              {afterCursor}
            </Text>
          );
        })}
      </Box>
    );
  };
  
  return (
    <Box>
      <Box borderStyle="round" borderColor={promptColor} paddingX={1} flexGrow={1}>
        <Text color={promptColor} bold>
          {promptSymbol}{' '}
        </Text>
        <Box flexGrow={1}>
          {renderInput()}
        </Box>
      </Box>
    </Box>
  );
};