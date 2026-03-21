# AGENTS.md

Guidelines for agentic coding agents working in this repository.

## Project Overview

Ashkit is a lightweight personal AI assistant with:
- Python backend (FastAPI, SQLite, FAISS)
- React + TypeScript frontend (Vite, Tailwind CSS 4)
- Three-layer memory system (L1/L2/L3)
- Skill and tool extensibility

## Build/Lint/Test Commands

### Python Backend

```bash
# Install dependencies
uv sync

# Run web server
uv run python -m ashkit web

# Run gateway (Feishu)
uv run python -m ashkit gateway

# Run CLI agent
uv run python -m ashkit agent

# Lint with ruff
uv run ruff check src/

# Format with ruff
uv run ruff format src/

# Run all tests
uv run pytest

# Run single test file
uv run pytest tests/test_specific.py

# Run single test function
uv run pytest tests/test_specific.py::test_function_name -v
```

### Frontend (web/)

```bash
cd web

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Type check (via build)
npm run build
```

## Code Style Guidelines

### Python

**Imports:**
- Standard library first, then third-party, then local imports
- Use explicit imports, avoid `from module import *`

```python
import json
import logging
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException

from .config import Config
```

**Type Hints:**
- Use type hints for all function parameters and return types
- Use `list[dict]`, `dict[str, Any]` (lowercase generics for Python 3.10+)
- Use `| None` instead of `Optional[]`

```python
def get_session(self, session_id: str) -> dict | None:
def list_sessions(self, agent_id: str | None = None) -> list[dict]:
```

**Naming:**
- snake_case for functions, variables, methods
- PascalCase for classes
- Private methods: `_method_name`
- Constants: `UPPER_SNAKE_CASE`

**Error Handling:**
- Use `logger = logging.getLogger(__name__)` at module level
- Log errors with context, return meaningful error messages

```python
logger = logging.getLogger(__name__)

try:
    result = await some_operation()
except Exception as e:
    logger.error(f"Operation failed: {e}")
    return {"error": str(e)}
```

**Database:**
- Use context managers for connections
- Always commit and close connections

```python
def get_session(self, session_id: str) -> dict | None:
    conn = self._get_conn()
    row = conn.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None
```

**FastAPI:**
- Use Pydantic models for request/response bodies
- Return dicts for simple responses
- Use `HTTPException` for errors

```python
class AgentCreate(BaseModel):
    agent_id: str
    model: str
    provider: str

@app.post("/api/agents")
async def create_agent(data: AgentCreate):
    # ...
    return {"status": "created"}
```

### TypeScript/React

**Imports:**
- Use `import type` for type-only imports
- Group: external first, then internal

```typescript
import { useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { useToast } from './Toast';
```

**Components:**
- Functional components with arrow functions or function declarations
- Use type annotations for props

```typescript
interface Session {
  session_id: string;
  agent_id: string;
  message_count: number;
}

export function Chat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  // ...
}
```

**Naming:**
- PascalCase for components and types
- camelCase for variables, functions, props
- Use descriptive names, avoid abbreviations

**Error Handling:**
- Use try/catch with meaningful error messages
- Show user-friendly toast notifications

```typescript
try {
  await api.createSession(agentId);
  showToast('Session created');
} catch (e: any) {
  showToast('Failed: ' + e.message, 'error');
}
```

**Styling:**
- Use Tailwind CSS classes with CSS variables for theming
- CSS variables: `--color-accent`, `--color-surface`, `--color-border`, `--color-accent-muted`

```typescript
className="bg-[var(--color-accent)] text-white rounded-xl"
```

**Async Operations:**
- Use async/await, not .then() chains
- Handle loading states explicitly

```typescript
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  try {
    await api.sendData(data);
  } finally {
    setLoading(false);
  }
};
```

## Project Structure

```
src/ashkit/
├── __init__.py       # Package entry, main()
├── __main__.py       # CLI handler
├── agent.py          # Agent class, LLMClient
├── config.py         # Configuration management
├── database.py       # SQLite operations
├── gateway.py        # Multi-agent gateway
├── memory.py         # L1/L2/L3 memory system
├── skills.py         # Skill loader
├── tools.py          # Tool implementations
├── web.py            # FastAPI web server
└── channels/
    └── feishu.py     # Feishu integration

web/src/
├── api/
│   └── client.ts     # API client functions
├── components/
│   ├── Chat.tsx
│   ├── Agents.tsx
│   ├── Providers.tsx
│   └── ...
├── App.tsx           # Main application
└── main.tsx          # Entry point
```

## API Conventions

- RESTful endpoints under `/api/`
- DELETE endpoints should remove the resource entirely (not just clear data)
- Return `{"status": "deleted"}` or `{"status": "updated"}` for mutations
- Use nested routes for relationships: `/api/providers/{name}/models`

## Configuration

Config file: `~/.ashkit/config.json`
Workspace: `~/.ashkit/workspace/`
Database: `~/.ashkit/workspace/ashkit.db`

## Notes

- Always delete related data when deleting parent entities (cascade delete)
- Use parameterized queries for SQL (prevent injection)
- Close database connections after use
- Use streaming for long LLM responses