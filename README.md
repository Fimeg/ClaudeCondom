# Claude-Condom v0.0.1: AI Wrapper

> **⚠️ DEPRECATED - NO LONGER UNDER DEVELOPMENT**  
> This repository is preserved for posterity. Development has moved to [Coquette](https://github.com/yourusername/coquette) - a more sophisticated multi-model AI orchestration system.

A wrapper system that combines Claude's technical reasoning with Gemma's personality layer.

## Features

- **Dual Backend**: Claude CLI for technical responses, Gemma (via Ollama) for personality
- **External Personality**: Edit `personality.txt` without code changes
- **TUI Interface**: Color-coded responses with real-time toggle
- **Context Management**: Persistent memory with relevance scoring
- **Real-time Updates**: Personality file reloads automatically

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Ensure Claude CLI is available:**
   ```bash
   which claude  # Should return path to Claude CLI
   ```

3. **Configure Ollama:**
   - Ensure Gemma3n:e4b is running at 10.10.20.19:11434
   - Test with: `ollama list`

4. **Edit personality:**
   - Modify `personality.txt` with your desired AI personality
   - Changes take effect immediately (no restart needed)

## Usage

### TUI Mode (Recommended)
```bash
python tui.py
```

**Controls:**
- `Ctrl+T`: Toggle between Ani (interpreted) and Claude (raw) responses
- `Ctrl+C`: Exit
- Type normally to chat

### CLI Mode (Basic)
```bash
python main.py
```

## How It Works

1. **Technical Queries**: Detected automatically and sent to Claude CLI
2. **Claude Response**: Captured and passed to Gemma for personality interpretation
3. **Final Output**: Gemma responds using personality from `personality.txt`
4. **Toggle View**: Switch between interpreted (Ani) and raw (Claude) responses

## File Structure

```
claude-condom/
├── personality.txt          # User-editable personality prompt
├── tui.py                   # Terminal UI (recommended)
├── main.py                  # Basic CLI interface
├── core/
│   ├── wrapper.py           # Main orchestration
│   ├── ollama_client.py     # Gemma integration
│   └── context_manager.py   # Memory management
└── context_memory.db        # Auto-created context storage
```

## Troubleshooting

- **Claude not found**: Ensure `claude` is in your PATH
- **Ollama connection failed**: Check Gemma3n:e4b is running at correct IP/port
- **Personality not working**: Verify `personality.txt` exists and is readable

## Technical Details

- Uses subprocess to execute actual Claude CLI commands
- SQLite for context persistence with emotional/relevance weighting
- Automatic context pruning to manage memory
- Real-time personality file monitoring