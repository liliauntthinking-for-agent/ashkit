import json
import sqlite3
from datetime import datetime
from pathlib import Path


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
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                profile TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT UNIQUE NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                profile TEXT,
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
        
        cursor = conn.execute("PRAGMA table_info(agents)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "profile" not in columns:
            conn.execute("ALTER TABLE agents ADD COLUMN profile TEXT")
        if "user_id" not in columns:
            conn.execute("ALTER TABLE agents ADD COLUMN user_id TEXT REFERENCES users(user_id)")
        if "relation" not in columns:
            conn.execute("ALTER TABLE agents ADD COLUMN relation TEXT")
        
        try:
            conn.execute("CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id)")
        except sqlite3.OperationalError:
            pass
        
        cursor = conn.execute("PRAGMA table_info(sessions)")
        session_columns = [row[1] for row in cursor.fetchall()]
        
        if "name" not in session_columns:
            conn.execute("ALTER TABLE sessions ADD COLUMN name TEXT")
        
        conn.commit()
        conn.close()

    def create_agent(self, agent_id: str, provider: str, model: str, profile: dict | None = None, user_id: str | None = None, relation: str | None = None) -> dict:
        conn = self._get_conn()
        now = datetime.now().isoformat()
        profile_json = json.dumps(profile, ensure_ascii=False) if profile else None
        conn.execute(
            "INSERT INTO agents (agent_id, provider, model, profile, user_id, relation, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (agent_id, provider, model, profile_json, user_id, relation, now, now),
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
        if not row:
            return None
        result = dict(row)
        if result.get("profile"):
            result["profile"] = json.loads(result["profile"])
        if result.get("mcp_servers"):
            result["mcp_servers"] = json.loads(result["mcp_servers"])
        return result

    def list_agents(self) -> list[dict]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM agents ORDER BY created_at DESC").fetchall()
        conn.close()
        results = []
        for row in rows:
            r = dict(row)
            if r.get("profile"):
                r["profile"] = json.loads(r["profile"])
            if r.get("mcp_servers"):
                r["mcp_servers"] = json.loads(r["mcp_servers"])
            results.append(r)
        return results

    def update_agent(self, agent_id: str, profile: dict | None = None, user_id: str | None = None, relation: str | None = None, mcp_servers: list[str] | None = None) -> dict | None:
        conn = self._get_conn()
        now = datetime.now().isoformat()
        profile_json = json.dumps(profile, ensure_ascii=False) if profile else None
        mcp_servers_json = json.dumps(mcp_servers, ensure_ascii=False) if mcp_servers else None
        conn.execute(
            "UPDATE agents SET profile = ?, user_id = ?, relation = ?, mcp_servers = ?, updated_at = ? WHERE agent_id = ?",
            (profile_json, user_id, relation, mcp_servers_json, now, agent_id),
        )
        conn.commit()
        conn.close()
        return self.get_agent(agent_id)

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

    def add_message(self, session_id: str, role: str, content: str, metadata: dict | None = None) -> dict:
        conn = self._get_conn()
        now = datetime.now().isoformat()
        metadata_json = json.dumps(metadata, ensure_ascii=False) if metadata else None
        cursor = conn.execute(
            "INSERT INTO messages (session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, role, content, metadata_json, now),
        )
        msg_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"id": msg_id, "session_id": session_id, "role": role, "content": content, "metadata": metadata}

    def get_messages(self, session_id: str, limit: int = 100) -> list[dict]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        conn.close()
        results = []
        for row in rows:
            r = dict(row)
            if r.get("metadata"):
                r["metadata"] = json.loads(r["metadata"])
            results.append(r)
        return results

    def clear_messages(self, session_id: str):
        conn = self._get_conn()
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.commit()
        conn.close()

    def delete_session(self, session_id: str) -> bool:
        conn = self._get_conn()
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        affected = conn.total_changes
        conn.commit()
        conn.close()
        return affected > 0

    def create_user(self, user_id: str, profile: dict | None = None) -> dict:
        conn = self._get_conn()
        now = datetime.now().isoformat()
        profile_json = json.dumps(profile, ensure_ascii=False) if profile else None
        conn.execute(
            "INSERT INTO users (user_id, profile, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (user_id, profile_json, now, now),
        )
        conn.commit()
        conn.close()
        return self.get_user(user_id)

    def get_user(self, user_id: str) -> dict | None:
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        conn.close()
        if not row:
            return None
        result = dict(row)
        if result.get("profile"):
            result["profile"] = json.loads(result["profile"])
        return result

    def list_users(self) -> list[dict]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
        conn.close()
        results = []
        for row in rows:
            r = dict(row)
            if r.get("profile"):
                r["profile"] = json.loads(r["profile"])
            results.append(r)
        return results

    def update_user(self, user_id: str, profile: dict | None = None) -> dict | None:
        conn = self._get_conn()
        now = datetime.now().isoformat()
        profile_json = json.dumps(profile, ensure_ascii=False) if profile else None
        conn.execute(
            "UPDATE users SET profile = ?, updated_at = ? WHERE user_id = ?",
            (profile_json, now, user_id),
        )
        conn.commit()
        conn.close()
        return self.get_user(user_id)

    def delete_user(self, user_id: str) -> bool:
        conn = self._get_conn()
        conn.execute("UPDATE agents SET user_id = NULL, relation = NULL WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
        affected = conn.total_changes
        conn.commit()
        conn.close()
        return affected > 0