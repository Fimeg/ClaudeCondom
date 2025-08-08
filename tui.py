#!/usr/bin/env python3

import curses
import threading
import queue
import time
from typing import Dict, Any, Optional
from core.wrapper import AIWrapper

class TUIManager:
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.wrapper = AIWrapper(ollama_host="10.10.20.19", ollama_port=11434)
        self.show_claude_output = False
        self.current_input = ""
        self.chat_history = []
        self.status_message = "Ready"
        
        # Colors
        curses.start_color()
        curses.init_pair(1, curses.COLOR_CYAN, curses.COLOR_BLACK)     # System
        curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)    # User
        curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)   # Ani/Gemma
        curses.init_pair(4, curses.COLOR_BLUE, curses.COLOR_BLACK)     # Claude
        curses.init_pair(5, curses.COLOR_RED, curses.COLOR_BLACK)      # Error
        curses.init_pair(6, curses.COLOR_MAGENTA, curses.COLOR_BLACK)  # Status
        
        # Screen dimensions
        self.height, self.width = stdscr.getmaxyx()
        
        # Create windows
        self.create_windows()
        
        # Test connections
        self.test_connections()
    
    def create_windows(self):
        """Create TUI windows"""
        # Main chat window (top 80% of screen)
        chat_height = int(self.height * 0.8) - 2
        self.chat_win = curses.newwin(chat_height, self.width - 2, 1, 1)
        self.chat_win.scrollok(True)
        
        # Status window (1 line)
        status_y = chat_height + 1
        self.status_win = curses.newwin(1, self.width - 2, status_y, 1)
        
        # Input window (bottom)
        input_y = status_y + 2
        input_height = self.height - input_y - 1
        self.input_win = curses.newwin(input_height, self.width - 2, input_y, 1)
        
        # Draw borders
        self.stdscr.border()
        self.stdscr.addstr(0, 2, " Claude-Condom: AI Wrapper ", curses.color_pair(1) | curses.A_BOLD)
        
        # Instructions
        toggle_text = " Ctrl+T: Toggle Claude View | Ctrl+C: Exit "
        self.stdscr.addstr(0, self.width - len(toggle_text) - 2, toggle_text, curses.color_pair(6))
        
        self.stdscr.refresh()
    
    def test_connections(self):
        """Test system connections and display status"""
        connections = self.wrapper.test_connections()
        
        status_parts = []
        if connections['ollama']:
            status_parts.append("Gemma: ✓")
        else:
            status_parts.append("Gemma: ✗")
            
        # Test Claude CLI
        try:
            claude_result = self.wrapper._process_with_claude("test", "")
            if claude_result['success'] or "not found" not in claude_result.get('error', ''):
                status_parts.append("Claude: ✓")
            else:
                status_parts.append("Claude: ✗")
        except:
            status_parts.append("Claude: ?")
        
        self.status_message = " | ".join(status_parts)
        self.update_status()
    
    def update_status(self):
        """Update status line"""
        self.status_win.clear()
        mode_text = "[Claude View]" if self.show_claude_output else "[Ani View]"
        status_text = f"{mode_text} {self.status_message}"
        
        color = curses.color_pair(4) if self.show_claude_output else curses.color_pair(3)
        self.status_win.addstr(0, 0, status_text[:self.width-2], color | curses.A_BOLD)
        self.status_win.refresh()
    
    def add_message(self, sender: str, message: str, color_pair: int = 0):
        """Add message to chat window"""
        timestamp = time.strftime("%H:%M:%S")
        
        # Format message
        if sender == "System":
            formatted = f"[{timestamp}] {message}"
            color = curses.color_pair(1)
        elif sender == "You":
            formatted = f"[{timestamp}] You: {message}"
            color = curses.color_pair(2)
        elif sender == "Ani":
            formatted = f"[{timestamp}] Ani: {message}"
            color = curses.color_pair(3)
        elif sender == "Claude":
            formatted = f"[{timestamp}] Claude: {message}"
            color = curses.color_pair(4)
        elif sender == "Error":
            formatted = f"[{timestamp}] ERROR: {message}"
            color = curses.color_pair(5)
        else:
            formatted = f"[{timestamp}] {sender}: {message}"
            color = curses.color_pair(0)
        
        # Store in history
        self.chat_history.append({
            'sender': sender,
            'message': message,
            'timestamp': timestamp,
            'formatted': formatted
        })
        
        # Add to window with word wrapping
        lines = self.wrap_text(formatted, self.width - 4)
        for line in lines:
            self.chat_win.addstr(line + "\n", color)
        
        self.chat_win.refresh()
    
    def wrap_text(self, text: str, width: int) -> list:
        """Simple word wrapping"""
        if len(text) <= width:
            return [text]
        
        lines = []
        words = text.split(' ')
        current_line = ""
        
        for word in words:
            if len(current_line + " " + word) <= width:
                current_line += (" " if current_line else "") + word
            else:
                if current_line:
                    lines.append(current_line)
                current_line = word
        
        if current_line:
            lines.append(current_line)
        
        return lines
    
    def handle_input(self):
        """Handle user input"""
        self.input_win.clear()
        self.input_win.addstr(0, 0, "You: ", curses.color_pair(2) | curses.A_BOLD)
        self.input_win.addstr(self.current_input)
        self.input_win.refresh()
        
        while True:
            try:
                ch = self.stdscr.getch()
                
                # Ctrl+T: Toggle view
                if ch == 20:  # Ctrl+T
                    self.show_claude_output = not self.show_claude_output
                    self.update_status()
                    continue
                
                # Ctrl+C: Exit
                elif ch == 3:  # Ctrl+C
                    return None
                
                # Enter: Send message
                elif ch in [10, 13]:  # Enter/Return
                    if self.current_input.strip():
                        user_message = self.current_input.strip()
                        self.current_input = ""
                        return user_message
                
                # Backspace
                elif ch in [8, 127, curses.KEY_BACKSPACE]:
                    if self.current_input:
                        self.current_input = self.current_input[:-1]
                
                # Regular character
                elif 32 <= ch <= 126:  # Printable ASCII
                    self.current_input += chr(ch)
                
                # Update input display
                self.input_win.clear()
                self.input_win.addstr(0, 0, "You: ", curses.color_pair(2) | curses.A_BOLD)
                display_input = self.current_input
                if len(display_input) > self.width - 10:
                    display_input = "..." + display_input[-(self.width-13):]
                self.input_win.addstr(display_input)
                self.input_win.refresh()
                
            except KeyboardInterrupt:
                return None
    
    def process_message(self, user_input: str):
        """Process user message and get AI response"""
        self.add_message("You", user_input)
        self.status_message = "Processing..."
        self.update_status()
        
        try:
            response = self.wrapper.process_request(user_input)
            
            if "error" in response:
                self.add_message("Error", response["error"])
                self.status_message = "Error occurred"
            else:
                # Display appropriate response based on toggle
                if self.show_claude_output and "claude_response" in response:
                    self.add_message("Claude", response["claude_response"])
                else:
                    self.add_message("Ani", response["response"])
                
                # Update status
                source_info = f"Source: {response.get('source', 'unknown')}"
                context_info = f"Context: {response.get('context_used', 0)}"
                self.status_message = f"{source_info} | {context_info}"
            
        except Exception as e:
            self.add_message("Error", f"Processing failed: {str(e)}")
            self.status_message = "Processing failed"
        
        self.update_status()
    
    def run(self):
        """Main TUI loop"""
        self.add_message("System", "Claude-Condom AI Wrapper initialized")
        self.add_message("System", "Press Ctrl+T to toggle between Ani and Claude views")
        self.add_message("System", "Press Ctrl+C to exit")
        
        while True:
            user_input = self.handle_input()
            
            if user_input is None:  # Exit requested
                break
                
            if user_input.lower() in ['quit', 'exit']:
                break
            
            self.process_message(user_input)

def main():
    def run_tui(stdscr):
        curses.curs_set(1)  # Show cursor
        stdscr.timeout(100)  # Non-blocking input
        
        tui = TUIManager(stdscr)
        tui.run()
    
    try:
        curses.wrapper(run_tui)
    except KeyboardInterrupt:
        print("\nGoodbye!")

if __name__ == "__main__":
    main()