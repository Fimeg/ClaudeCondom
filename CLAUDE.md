# Claude-Condom: AI Wrapper System

## 🎉 STATUS: CORE FUNCTIONALITY WORKING! 

**Achievement Unlocked**: Ani now sees and responds to real Claude Code output instead of hallucinating responses!

### What Works Now ✅
- **Content Pipeline**: Claude Code → Content Extraction → Gemma → Ani responses
- **Technical Detection**: Keywords like "files", "project", "summary" properly trigger Claude mode
- **Content Filtering**: Thinking animations (✻ Spelunking...) and UI noise filtered out
- **Real Data Integration**: Ani mentions actual project files, structure, and details
- **Personality Layer**: Ani maintains her character while using real technical information

### Example Success
**User**: "Can you give me a list of files in the current directory?"
**Ani Response**: ✅ "You've got your core Python modules, the React components in the `src/` directory, and the database for context memory. And, of course, the usual suspects: `README.md`, the package files, and debug logs."

(Previously she would make up fake files like "image_recognition_model.h5")

## 🚧 Next Phase Improvements

### 1. Clean Up Claude Code UI Noise
**Goal**: Remove remaining UI clutter from Claude's output
- [ ] Filter "Approaching usage limit · resets at 3am" messages
- [ ] Filter repeated "✗ Auto-update failed" spam 
- [ ] Filter "? for shortcuts" repetition
- [ ] Keep only Claude's actual responses and meaningful status

### 2. Fix Input Experience  
**Goal**: Make input work like modern terminals
- [ ] Fix backspace functionality (currently broken)
- [ ] Add Ctrl+Shift+V paste support
- [ ] Add arrow key navigation in input
- [ ] Add input history (up/down arrows)
- [ ] **Reference**: Study Gemini-CLI for input handling patterns

### 3. Context Management
**Goal**: Handle long conversations gracefully  
- [ ] Implement conversation chunking for Claude mode
- [ ] Add context summarization when hitting limits
- [ ] Add session resume capability
- [ ] Track conversation memory efficiently

### 4. Performance & Reliability
**Goal**: Make the system more robust
- [ ] Add timeout handling for Gemma requests
- [ ] Implement retry logic for failed requests
- [ ] Add better error handling for Claude Code crashes
- [ ] Optimize content extraction performance

## 🛠️ Technical Architecture

### Current Flow
```
User Input → Technical Detection → Claude Code → Content Extraction → Gemma + Personality → Ani Response
```

### Key Components
- **AIWrapper.ts**: Main orchestration, content filtering
- **extractKeyContent()**: Pulls meaningful content from Claude noise
- **extractMeaningfulContent()**: Initial line-level filtering  
- **Technical Keywords**: Triggers Claude mode vs pure Gemma
- **InputPrompt.tsx**: Terminal UI (needs input fixes)

### Content Extraction Strategy
Instead of aggressive line filtering, we now:
1. Extract blocks of meaningful content (● markers, - file listings)
2. Send only clean content to Gemma (not full buffer)
3. Let Gemma handle minor noise rather than risk losing real content

## 🔄 How to Resume Development

### Quick Start
```bash
cd /home/casey/claude-condom
npm run dev:debug  # For detailed logging
```

### Test Scenarios
1. **File Listings**: "Can you show me the files in this directory?"
2. **Project Analysis**: "What is this project about?"  
3. **Technical Questions**: "How does the AIWrapper work?"

### Debug Commands
- Use `--debug` flag to see content extraction in action
- Check `[KEY-CONTENT]` logs to see what Gemma receives
- Monitor `[CLAUDE-RESPONSE]` to verify Claude integration

## 📚 Reference Projects
- **Gemini-CLI**: For modern terminal input handling
- **Ink Documentation**: For React-based CLI components
- **Claude Code API**: For understanding output patterns

## 🎯 Success Metrics
- ✅ Ani mentions real files/directories instead of hallucinations
- ✅ Technical queries route through Claude Code 
- ✅ Personality maintained while using real data
- 🚧 Input experience matches modern CLI tools
- 🚧 Long conversations handled gracefully
- 🚧 Clean, minimal Claude output display

---

**Last Updated**: 2025-07-21 - Core pipeline working, ready for UX improvements