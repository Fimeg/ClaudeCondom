import json
import sqlite3
from typing import Dict, List, Any, Optional
from datetime import datetime
import hashlib

class ContextManager:
    def __init__(self, db_path: str = "context_memory.db"):
        self.db_path = db_path
        self.init_database()
        
    def init_database(self):
        """Initialize SQLite database for context storage"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS context_entries (
                id TEXT PRIMARY KEY,
                user_input TEXT,
                claude_response TEXT,
                ollama_response TEXT,
                timestamp DATETIME,
                emotional_weight REAL,
                relevance_score REAL,
                context_type TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS session_state (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated DATETIME
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def store_interaction(self, user_input: str, claude_response: str = "", 
                         ollama_response: str = "", emotional_weight: float = 0.5,
                         relevance_score: float = 0.5, context_type: str = "general"):
        """Store interaction with weighted scoring"""
        interaction_id = hashlib.md5(f"{user_input}{datetime.now()}".encode()).hexdigest()
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO context_entries 
            (id, user_input, claude_response, ollama_response, timestamp, 
             emotional_weight, relevance_score, context_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (interaction_id, user_input, claude_response, ollama_response,
              datetime.now(), emotional_weight, relevance_score, context_type))
        
        conn.commit()
        conn.close()
        return interaction_id
    
    def get_relevant_context(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve most relevant context based on scoring"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM context_entries 
            ORDER BY (emotional_weight * 0.4 + relevance_score * 0.6) DESC
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        columns = ['id', 'user_input', 'claude_response', 'ollama_response', 
                   'timestamp', 'emotional_weight', 'relevance_score', 'context_type']
        
        return [dict(zip(columns, row)) for row in rows]
    
    def update_relevance_score(self, interaction_id: str, new_score: float):
        """Update relevance score based on feedback"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE context_entries 
            SET relevance_score = ?
            WHERE id = ?
        ''', (new_score, interaction_id))
        
        conn.commit()
        conn.close()
    
    def prune_old_context(self, max_entries: int = 1000):
        """Remove oldest, least relevant entries"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM context_entries 
            WHERE id NOT IN (
                SELECT id FROM context_entries 
                ORDER BY (emotional_weight * 0.4 + relevance_score * 0.6) DESC
                LIMIT ?
            )
        ''', (max_entries,))
        
        conn.commit()
        conn.close()
    
    def set_session_state(self, key: str, value: Any):
        """Store session-specific state"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO session_state (key, value, updated)
            VALUES (?, ?, ?)
        ''', (key, json.dumps(value), datetime.now()))
        
        conn.commit()
        conn.close()
    
    def get_session_state(self, key: str) -> Any:
        """Retrieve session-specific state"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT value FROM session_state WHERE key = ?', (key,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None