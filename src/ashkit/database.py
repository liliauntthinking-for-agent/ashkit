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

            CREATE TABLE IF NOT EXISTS heartbeat_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                prompt TEXT,
                response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
            );

            CREATE INDEX IF NOT EXISTS idx_heartbeat_agent ON heartbeat_logs(agent_id);

            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT UNIQUE NOT NULL,
                name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS group_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                member_id TEXT NOT NULL,
                member_type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(group_id),
                UNIQUE(group_id, member_id, member_type)
            );

            CREATE TABLE IF NOT EXISTS group_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                sender_type TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(group_id)
            );

            CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
            CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id);
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
        if "heartbeat" not in columns:
            conn.execute("ALTER TABLE agents ADD COLUMN heartbeat TEXT")
        
        try:
            conn.execute("CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id)")
        except sqlite3.OperationalError:
            pass
        
        cursor = conn.execute("PRAGMA table_info(sessions)")
        session_columns = [row[1] for row in cursor.fetchall()]

        if "name" not in session_columns:
            conn.execute("ALTER TABLE sessions ADD COLUMN name TEXT")
        if "compressed_context" not in session_columns:
            conn.execute("ALTER TABLE sessions ADD COLUMN compressed_context TEXT")

        cursor = conn.execute("PRAGMA table_info(messages)")
        message_columns = [row[1] for row in cursor.fetchall()]

        if "metadata" not in message_columns:
            conn.execute("ALTER TABLE messages ADD COLUMN metadata TEXT")

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
        if result.get("heartbeat"):
            result["heartbeat"] = json.loads(result["heartbeat"])
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
            if r.get("heartbeat"):
                r["heartbeat"] = json.loads(r["heartbeat"])
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

    def set_compressed_context(self, session_id: str, compressed_context: str) -> bool:
        """Set compressed context for a session, clearing original messages."""
        conn = self._get_conn()
        conn.execute(
            "UPDATE sessions SET compressed_context = ? WHERE session_id = ?",
            (compressed_context, session_id),
        )
        conn.commit()
        conn.close()
        return True

    def get_compressed_context(self, session_id: str) -> str | None:
        """Get compressed context for a session."""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT compressed_context FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        conn.close()
        return row["compressed_context"] if row else None

    def clear_compressed_context(self, session_id: str) -> bool:
        """Clear compressed context for a session."""
        conn = self._get_conn()
        conn.execute(
            "UPDATE sessions SET compressed_context = NULL WHERE session_id = ?",
            (session_id,),
        )
        conn.commit()
        conn.close()
        return True

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

    def get_messages(self, session_id: str, limit: int = 20, offset: int = 0) -> list[dict]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
            (session_id, limit, offset),
        ).fetchall()
        conn.close()
        results = []
        for row in rows:
            r = dict(row)
            if r.get("metadata"):
                r["metadata"] = json.loads(r["metadata"])
            results.append(r)
        return results

    def get_latest_messages(self, session_id: str, limit: int = 20) -> list[dict]:
        """Get the latest N messages, returned in chronological order."""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        conn.close()
        results = []
        for row in reversed(rows):
            r = dict(row)
            if r.get("metadata"):
                r["metadata"] = json.loads(r["metadata"])
            results.append(r)
        return results

    def get_messages_before(self, session_id: str, before_id: int, limit: int = 20) -> list[dict]:
        """Get messages before a specific ID, returned in chronological order."""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM messages WHERE session_id = ? AND id < ? ORDER BY created_at DESC LIMIT ?",
            (session_id, before_id, limit),
        ).fetchall()
        conn.close()
        results = []
        for row in reversed(rows):
            r = dict(row)
            if r.get("metadata"):
                r["metadata"] = json.loads(r["metadata"])
            results.append(r)
        return results

    def get_message_count(self, session_id: str) -> int:
        conn = self._get_conn()
        cursor = conn.execute("SELECT COUNT(*) FROM messages WHERE session_id = ?", (session_id,))
        count = cursor.fetchone()[0]
        conn.close()
        return count

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

    def delete_all_sessions(self, agent_id: str | None = None) -> int:
        conn = self._get_conn()
        if agent_id:
            conn.execute("DELETE FROM messages WHERE session_id IN (SELECT session_id FROM sessions WHERE agent_id = ?)", (agent_id,))
            conn.execute("DELETE FROM sessions WHERE agent_id = ?", (agent_id,))
        else:
            conn.execute("DELETE FROM messages")
            conn.execute("DELETE FROM sessions")
        affected = conn.total_changes
        conn.commit()
        conn.close()
        return affected

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

    def update_agent_heartbeat(self, agent_id: str, heartbeat: dict | None) -> dict | None:
        """Update agent heartbeat config"""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        heartbeat_json = json.dumps(heartbeat, ensure_ascii=False) if heartbeat else None
        conn.execute(
            "UPDATE agents SET heartbeat = ?, updated_at = ? WHERE agent_id = ?",
            (heartbeat_json, now, agent_id),
        )
        conn.commit()
        conn.close()
        return self.get_agent(agent_id)

    def add_heartbeat_log(self, agent_id: str, prompt: str, response: str) -> dict:
        """Add a heartbeat log entry"""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        cursor = conn.execute(
            "INSERT INTO heartbeat_logs (agent_id, prompt, response, created_at) VALUES (?, ?, ?, ?)",
            (agent_id, prompt, response, now),
        )
        log_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"id": log_id, "agent_id": agent_id, "prompt": prompt, "response": response, "created_at": now}

    def get_heartbeat_logs(self, agent_id: str, limit: int = 20) -> list[dict]:
        """Get heartbeat logs for an agent"""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM heartbeat_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?",
            (agent_id, limit),
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def delete_heartbeat_logs(self, agent_id: str) -> bool:
        """Delete all heartbeat logs for an agent"""
        conn = self._get_conn()
        conn.execute("DELETE FROM heartbeat_logs WHERE agent_id = ?", (agent_id,))
        affected = conn.total_changes
        conn.commit()
        conn.close()
        return affected > 0

    # ==================== Group Methods ====================

    def create_group(self, group_id: str, name: str | None = None) -> dict:
        """Create a new group"""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        conn.execute(
            "INSERT INTO groups (group_id, name, created_at) VALUES (?, ?, ?)",
            (group_id, name, now),
        )
        conn.commit()
        conn.close()
        return {"group_id": group_id, "name": name, "created_at": now}

    def get_group(self, group_id: str) -> dict | None:
        """Get group info"""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT * FROM groups WHERE group_id = ?", (group_id,)
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    def list_groups(self) -> list[dict]:
        """List all groups"""
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM groups ORDER BY created_at DESC").fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def delete_group(self, group_id: str) -> bool:
        """Delete a group and all its members and messages"""
        conn = self._get_conn()
        conn.execute("DELETE FROM group_messages WHERE group_id = ?", (group_id,))
        conn.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
        conn.execute("DELETE FROM groups WHERE group_id = ?", (group_id,))
        affected = conn.total_changes
        conn.commit()
        conn.close()
        return affected > 0

    def add_group_member(self, group_id: str, member_id: str, member_type: str) -> dict:
        """Add a member to a group. member_type: 'user' or 'agent'"""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        try:
            conn.execute(
                "INSERT INTO group_members (group_id, member_id, member_type, created_at) VALUES (?, ?, ?, ?)",
                (group_id, member_id, member_type, now),
            )
            conn.commit()
            conn.close()
            return {"group_id": group_id, "member_id": member_id, "member_type": member_type}
        except sqlite3.IntegrityError:
            conn.close()
            return {"error": "Member already in group"}

    def remove_group_member(self, group_id: str, member_id: str, member_type: str) -> bool:
        """Remove a member from a group"""
        conn = self._get_conn()
        conn.execute(
            "DELETE FROM group_members WHERE group_id = ? AND member_id = ? AND member_type = ?",
            (group_id, member_id, member_type),
        )
        affected = conn.total_changes
        conn.commit()
        conn.close()
        return affected > 0

    def get_group_members(self, group_id: str) -> list[dict]:
        """Get all members of a group"""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT member_id, member_type FROM group_members WHERE group_id = ?",
            (group_id,),
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def get_groups_for_member(self, member_id: str, member_type: str) -> list[dict]:
        """Get all groups a member belongs to"""
        conn = self._get_conn()
        rows = conn.execute(
            """SELECT g.* FROM groups g
               JOIN group_members gm ON g.group_id = gm.group_id
               WHERE gm.member_id = ? AND gm.member_type = ?""",
            (member_id, member_type),
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def add_group_message(self, group_id: str, sender_id: str, sender_type: str, content: str, metadata: dict | None = None) -> dict:
        """Add a message to a group"""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        metadata_json = json.dumps(metadata, ensure_ascii=False) if metadata else None
        cursor = conn.execute(
            "INSERT INTO group_messages (group_id, sender_id, sender_type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (group_id, sender_id, sender_type, content, metadata_json, now),
        )
        msg_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return {"id": msg_id, "group_id": group_id, "sender_id": sender_id, "sender_type": sender_type, "content": content, "metadata": metadata, "created_at": now}

    def get_group_messages(self, group_id: str, limit: int = 50, before_id: int | None = None) -> list[dict]:
        """Get messages from a group"""
        conn = self._get_conn()
        if before_id:
            rows = conn.execute(
                """SELECT * FROM group_messages WHERE group_id = ? AND id < ?
                   ORDER BY created_at DESC LIMIT ?""",
                (group_id, before_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at DESC LIMIT ?",
                (group_id, limit),
            ).fetchall()
        conn.close()

        results = []
        for row in reversed(list(rows)):
            r = dict(row)
            if r.get("metadata"):
                r["metadata"] = json.loads(r["metadata"])
            results.append(r)
        return results

    def get_group_message_count(self, group_id: str) -> int:
        """Get message count for a group"""
        conn = self._get_conn()
        cursor = conn.execute("SELECT COUNT(*) FROM group_messages WHERE group_id = ?", (group_id,))
        count = cursor.fetchone()[0]
        conn.close()
        return count