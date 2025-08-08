// Simplified version of Gemini CLI's text buffer for our needs
import { useState, useCallback, useReducer, useMemo } from 'react';

export interface Key {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
}

interface TextBufferState {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
}

type TextBufferAction =
  | { type: 'set_text'; payload: string }
  | { type: 'insert'; payload: string }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'move_cursor'; payload: { row: number; col: number } }
  | { type: 'newline' };

function textBufferReducer(state: TextBufferState, action: TextBufferAction): TextBufferState {
  switch (action.type) {
    case 'set_text': {
      const lines = action.payload.split('\n');
      return {
        ...state,
        lines: lines.length === 0 ? [''] : lines,
        cursorRow: lines.length - 1,
        cursorCol: lines[lines.length - 1]?.length || 0,
      };
    }
    
    case 'insert': {
      const newLines = [...state.lines];
      const currentLine = newLines[state.cursorRow] || '';
      const before = currentLine.slice(0, state.cursorCol);
      const after = currentLine.slice(state.cursorCol);
      
      if (action.payload.includes('\n')) {
        const parts = action.payload.split('\n');
        newLines[state.cursorRow] = before + parts[0];
        
        for (let i = 1; i < parts.length; i++) {
          newLines.splice(state.cursorRow + i, 0, parts[i]);
        }
        
        const lastPart = parts[parts.length - 1];
        newLines[state.cursorRow + parts.length - 1] += after;
        
        return {
          ...state,
          lines: newLines,
          cursorRow: state.cursorRow + parts.length - 1,
          cursorCol: lastPart.length,
        };
      } else {
        newLines[state.cursorRow] = before + action.payload + after;
        return {
          ...state,
          lines: newLines,
          cursorCol: state.cursorCol + action.payload.length,
        };
      }
    }
    
    case 'backspace': {
      if (state.cursorCol === 0 && state.cursorRow === 0) return state;
      
      const newLines = [...state.lines];
      
      if (state.cursorCol > 0) {
        const currentLine = newLines[state.cursorRow];
        newLines[state.cursorRow] = currentLine.slice(0, state.cursorCol - 1) + currentLine.slice(state.cursorCol);
        return {
          ...state,
          lines: newLines,
          cursorCol: state.cursorCol - 1,
        };
      } else {
        const prevLine = newLines[state.cursorRow - 1];
        const currentLine = newLines[state.cursorRow];
        const newCol = prevLine.length;
        
        newLines[state.cursorRow - 1] = prevLine + currentLine;
        newLines.splice(state.cursorRow, 1);
        
        return {
          ...state,
          lines: newLines,
          cursorRow: state.cursorRow - 1,
          cursorCol: newCol,
        };
      }
    }
    
    case 'newline': {
      const newLines = [...state.lines];
      const currentLine = newLines[state.cursorRow] || '';
      const before = currentLine.slice(0, state.cursorCol);
      const after = currentLine.slice(state.cursorCol);
      
      newLines[state.cursorRow] = before;
      newLines.splice(state.cursorRow + 1, 0, after);
      
      return {
        ...state,
        lines: newLines,
        cursorRow: state.cursorRow + 1,
        cursorCol: 0,
      };
    }
    
    case 'move_cursor': {
      const { row, col } = action.payload;
      const clampedRow = Math.max(0, Math.min(row, state.lines.length - 1));
      const lineLength = state.lines[clampedRow]?.length || 0;
      const clampedCol = Math.max(0, Math.min(col, lineLength));
      
      return {
        ...state,
        cursorRow: clampedRow,
        cursorCol: clampedCol,
      };
    }
    
    default:
      return state;
  }
}

export interface TextBuffer {
  lines: string[];
  text: string;
  cursor: [number, number];
  setText: (text: string) => void;
  insert: (text: string) => void;
  backspace: () => void;
  newline: () => void;
  handleInput: (key: Key) => void;
}

export function useTextBuffer(initialText = ''): TextBuffer {
  const initialState: TextBufferState = {
    lines: initialText ? initialText.split('\n') : [''],
    cursorRow: 0,
    cursorCol: 0,
  };
  
  const [state, dispatch] = useReducer(textBufferReducer, initialState);
  
  const text = useMemo(() => state.lines.join('\n'), [state.lines]);
  
  const setText = useCallback((newText: string) => {
    dispatch({ type: 'set_text', payload: newText });
  }, []);
  
  const insert = useCallback((textToInsert: string) => {
    dispatch({ type: 'insert', payload: textToInsert });
  }, []);
  
  const backspace = useCallback(() => {
    dispatch({ type: 'backspace' });
  }, []);
  
  const newline = useCallback(() => {
    dispatch({ type: 'newline' });
  }, []);
  
  const handleInput = useCallback((key: Key) => {
    if (key.name === 'return') {
      newline();
    } else if (key.name === 'backspace' || key.sequence === '\x7f' || key.sequence === '\b') {
      backspace();
    } else if (key.name === 'left') {
      const newCol = state.cursorCol > 0 ? state.cursorCol - 1 : 
        state.cursorRow > 0 ? state.lines[state.cursorRow - 1].length : 0;
      const newRow = state.cursorCol > 0 ? state.cursorRow : 
        state.cursorRow > 0 ? state.cursorRow - 1 : 0;
      dispatch({ type: 'move_cursor', payload: { row: newRow, col: newCol } });
    } else if (key.name === 'right') {
      const currentLineLength = state.lines[state.cursorRow]?.length || 0;
      const newCol = state.cursorCol < currentLineLength ? state.cursorCol + 1 : 0;
      const newRow = state.cursorCol < currentLineLength ? state.cursorRow : 
        state.cursorRow < state.lines.length - 1 ? state.cursorRow + 1 : state.cursorRow;
      dispatch({ type: 'move_cursor', payload: { row: newRow, col: newCol } });
    } else if (key.name === 'up') {
      dispatch({ type: 'move_cursor', payload: { row: state.cursorRow - 1, col: state.cursorCol } });
    } else if (key.name === 'down') {
      dispatch({ type: 'move_cursor', payload: { row: state.cursorRow + 1, col: state.cursorCol } });
    } else if (key.ctrl && key.name === 'c') {
      if (text.length > 0) {
        setText('');
      }
    } else if (key.sequence && !key.ctrl && !key.meta) {
      insert(key.sequence);
    }
  }, [state, text, setText, insert, backspace, newline]);
  
  return {
    lines: state.lines,
    text,
    cursor: [state.cursorRow, state.cursorCol],
    setText,
    insert,
    backspace,
    newline,
    handleInput,
  };
}