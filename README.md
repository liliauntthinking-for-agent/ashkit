# Ashkit

Lightweight personal AI assistant with Feishu, Memory, MCP and Skills.

## Features

- **Multi-channel Support**: Feishu bot integration
- **Three-layer Memory System**: L1 working memory, L2 episodic memory, L3 semantic memory with FAISS
- **Skills System**: Dynamic skill loading from workspace
- **Tools**: Bash, Read, Write, Edit, MCP tools
- **Web API**: RESTful API with Web UI

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd ashkit

# Install dependencies with uv
uv sync
```

## Configuration

Create a config file at `~/.ashkit/config.json` or use the example:

```bash
cp config.example.json ~/.ashkit/config.json
```

Edit the configuration:

```json
{
  "providers": {
    "custom": {
      "apiKey": "your-api-key-here",
      "apiBase": "https://api.openai.com/v1"
    }
  },
  "agents": {
    "defaults": {
      "model": "gpt-4o",
      "provider": "custom",
      "workspace": "~/.ashkit/workspace"
    }
  },
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789
  }
}
```

## Usage

### Web Server

Start the web server with Web UI:

```bash
uv run python -m ashkit web
```

Access the Web UI at http://localhost:8080

### Gateway Mode

Connect to Feishu:

```bash
uv run python -m ashkit gateway
```

### CLI Agent

Interactive command-line agent:

```bash
uv run python -m ashkit agent
```

### Custom Config Path

```bash
uv run python -m ashkit web --config /path/to/config.json
uv run python -m ashkit gateway --workspace ~/.ashkit/workspace
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create an agent |
| GET | `/api/agents/{id}` | Get agent info |
| PATCH | `/api/agents/{id}` | Update agent |
| DELETE | `/api/agents/{id}` | Delete agent |
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions/{id}/messages` | Send message |
| GET | `/api/memory/{id}` | Get agent memory |
| POST | `/api/memory/{id}/l3` | Add semantic memory |

## Memory System

### L1 - Working Memory
- Current conversation context
- In-memory storage
- Configurable token limit (default: 64000)

### L2 - Episodic Memory
- Historical conversation summaries
- SQLite storage
- Automatic summarization

### L3 - Semantic Memory
- Long-term knowledge storage
- FAISS vector index
- Automatic embedding

## Skills

Place skill directories in `~/.ashkit/workspace/skills/` with a `SKILL.md` file:

```
skills/
├── example-skill/
│   └── SKILL.md
└── another-skill/
    └── SKILL.md
```

## Project Structure

```
ashkit/
├── src/ashkit/
│   ├── __init__.py      # Entry point
│   ├── __main__.py      # CLI handler
│   ├── agent.py         # Core agent + LLM client
│   ├── config.py        # Configuration management
│   ├── gateway.py       # Multi-agent gateway
│   ├── memory.py        # L1/L2/L3 memory system
│   ├── skills.py        # Skill loader
│   ├── tools.py         # Tool implementations
│   ├── web.py           # FastAPI web server
│   └── channels/
│       └── feishu.py    # Feishu channel
├── config.example.json  # Example configuration
└── pyproject.toml       # Project metadata
```

## License

MIT