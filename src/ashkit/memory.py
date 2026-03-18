import asyncio
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class MemoryL1:
    """Working Memory - Current conversation context in memory"""

    def __init__(self, max_tokens: int = 64000):
        self.max_tokens = max_tokens
        self.messages: list[dict] = []

    def add_message(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

    def get_context(self) -> list[dict]:
        return self.messages[-20:]

    def clear(self):
        self.messages = []

    def count_tokens(self, text: str) -> int:
        return len(text) // 4


class MemoryL2:
    """Episodic Memory - Historical conversation summaries stored in SQLite"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                summary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_session ON episodes(session_id)
        """)
        conn.commit()
        conn.close()

    def add_summary(self, session_id: str, user_id: str, summary: str):
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "INSERT INTO episodes (session_id, user_id, summary) VALUES (?, ?, ?)",
            (session_id, user_id, summary),
        )
        conn.commit()
        conn.close()

    def get_recent(self, session_id: str, limit: int = 10) -> list[dict]:
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            "SELECT id, session_id, summary, created_at FROM episodes "
            "WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
            (session_id, limit),
        )
        results = [
            {"id": r[0], "session_id": r[1], "summary": r[2], "created_at": r[3]}
            for r in cursor.fetchall()
        ]
        conn.close()
        return results

    def cleanup_old(self, retention: int = 100):
        import sqlite3

        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "DELETE FROM episodes WHERE id NOT IN "
            "(SELECT id FROM episodes ORDER BY created_at DESC LIMIT ?)",
            (retention,),
        )
        conn.commit()
        conn.close()


class MemoryL3:
    """Semantic Memory - Long-term knowledge with vector storage (FAISS)"""

    def __init__(self, db_path: Path, vector_dim: int = 1536):
        import sqlite3
        import faiss

        self.db_path = db_path
        self.vector_dim = vector_dim
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS semantic_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_user ON semantic_memories(user_id)"
        )
        conn.commit()
        conn.close()

        index_path = self.db_path.parent / "faiss.index"
        if index_path.exists():
            self.index = faiss.read_index(str(index_path))
        else:
            self.index = faiss.IndexFlatL2(vector_dim)

        self._conn = None

    def _get_conn(self):
        import sqlite3

        if not self._conn:
            self._conn = sqlite3.connect(self.db_path)
        return self._conn

    def add_memory(self, user_id: str, content: str, embedding: list[float]):
        import numpy as np

        conn = self._get_conn()
        embedding_bytes = np.array(embedding, dtype=np.float32).tobytes()
        conn.execute(
            "INSERT INTO semantic_memories (user_id, content, embedding) VALUES (?, ?, ?)",
            (user_id, content, embedding_bytes),
        )
        conn.commit()

        import numpy as np

        vec = np.array([embedding], dtype=np.float32)
        self.index.add(vec)

        index_path = self.db_path.parent / "faiss.index"
        faiss.write_index(self.index, str(index_path))

    def search(
        self, user_id: str, query_embedding: list[float], top_k: int = 5
    ) -> list[dict]:
        import numpy as np

        if self.index.ntotal == 0:
            return []

        query_vec = np.array([query_embedding], dtype=np.float32)
        distances, indices = self.index.search(query_vec, top_k)

        conn = self._get_conn()
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx >= 0:
                cursor = conn.execute(
                    "SELECT id, user_id, content FROM semantic_memories WHERE id = ?",
                    (idx + 1,),
                )
                row = cursor.fetchone()
                if row:
                    results.append(
                        {
                            "id": row[0],
                            "user_id": row[1],
                            "content": row[2],
                            "distance": float(dist),
                        }
                    )
        return results

    def get_all(self, user_id: str) -> list[dict]:
        conn = self._get_conn()
        cursor = conn.execute(
            "SELECT id, user_id, content FROM semantic_memories WHERE user_id = ?",
            (user_id,),
        )
        return [
            {"id": r[0], "user_id": r[1], "content": r[2]} for r in cursor.fetchall()
        ]


class MemoryManager:
    """Unified Memory Manager with L1/L2/L3 layers"""

    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.l1 = MemoryL1()
        self.l2 = MemoryL2(workspace / "memory_l2.db")
        self.l3 = MemoryL3(workspace / "memory_l3.db")

    async def get_context(
        self, session_id: str, user_id: str, llm_client
    ) -> list[dict]:
        context = self.l1.get_context()

        recent_episodes = self.l2.get_recent(session_id, limit=5)
        if recent_episodes:
            context.insert(
                0,
                {
                    "role": "system",
                    "content": f"Previous conversation summaries:\\n"
                    + "\\n".join(e["summary"] for e in recent_episodes),
                },
            )

        if self.l3.index.ntotal > 0 and llm_client:
            try:
                query_emb = await llm_client.get_embedding(
                    user_id + " " + " ".join(m["content"] for m in context[-3:])
                )
                memories = self.l3.search(user_id, query_emb, top_k=3)
                if memories:
                    context.insert(
                        0,
                        {
                            "role": "system",
                            "content": f"User preferences and past memories:\\n"
                            + "\\n".join(m["content"] for m in memories),
                        },
                    )
            except Exception as e:
                logger.warning(f"Failed to search L3 memory: {e}")

        return context

    def add_message(self, role: str, content: str):
        self.l1.add_message(role, content)

    async def save_to_l2(
        self, session_id: str, user_id: str, llm_client, summary_prompt: str
    ):
        if not llm_client:
            return

        messages = self.l1.get_context()
        if len(messages) < 4:
            return

        try:
            summary = await llm_client.chat(
                [
                    {
                        "role": "system",
                        "content": "Summarize this conversation briefly in 2-3 sentences.",
                    },
                    *messages[-10:],
                ]
            )
            if summary:
                self.l2.add_summary(session_id, user_id, summary)
                self.l1.clear()
        except Exception as e:
            logger.warning(f"Failed to save to L2: {e}")

    async def save_to_l3(self, user_id: str, content: str, llm_client):
        if not llm_client:
            return

        try:
            embedding = await llm_client.get_embedding(content)
            self.l3.add_memory(user_id, content, embedding)
        except Exception as e:
            logger.warning(f"Failed to save to L3: {e}")
