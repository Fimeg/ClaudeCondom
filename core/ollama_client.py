import requests
import json
from typing import Dict, Any, List, Optional

class OllamaClient:
    def __init__(self, host: str = "10.10.20.19", port: int = 11434):
        self.base_url = f"http://{host}:{port}"
        self.model = "gemma3n:e4b"
        
    def generate(self, prompt: str, system_prompt: Optional[str] = None, context: Optional[List[int]] = None) -> Dict[str, Any]:
        """Generate response from Ollama model"""
        url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        
        if system_prompt:
            payload["system"] = system_prompt
            
        if context:
            payload["context"] = context
            
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": f"Ollama connection failed: {str(e)}"}
    
    def chat(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Chat interface for conversational flow"""
        url = f"{self.base_url}/api/chat"
        
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False
        }
        
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": f"Ollama chat failed: {str(e)}"}
    
    def test_connection(self) -> bool:
        """Test if Ollama server is accessible"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            return response.status_code == 200
        except:
            return False