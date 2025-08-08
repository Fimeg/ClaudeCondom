from typing import Dict, Any, Optional
from .ollama_client import OllamaClient
from .context_manager import ContextManager
import json
import subprocess
import os
import tempfile

class AIWrapper:
    def __init__(self, ollama_host: str = "10.10.20.19", ollama_port: int = 11434):
        self.ollama = OllamaClient(ollama_host, ollama_port)
        self.context_manager = ContextManager()
        self.personality_prompt = ""
        self.personality_file = "personality.txt"
        self.load_personality_prompt()
        
    def load_personality_prompt(self):
        """Load personality prompt from external file"""
        try:
            if os.path.exists(self.personality_file):
                with open(self.personality_file, 'r', encoding='utf-8') as f:
                    self.personality_prompt = f.read().strip()
                self.context_manager.set_session_state("personality_prompt", self.personality_prompt)
            else:
                self.personality_prompt = "You are a helpful AI assistant."
        except Exception as e:
            print(f"Warning: Could not load personality file: {e}")
            self.personality_prompt = "You are a helpful AI assistant."
    
    def set_personality_prompt(self, prompt: str):
        """Set the system prompt for personality layer"""
        self.personality_prompt = prompt
        self.context_manager.set_session_state("personality_prompt", prompt)
    
    def process_request(self, user_input: str, use_claude: bool = True) -> Dict[str, Any]:
        """Main processing pipeline"""
        
        # Get relevant context
        context_entries = self.context_manager.get_relevant_context(user_input)
        context_summary = self._summarize_context(context_entries)
        
        # Reload personality file for real-time updates
        self.load_personality_prompt()
        
        # Determine if this is technical (Claude) or personality (Ollama) focused
        if use_claude and self._is_technical_query(user_input):
            # Use Claude for technical reasoning
            claude_result = self._process_with_claude(user_input, context_summary)
            
            if claude_result["success"]:
                # Enhance with personality layer
                enhanced_prompt = f"""
                Context: {context_summary}
                Technical Response from Claude: {claude_result['response']}
                User Query: {user_input}
                
                {self.personality_prompt}
                
                Please respond incorporating the technical information with your personality. The technical response from Claude should be interpreted through your character.
                """
                
                ollama_response = self.ollama.generate(enhanced_prompt)
                
                if "error" not in ollama_response:
                    final_response = ollama_response.get("response", "")
                    self._store_interaction(user_input, claude_result['response'], final_response)
                    return {
                        "response": final_response,
                        "source": "claude+ollama",
                        "context_used": len(context_entries),
                        "claude_response": claude_result['response']
                    }
            else:
                # Claude failed, fall back to pure Ollama
                return {
                    "error": claude_result['error'],
                    "fallback": True
                }
        
        # Pure personality response
        full_prompt = f"""
        Context: {context_summary}
        User Query: {user_input}
        
        {self.personality_prompt}
        """
        
        ollama_response = self.ollama.generate(full_prompt)
        
        if "error" in ollama_response:
            return {"error": ollama_response["error"]}
        
        response_text = ollama_response.get("response", "")
        self._store_interaction(user_input, "", response_text)
        
        return {
            "response": response_text,
            "source": "ollama",
            "context_used": len(context_entries)
        }
    
    def _is_technical_query(self, query: str) -> bool:
        """Determine if query is technical in nature"""
        technical_keywords = [
            "code", "function", "debug", "error", "programming", "algorithm",
            "api", "database", "server", "framework", "library", "bug", "test"
        ]
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in technical_keywords)
    
    def _process_with_claude(self, query: str, context: str) -> Dict[str, Any]:
        """Execute Claude CLI and capture response"""
        try:
            # Create a temporary file for the query
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
                temp_file.write(f"Context: {context}\n\nQuery: {query}")
                temp_file_path = temp_file.name
            
            # Execute Claude CLI
            cmd = ['claude', '--file', temp_file_path]
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=60
            )
            
            # Clean up temp file
            os.unlink(temp_file_path)
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "response": result.stdout.strip(),
                    "error": None
                }
            else:
                return {
                    "success": False,
                    "response": "",
                    "error": f"Claude CLI error: {result.stderr}"
                }
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "response": "",
                "error": "Claude CLI timeout"
            }
        except FileNotFoundError:
            return {
                "success": False,
                "response": "",
                "error": "Claude CLI not found - ensure 'claude' is in PATH"
            }
        except Exception as e:
            return {
                "success": False,
                "response": "",
                "error": f"Claude execution error: {str(e)}"
            }
    
    def _summarize_context(self, context_entries: list) -> str:
        """Create a concise context summary"""
        if not context_entries:
            return "No previous context."
        
        summaries = []
        for entry in context_entries[:5]:  # Limit to top 5
            user_part = entry['user_input'][:100] + "..." if len(entry['user_input']) > 100 else entry['user_input']
            summaries.append(f"User: {user_part}")
            
        return "Recent context:\n" + "\n".join(summaries)
    
    def _store_interaction(self, user_input: str, claude_response: str, ollama_response: str):
        """Store interaction with automatic scoring"""
        # Simple emotion detection based on keywords
        emotional_keywords = ["love", "hate", "excited", "frustrated", "happy", "sad", "angry"]
        emotional_weight = 0.5
        
        for keyword in emotional_keywords:
            if keyword in user_input.lower() or keyword in ollama_response.lower():
                emotional_weight = 0.8
                break
        
        # Technical relevance scoring
        relevance_score = 0.7 if self._is_technical_query(user_input) else 0.5
        
        self.context_manager.store_interaction(
            user_input, claude_response, ollama_response,
            emotional_weight, relevance_score
        )
    
    def test_connections(self) -> Dict[str, bool]:
        """Test all system connections"""
        return {
            "ollama": self.ollama.test_connection(),
            "context_db": True  # SQLite is always available
        }