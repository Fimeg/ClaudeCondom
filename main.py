#!/usr/bin/env python3

from core.wrapper import AIWrapper
import json

def main():
    # Initialize the wrapper
    wrapper = AIWrapper(ollama_host="10.10.20.19", ollama_port=11434)
    
    # Your custom personality prompt goes here
    personality_prompt = """
    [Place your personality system prompt here - the one you mentioned earlier]
    """
    
    wrapper.set_personality_prompt(personality_prompt)
    
    # Test connections
    print("Testing connections...")
    connections = wrapper.test_connections()
    print(f"Ollama: {'✓' if connections['ollama'] else '✗'}")
    print(f"Context DB: {'✓' if connections['context_db'] else '✗'}")
    
    if not connections['ollama']:
        print("Warning: Ollama connection failed. Check if gemma3n:e4b is running at 10.10.20.19:11434")
        return
    
    print("\nAI Wrapper ready. Type 'quit' to exit.\n")
    
    while True:
        try:
            user_input = input("You: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                break
                
            if not user_input:
                continue
            
            # Process the request
            response = wrapper.process_request(user_input)
            
            if "error" in response:
                print(f"Error: {response['error']}")
            else:
                print(f"AI ({response['source']}): {response['response']}")
                print(f"[Used {response['context_used']} context entries]\n")
                
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()