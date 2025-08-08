#!/usr/bin/env python3

import curses
import subprocess
import threading
import queue
import time
import os
import pty
import select
import termios
import fcntl
import struct
from typing import Dict, Any, Optional
from core.wrapper import AIWrapper

class DualTUI:
    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.wrapper = AIWrapper(ollama_host="10.10.20.19", ollama_port=11434)
        self.claude_mode = False  # False = Ani mode, True = Claude mode
        self.current_input = ""
        self.chat_history = []
        self.status_message = "Ready"
        
        # Claude Code subprocess
        self.claude_process = None
        self.claude_master = None
        self.claude_output_buffer = []
        
        # Colors
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(1, curses.COLOR_CYAN, -1)     # System
        curses.init_pair(2, curses.COLOR_GREEN, -1)    # User
        curses.init_pair(3, curses.COLOR_YELLOW, -1)   # Ani
        curses.init_pair(4, curses.COLOR_BLUE, -1)     # Claude
        curses.init_pair(5, curses.COLOR_RED, -1)      # Error
        curses.init_pair(6, curses.COLOR_MAGENTA, -1)  # Status
        curses.init_pair(7, curses.COLOR_WHITE, curses.COLOR_BLUE)  # Input box
        
        # Screen setup
        self.height, self.width = stdscr.getmaxyx()
        self.create_windows()
        self.start_claude_subprocess()
        
    def create_windows(self):
        """Create TUI windows with proper input handling"""
        # Main display area (80% of height)
        display_height = int(self.height * 0.75)
        self.display_win = curses.newwin(display_height - 2, self.width - 2, 1, 1)
        self.display_win.scrollok(True)
        self.display_win.keypad(True)
        
        # Status line
        status_y = display_height - 1
        self.status_win = curses.newwin(1, self.width - 2, status_y, 1)
        
        # Input area (bottom 20%)
        input_y = display_height + 1
        input_height = self.height - input_y - 2
        self.input_win = curses.newwin(input_height, self.width - 2, input_y, 1)
        self.input_win.keypad(True)
        
        # Draw main border
        self.stdscr.border()
        self.update_title()
        self.update_status()
        
        # Draw input box border
        input_box_y = input_y - 1
        for x in range(1, self.width - 1):
            self.stdscr.addch(input_box_y, x, curses.ACS_HLINE)
        self.stdscr.addch(input_box_y, 0, curses.ACS_LTEE)
        self.stdscr.addch(input_box_y, self.width - 1, curses.ACS_RTEE)
        
        self.stdscr.refresh()
    
    def update_title(self):
        """Update window title"""
        mode = "Claude Code" if self.claude_mode else "Ani Mode"
        title = f" Claude-Condom: {mode} "
        self.stdscr.addstr(0, 2, title, curses.color_pair(4 if self.claude_mode else 3) | curses.A_BOLD)
        
        # Instructions
        instructions = " Ctrl+T: Toggle Mode | Ctrl+C: Exit "
        self.stdscr.addstr(0, self.width - len(instructions) - 2, instructions, curses.color_pair(6))
        self.stdscr.refresh()
    
    def update_status(self):
        """Update status line"""
        self.status_win.clear()
        
        if self.claude_mode:
            status = f"[Claude Code Mode] {self.status_message}"
            color = curses.color_pair(4)
        else:
            status = f"[Ani Mode] {self.status_message}"
            color = curses.color_pair(3)
        
        self.status_win.addstr(0, 0, status[:self.width-2], color | curses.A_BOLD)
        self.status_win.refresh()
    
    def start_claude_subprocess(self):
        """Start Claude Code as subprocess with PTY"""
        try:
            # Create PTY for Claude Code
            self.claude_master, claude_slave = pty.openpty()
            
            # Start Claude Code process
            self.claude_process = subprocess.Popen(
                ['claude'],
                stdin=claude_slave,
                stdout=claude_slave,
                stderr=claude_slave,
                start_new_session=True
            )
            
            # Close slave end in parent
            os.close(claude_slave)
            
            # Make master non-blocking
            fcntl.fcntl(self.claude_master, fcntl.F_SETFL, os.O_NONBLOCK)
            
            # Start thread to read Claude output
            self.claude_reader_thread = threading.Thread(target=self.read_claude_output, daemon=True)
            self.claude_reader_thread.start()
            
            self.status_message = "Claude Code ready"
            
        except Exception as e:
            self.status_message = f"Claude Code failed: {str(e)}"
            self.claude_process = None
    
    def read_claude_output(self):
        """Read output from Claude Code subprocess"""
        while self.claude_process and self.claude_process.poll() is None:
            try:
                if select.select([self.claude_master], [], [], 0.1)[0]:
                    data = os.read(self.claude_master, 1024).decode('utf-8', errors='ignore')
                    if data:
                        self.claude_output_buffer.extend(data.splitlines())
                        # Keep buffer manageable
                        if len(self.claude_output_buffer) > 1000:
                            self.claude_output_buffer = self.claude_output_buffer[-500:]
            except:
                break
    
    def send_to_claude(self, text: str):
        """Send text to Claude Code"""
        if self.claude_master:
            try:
                os.write(self.claude_master, (text + '\n').encode('utf-8'))
            except:
                self.status_message = "Claude Code connection lost"
    
    def add_ani_message(self, sender: str, message: str):
        """Add message to Ani chat display"""
        timestamp = time.strftime("%H:%M:%S")
        
        if sender == "You":
            formatted = f"[{timestamp}] You: {message}"
            color = curses.color_pair(2)
        elif sender == "Ani":
            formatted = f"[{timestamp}] Ani: {message}"
            color = curses.color_pair(3)
        elif sender == "Error":
            formatted = f"[{timestamp}] ERROR: {message}"
            color = curses.color_pair(5)
        else:
            formatted = f"[{timestamp}] {sender}: {message}"
            color = curses.color_pair(1)
        
        # Store in history
        self.chat_history.append(formatted)
        
        # Add to display with word wrapping
        lines = self.wrap_text(formatted, self.width - 4)
        for line in lines:
            self.display_win.addstr(line + "\n", color)
        
        self.display_win.refresh()
    
    def display_claude_output(self):
        """Display Claude Code output"""
        self.display_win.clear()
        
        # Show recent Claude output
        display_lines = self.claude_output_buffer[-50:] if self.claude_output_buffer else ["Waiting for Claude Code..."]
        
        for line in display_lines:
            # Simple ANSI code stripping for now
            clean_line = line.replace('\x1b[2K', '').replace('\r', '')
            if clean_line.strip():
                wrapped_lines = self.wrap_text(clean_line, self.width - 4)
                for wrapped in wrapped_lines:
                    try:
                        self.display_win.addstr(wrapped + "\n", curses.color_pair(4))
                    except:
                        break
        
        self.display_win.refresh()
    
    def display_ani_output(self):
        """Display Ani chat history"""
        self.display_win.clear()
        
        # Show recent chat history
        for entry in self.chat_history[-50:]:
            lines = self.wrap_text(entry, self.width - 4)
            for line in lines:
                try:
                    if "You:" in line:
                        self.display_win.addstr(line + "\n", curses.color_pair(2))
                    elif "Ani:" in line:
                        self.display_win.addstr(line + "\n", curses.color_pair(3))
                    elif "ERROR:" in line:
                        self.display_win.addstr(line + "\n", curses.color_pair(5))
                    else:
                        self.display_win.addstr(line + "\n", curses.color_pair(1))
                except:
                    break
        
        self.display_win.refresh()
    
    def wrap_text(self, text: str, width: int) -> list:
        """Wrap text to fit width"""
        if len(text) <= width:
            return [text]
        
        words = text.split(' ')
        lines = []
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
        """Handle input with proper text box behavior"""
        input_lines = []
        current_line = ""
        cursor_y = 0
        cursor_x = 0
        
        while True:
            # Update input display
            self.input_win.clear()
            
            # Draw input prompt
            prompt = ">>> " if self.claude_mode else "Ani> "
            self.input_win.addstr(0, 0, prompt, curses.color_pair(4 if self.claude_mode else 3) | curses.A_BOLD)
            
            # Display input lines
            display_lines = input_lines + [current_line] if current_line or not input_lines else input_lines
            
            for i, line in enumerate(display_lines[:self.input_win.getmaxyx()[0] - 1]):
                try:
                    self.input_win.addstr(i, len(prompt) if i == 0 else 0, line)
                except:
                    break
            
            # Position cursor
            if cursor_y < self.input_win.getmaxyx()[0]:
                self.input_win.move(cursor_y, cursor_x + (len(prompt) if cursor_y == 0 else 0))
            
            self.input_win.refresh()
            
            # Get character
            try:
                ch = self.input_win.getch()
                
                # Ctrl+T: Toggle mode
                if ch == 20:  # Ctrl+T
                    self.claude_mode = not self.claude_mode
                    self.update_title()
                    self.update_status()
                    if self.claude_mode:
                        self.display_claude_output()
                    else:
                        self.display_ani_output()
                    continue
                
                # Ctrl+C: Exit
                elif ch == 3:  # Ctrl+C
                    return None
                
                # Enter: Send message or new line
                elif ch in [10, 13]:  # Enter
                    if current_line.strip() or input_lines:
                        # Combine all lines
                        full_input = '\n'.join(input_lines + [current_line]).strip()
                        return full_input
                    else:
                        # New line
                        input_lines.append(current_line)
                        current_line = ""
                        cursor_y += 1
                        cursor_x = 0
                
                # Backspace
                elif ch in [8, 127, curses.KEY_BACKSPACE]:
                    if cursor_x > 0:
                        current_line = current_line[:cursor_x-1] + current_line[cursor_x:]
                        cursor_x -= 1
                    elif cursor_y > 0 and input_lines:
                        # Merge with previous line
                        prev_line = input_lines.pop()
                        cursor_x = len(prev_line)
                        current_line = prev_line + current_line
                        cursor_y -= 1
                
                # Arrow keys
                elif ch == curses.KEY_LEFT and cursor_x > 0:
                    cursor_x -= 1
                elif ch == curses.KEY_RIGHT and cursor_x < len(current_line):
                    cursor_x += 1
                
                # Regular character
                elif 32 <= ch <= 126:
                    current_line = current_line[:cursor_x] + chr(ch) + current_line[cursor_x:]
                    cursor_x += 1
                
            except KeyboardInterrupt:
                return None
    
    def process_input(self, user_input: str):
        """Process user input based on current mode"""
        if self.claude_mode:
            # Send to Claude Code
            self.send_to_claude(user_input)
            # Refresh Claude output
            time.sleep(0.1)  # Brief delay for output
            self.display_claude_output()
        else:
            # Process with Ani
            self.add_ani_message("You", user_input)
            self.status_message = "Thinking..."
            self.update_status()
            
            try:
                response = self.wrapper.process_request(user_input)
                
                if "error" in response:
                    self.add_ani_message("Error", response["error"])
                else:
                    self.add_ani_message("Ani", response["response"])
                    self.status_message = f"Ready | {response.get('source', 'unknown')}"
            except Exception as e:
                self.add_ani_message("Error", f"Processing failed: {str(e)}")
                self.status_message = "Error"
            
            self.update_status()
    
    def run(self):
        """Main TUI loop"""
        # Initialize display
        if self.claude_mode:
            self.display_claude_output()
        else:
            self.add_ani_message("System", "Claude-Condom initialized. Press Ctrl+T to switch to Claude Code.")
            self.display_ani_output()
        
        while True:
            user_input = self.handle_input()
            
            if user_input is None:  # Exit requested
                break
            
            if user_input.lower() in ['quit', 'exit']:
                break
            
            self.process_input(user_input)
        
        # Cleanup
        if self.claude_process:
            self.claude_process.terminate()
        if self.claude_master:
            os.close(self.claude_master)

def main():
    def run_tui(stdscr):
        curses.curs_set(1)
        tui = DualTUI(stdscr)
        tui.run()
    
    try:
        curses.wrapper(run_tui)
    except KeyboardInterrupt:
        print("\nGoodbye!")

if __name__ == "__main__":
    main()