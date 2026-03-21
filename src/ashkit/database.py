import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


class Database:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT UNIQUE NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                agent_id TEXT NOT NULL,
                name TEXT,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
            );
            
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id);
        """)
        conn.commit()
        conn.close()

    def create_agent(self, agent_id: str, provider: str, model: str) -> dict:
        conn = self._get_conn()
        now = datetime.now().isoformat()
        conn.execute(
            "INSERT INTO agents (agent_id, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (agent_id, provider, model, now, now),
        )
        conn.commit()
        conn.close()
        return self.get_agent(agent_id)

    def get_agent(self, agent_id: str) -> dict | None:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM agents WHERE agent_id = ?", (agent_id,)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def list_agents(self) -> list[dict]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM agents ORDER BY created_at DESC").fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def delete_agent(self, agent_id: str) -> bool:
        conn = self._get_conn()
        conn.execute("DELETE FROM messages WHERE session_id IN (SELECT session_id FROM sessions WHERE agent_id = ?)", (agent_id,))
        conn.execute("DELETE FROM sessions WHERE agent_id = ?", (agent_id,))
        conn.execute("DELETE FROM agents WHERE agent_id = ?", (agent_id,))
        affected = conn.total_changes
        conn.commit()
        conn.close()
        return affected > 0

    def create_session(self, session_id: str, agent_id: str, name: str | None = None) -> dict:
        conn = self._get_conn()
        now = datetime.now().isoformat()
        conn.execute(
            "INSERT INTO sessions (session_id, agent_id, name, created_at) VALUES (?, ?, ?, ?)",
            (session_id, agent_id, name, now),
        )
        conn.commit()
        conn.close()
        return {"session_id": session_id, "agent_id": agent_id, "name": name, "status": "active"}

    def get_session(self, session_id: str) -> dict | None:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def update_session_name(self, session_id: str, name: str) -> bool:
        conn = self._get_conn()
        conn.execute(
            "UPDATE sessions SET name = ? WHERE session_id = ?",
            (name, session_id),
        )
        affected = conn.total_changes
        conn.commit()
        conn.close()
        return affected > 0

    def list_sessions(self, agent_id: str | None = None) -> list[dict]:
        conn = self._get_conn()
        if agent_id:
            rows = conn.execute(
                "SELECT * FROM sessions WHERE agent_id = ? ORDER BY created_at DESC",
                (agent_id,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM sessions ORDER BY created_at DESC").fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def add_message(self, session_id: str, role: str, content: str) -> dict:
        conn = self._get_conn()
        now = datetime.now().isoformat()
        cursor = conn.execute(
            "INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, content, now),
        )
        msg_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"id": msg_id, "session_id": session_id, "role": role, "content": content}

    def get_messages(self, session_id: str, limit: int = 100) -> list[dict]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def clear_messages(self, session_id: str):
        conn = self._get_conn()
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.commit()
        conn.close()