import json
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import Config
from .database import Database

app = FastAPI(title="Ashkit Web API")

config = Config()
workspace = Path(
    config.get("agents.defaults.workspace", "~/.ashkit/workspace")
).expanduser()
workspace.mkdir(parents=True, exist_ok=True)

db = Database(workspace / "ashkit.db")

_dist_path = Path(__file__).parent / "web" / "dist"
_assets_path = _dist_path / "assets"
if _assets_path.exists():
    app.mount("/assets", StaticFiles(directory=str(_assets_path)), name="assets")


class AgentCreate(BaseModel):
    agent_id: str
    model: str
    provider: str


class ProviderCreate(BaseModel):
    name: str
    api_key: str = ""
    api_base: str = ""
    models: list[str] = []


class ProviderUpdate(BaseModel):
    api_key: str | None = None
    api_base: str | None = None
    models: list[str] | None = None


class SessionCreate(BaseModel):
    session_id: str
    agent_id: str


class MessageSend(BaseModel):
    content: str
    stream: bool = False


agents_runtime: dict[str, Any] = {}


async def get_agent_runtime(agent_id: str) -> Any:
    if agent_id not in agents_runtime:
        agent_info = db.get_agent(agent_id)
        if not agent_info:
            raise ValueError(f"Agent {agent_id} not found in database")
        
        from .agent import Agent

        agent_config = config.config.copy()
        agent_config["model"] = agent_info["model"]
        agent_config["provider"] = agent_info["provider"]

        agent = Agent(agent_id=agent_id, config=agent_config, workspace=workspace)
        agents_runtime[agent_id] = agent

    return agents_runtime[agent_id]


@app.get("/api/providers")
async def list_providers():
    providers = config.get("providers", {})
    result = []
    for name, cfg in providers.items():
        result.append({
            "name": name,
            "api_base": cfg.get("apiBase", ""),
            "has_key": bool(cfg.get("apiKey", "")),
            "models": cfg.get("models", [])
        })
    return result


@app.post("/api/providers")
async def create_provider(provider: ProviderCreate):
    providers = config.get("providers", {})
    if provider.name in providers:
        raise HTTPException(status_code=400, detail="Provider already exists")
    
    providers[provider.name] = {
        "apiKey": provider.api_key,
        "apiBase": provider.api_base,
        "models": provider.models
    }
    config.set("providers", providers)
    config.save()
    
    return {"name": provider.name, "status": "created"}


@app.get("/api/providers/{provider_name}")
async def get_provider(provider_name: str):
    providers = config.get("providers", {})
    if provider_name not in providers:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    cfg = providers[provider_name]
    return {
        "name": provider_name,
        "api_base": cfg.get("apiBase", ""),
        "has_key": bool(cfg.get("apiKey", "")),
        "models": cfg.get("models", [])
    }


@app.patch("/api/providers/{provider_name}")
async def update_provider(provider_name: str, update: ProviderUpdate):
    providers = config.get("providers", {})
    if provider_name not in providers:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    cfg = providers[provider_name]
    if update.api_key is not None:
        cfg["apiKey"] = update.api_key
    if update.api_base is not None:
        cfg["apiBase"] = update.api_base
    if update.models is not None:
        cfg["models"] = update.models
    
    providers[provider_name] = cfg
    config.set("providers", providers)
    config.save()
    
    return {"name": provider_name, "status": "updated"}


@app.delete("/api/providers/{provider_name}")
async def delete_provider(provider_name: str):
    providers = config.get("providers", {})
    if provider_name not in providers:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    del providers[provider_name]
    config.set("providers", providers)
    config.save()
    
    return {"status": "deleted"}


@app.get("/api/models")
async def list_all_models():
    providers = config.get("providers", {})
    result = []
    for provider_name, cfg in providers.items():
        models = cfg.get("models", [])
        for model in models:
            result.append({
                "provider": provider_name,
                "model": model
            })
    return result


@app.get("/api/providers/{provider_name}/models")
async def list_provider_models(provider_name: str):
    providers = config.get("providers", {})
    if provider_name not in providers:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    return providers[provider_name].get("models", [])


@app.post("/api/providers/{provider_name}/models")
async def add_provider_model(provider_name: str, model: str):
    providers = config.get("providers", {})
    if provider_name not in providers:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    models = providers[provider_name].get("models", [])
    if model in models:
        raise HTTPException(status_code=400, detail="Model already exists")
    
    models.append(model)
    providers[provider_name]["models"] = models
    config.set("providers", providers)
    config.save()
    
    return {"status": "added", "model": model}


@app.delete("/api/providers/{provider_name}/models/{model_name}")
async def delete_provider_model(provider_name: str, model_name: str):
    providers = config.get("providers", {})
    if provider_name not in providers:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    models = providers[provider_name].get("models", [])
    if model_name in models:
        models.remove(model_name)
        providers[provider_name]["models"] = models
        config.set("providers", providers)
        config.save()
    
    return {"status": "deleted"}


@app.get("/api/agents")
async def list_agents():
    agents = db.list_agents()
    return [{"agent_id": a["agent_id"], "status": a["status"]} for a in agents]


@app.post("/api/agents")
async def create_agent(agent: AgentCreate):
    if db.get_agent(agent.agent_id):
        raise HTTPException(status_code=400, detail="Agent already exists")

    providers = config.get("providers", {})
    if agent.provider not in providers:
        raise HTTPException(status_code=400, detail=f"Provider '{agent.provider}' not found")
    
    provider_models = providers[agent.provider].get("models", [])
    if agent.model not in provider_models:
        raise HTTPException(status_code=400, detail=f"Model '{agent.model}' not found in provider '{agent.provider}'")

    db.create_agent(agent.agent_id, agent.provider, agent.model)
    
    return {"agent_id": agent.agent_id, "status": "active"}


@app.get("/api/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = db.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "agent_id": agent["agent_id"],
        "provider": agent["provider"],
        "model": agent["model"],
        "status": agent["status"],
    }


@app.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: str):
    if not db.delete_agent(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent_id in agents_runtime:
        del agents_runtime[agent_id]
    
    return {"status": "deleted"}


@app.get("/api/sessions")
async def list_sessions(agent_id: str | None = None):
    sessions = db.list_sessions(agent_id)
    result = []
    for s in sessions:
        messages = db.get_messages(s["session_id"])
        result.append({
            "session_id": s["session_id"],
            "agent_id": s["agent_id"],
            "message_count": len(messages),
        })
    return result


@app.post("/api/sessions")
async def create_session(session: SessionCreate):
    if not db.get_agent(session.agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    
    db.create_session(session.session_id, session.agent_id)
    
    return {
        "session_id": session.session_id,
        "agent_id": session.agent_id,
        "status": "active",
    }


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    messages = db.get_messages(session_id)
    return {
        "session_id": session_id,
        "agent_id": session["agent_id"],
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
    }


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    db.clear_messages(session_id)
    return {"status": "deleted"}


async def generate_response(
    agent: Any, session_id: str, message: str
) -> AsyncGenerator[str, None]:
    try:
        db.add_message(session_id, "user", message)
        
        response = await agent.process_message(session_id, message)
        
        db.add_message(session_id, "assistant", response)

        for char in response:
            yield f"data: {json.dumps({'content': char})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


@app.post("/api/sessions/{session_id}/messages")
async def send_message(session_id: str, message: MessageSend):
    session = db.get_session(session_id)
    if not session:
        session = db.create_session(session_id, session_id)
    
    agent = await get_agent_runtime(session["agent_id"])

    if message.stream:
        return StreamingResponse(
            generate_response(agent, session_id, message.content),
            media_type="text/event-stream",
        )

    try:
        db.add_message(session_id, "user", message.content)
        
        response = await agent.process_message(session_id, message.content)
        
        db.add_message(session_id, "assistant", response)

        return {"status": "sent", "message": message.content, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/memory/{agent_id}")
async def get_memory(agent_id: str):
    if agent_id not in agents_runtime:
        raise HTTPException(status_code=404, detail="Agent not found or not initialized")

    agent = agents_runtime[agent_id]
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
    if agent_id not in agents_runtime:
        raise HTTPException(status_code=404, detail="Agent not found or not initialized")

    agent = agents_runtime[agent_id]
    if not hasattr(agent, "memory"):
        raise HTTPException(status_code=404, detail="Memory not initialized")

    await agent.memory.save_to_l3(agent_id, content, agent.llm)

    return {"status": "saved", "layer": "l3"}


@app.get("/")
async def root():
    dist_path = Path(__file__).parent / "web" / "dist"
    index_path = dist_path / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Ashkit API Server"}


@app.get("/{path:path}")
async def catch_all(path: str):
    dist_path = Path(__file__).parent / "web" / "dist"
    index_path = dist_path / "index.html"
    if index_path.exists() and not path.startswith("api"):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Not found")


def run_server(host: str = "127.0.0.1", port: int = 47291):
    import uvicorn

    uvicorn.run(app, host=host, port=port)