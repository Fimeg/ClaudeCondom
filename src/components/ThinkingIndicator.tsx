import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';

interface ThinkingIndicatorProps {
  visible: boolean;
  message?: string;
  claudeProcessing?: boolean;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ 
  visible, 
  message = "Ani is thinking...",
  claudeProcessing = false
}) => {
  const [dots, setDots] = useState('');
  const [pulse, setPulse] = useState(false);
  
  useEffect(() => {
    if (!visible) {
      setDots('');
      return;
    }
    
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [visible]);
  
  useEffect(() => {
    if (!visible) return;
    
    const pulseInterval = setInterval(() => {
      setPulse(prev => !prev);
    }, 600);
    
    return () => clearInterval(pulseInterval);
  }, [visible]);
  
  if (!visible) return null;
  
  const displayMessage = claudeProcessing ? "Claude processing..." : message;
  const textColor = claudeProcessing ? "blue" : "yellow";
  
  return (
    <Box>
      <Text color={textColor} bold={pulse}>
        {displayMessage}{dots}
      </Text>
    </Box>
  );
};