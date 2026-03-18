import json
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import Config

app = FastAPI(title="Ashkit Web API")

config = Config()
workspace = Path(
    config.get("agents.defaults.workspace", "~/.ashkit/workspace")
).expanduser()
workspace.mkdir(parents=True, exist_ok=True)


class AgentCreate(BaseModel):
    agent_id: str
    model: str | None = None
    provider: str | None = None


class AgentUpdate(BaseModel):
    model: str | None = None
    provider: str | None = None


class SessionCreate(BaseModel):
    session_id: str
    agent_id: str


class MessageSend(BaseModel):
    content: str
    stream: bool = False


agents_store: dict[str, Any] = {}


async def get_or_create_agent(agent_id: str) -> Any:
    if agent_id not in agents_store:
        from .agent import Agent

        agent_config = config.config.copy()
        if "agents" not in agent_config:
            agent_config["agents"] = {}
        if "defaults" not in agent_config["agents"]:
            agent_config["agents"]["defaults"] = {}

        model = config.get(f"agents.{agent_id}.model", None) or config.get(
            "agents.defaults.model", ""
        )
        provider = config.get(f"agents.{agent_id}.provider", None) or config.get(
            "agents.defaults.provider", "custom"
        )

        if model:
            agent_config["agents"]["defaults"]["model"] = model
        if provider:
            agent_config["agents"]["defaults"]["provider"] = provider

        agent = Agent(agent_id=agent_id, config=agent_config, workspace=workspace)
        agents_store[agent_id] = agent

    return agents_store[agent_id]


@app.get("/api/agents")
async def list_agents():
    return [
        {
            "agent_id": agent_id,
            "status": "active" if hasattr(agent, "_initialized") else "inactive",
        }
        for agent_id, agent in agents_store.items()
    ]


@app.post("/api/agents")
async def create_agent(agent: AgentCreate):
    if agent.agent_id in agents_store:
        raise HTTPException(status_code=400, detail="Agent already exists")

    agent_obj = await get_or_create_agent(agent.agent_id)

    return {"agent_id": agent.agent_id, "status": "active"}


@app.get("/api/agents/{agent_id}")
async def get_agent(agent_id: str):
    if agent_id not in agents_store:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"agent_id": agent_id, "status": "active"}


@app.patch("/api/agents/{agent_id}")
async def update_agent(agent_id: str, update: AgentUpdate):
    if agent_id not in agents_store:
        raise HTTPException(status_code=404, detail="Agent not found")

    if update.model:
        config.set(f"agents.{agent_id}.model", update.model)
    if update.provider:
        config.set(f"agents.{agent_id}.provider", update.provider)

    return {"agent_id": agent_id, "status": "active"}


@app.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: str):
    if agent_id not in agents_store:
        raise HTTPException(status_code=404, detail="Agent not found")

    del agents_store[agent_id]
    return {"status": "deleted"}


@app.get("/api/sessions")
async def list_sessions(agent_id: str | None = None):
    sessions = []
    for agent_id_key, agent in agents_store.items():
        if agent_id and agent_id_key != agent_id:
            continue
        if hasattr(agent, "memory"):
            session_data = {
                "session_id": agent.agent_id,
                "agent_id": agent_id_key,
                "message_count": len(agent.memory.l1.messages),
            }
            sessions.append(session_data)
    return sessions


@app.post("/api/sessions")
async def create_session(session: SessionCreate):
    agent = await get_or_create_agent(session.agent_id)

    return {
        "session_id": session.session_id,
        "agent_id": session.agent_id,
        "status": "active",
    }


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    parts = session_id.rsplit("_", 1)
    agent_id = parts[0] if parts else session_id

    if agent_id not in agents_store:
        raise HTTPException(status_code=404, detail="Session not found")

    agent = agents_store[agent_id]
    if hasattr(agent, "memory"):
        return {
            "session_id": session_id,
            "agent_id": agent_id,
            "messages": agent.memory.l1.get_context(),
        }

    return {"session_id": session_id, "agent_id": agent_id, "messages": []}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    parts = session_id.rsplit("_", 1)
    agent_id = parts[0] if parts else session_id

    if agent_id in agents_store:
        agent = agents_store[agent_id]
        if hasattr(agent, "memory"):
            agent.memory.l1.clear()

    return {"status": "deleted"}


async def generate_response(
    agent: Any, user_id: str, message: str
) -> AsyncGenerator[str, None]:
    try:
        response = await agent.process_message(user_id, message)

        for char in response:
            yield f"data: {json.dumps({'content': char})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


@app.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, message: MessageSend):
    parts = session_id.rsplit("_", 1)
    agent_id = parts[0] if parts else session_id

    if agent_id not in agents_store:
        agent = await get_or_create_agent(agent_id)
    else:
        agent = agents_store[agent_id]

    if message.stream:
        return StreamingResponse(
            generate_response(agent, agent_id, message.content),
            media_type="text/event-stream",
        )

    try:
        response = await agent.process_message(agent_id, message.content)

        return {"status": "sent", "message": message.content, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/memory/{agent_id}")
async def get_memory(agent_id: str):
    if agent_id not in agents_store:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agents_store[agent_id]
    if not hasattr(agent, "memory"):
        raise HTTPException(status_code=404, detail="Memory not initialized")

    memory = agent.memory

    return {
        "l1_working": {
            "message_count": len(memory.l1.messages),
            "messages": memory.l1.get_context(),
        },
        "l2_episodic": memory.l2.get_recent(agent_id, limit=10),
        "l3_semantic": memory.l3.get_all(agent_id)
        if hasattr(memory.l3, "get_all")
        else [],
    }


@app.post("/api/memory/{agent_id}/l3")
async def add_semantic_memory(agent_id: str, content: str):
    if agent_id not in agents_store:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agents_store[agent_id]
    if not hasattr(agent, "memory"):
        raise HTTPException(status_code=404, detail="Memory not initialized")

    await agent.memory.save_to_l3(agent_id, content, agent.llm)

    return {"status": "saved", "layer": "l3"}


@app.get("/")
async def root():
    from fastapi.responses import FileResponse

    return FileResponse(Path(__file__).parent / "web" / "index.html")


def run_server(host: str = "127.0.0.1", port: int = 8080):
    import uvicorn

    uvicorn.run(app, host=host, port=port)
