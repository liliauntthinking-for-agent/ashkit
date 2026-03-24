# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ashkit is a lightweight personal AI assistant platform with:
- Python backend (FastAPI, SQLite, FAISS vector search)
- React + TypeScript frontend (Vite, Tailwind CSS 4)
- Three-layer memory system (L1 working, L2 episodic, L3 semantic)
- MCP (Model Context Protocol) integration for external tools
- Feishu chatbot channel support

**For build/lint/test commands and code style guidelines, see AGENTS.md.**

## Core Architecture

### Agent-Provider Model
- `Agent` (agent.py) is the core AI assistant that processes messages with tools and memory
- `LLMClient` communicates with any OpenAI-compatible API (configured via providers)
- Agents are stored in SQLite database and loaded on-demand into runtime cache
- Each agent has its own workspace subdirectory for skills and memory
- Provider config includes: `apiKey`, `apiBase` (OpenAI-compatible endpoint), and `models` list

### Three-Layer Memory System
- **L1 (Working)**: In-memory conversation context (last 20 messages)
- **L2 (Episodic)**: SQLite-stored conversation summaries, auto-generated after 6 messages
- **L3 (Semantic)**: FAISS vector index for long-term knowledge, auto-extracted from conversations

Memory flow: L1 → summarize → L2 → extract facts → L3. Vector search retrieves relevant L3 memories for context.

### Tool System
Tools are registered globally via `register_tool()` in tools.py. The Agent builds a system prompt that includes all tool descriptions. LLM responds with tool calls, which are executed in a loop (max 10 rounds by default).

MCP tools are accessed via the `mcp` tool, which takes server/tool/arguments parameters.

### Streaming Protocol
When streaming responses, special markers are embedded for UI rendering:
- `__THINKING__<content>__THINKING_END__` - thinking/analysis phase
- `__TOOL_START__<json>__TOOL_END__` - tool invocation start
- `__TOOL_RESULT__<json>__TOOL_END__` - tool execution result

### Key File Locations
- Config: `~/.ashkit/config.json`
- Database: `~/.ashkit/workspace/ashkit.db`
- Agent workspaces: `~/.ashkit/workspace/<agent_id>/`
- Skills: `~/.ashkit/workspace/<agent_id>/skills/` or `~/.agents/skills/` (builtin)
- Frontend build: `src/ashkit/web/dist/` (served by FastAPI at root path)

## API Patterns

REST endpoints under `/api/`:
- Providers: CRUD at `/api/providers/{name}`
- Agents: CRUD at `/api/agents/{id}`, includes profile/user relation
- Sessions: `/api/sessions/{id}` with streaming messages via POST
- MCP: `/api/mcp/servers` and `/api/mcp/tools`

Streaming: POST to `/api/sessions/{id}/messages` with `stream: true` returns `text/event-stream`.

## Important Conventions

1. **Cascade deletes**: Always delete related data (sessions → messages) when deleting parent entities
2. **Runtime cache**: `agents_runtime` dict in web.py caches Agent instances; invalidate on update/delete
3. **Config merging**: User config deep-merges with defaults in Config class
4. **Error handling**: Log errors with context, return meaningful error messages to users
5. **Database schema evolution**: Schema migrations are handled inline in `Database._init_db()` via ALTER TABLE checks - add new columns with existence checks

## Agent Features

### Heartbeat System
Agents can have scheduled "heartbeats" that trigger periodic self-reflection based on memory content:
- Configured per-agent via `heartbeat` field (enabled, interval_minutes, prompt)
- Managed by `start_heartbeat_scheduler()` and `stop_heartbeat_scheduler()` in web.py
- Logs stored in `heartbeat_logs` table