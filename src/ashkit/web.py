import json
import random
import tiktoken
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import Config
from .database import Database

# Token counter for cl100k_base (GPT-4/ChatGPT encoding)
_tokenizer = tiktoken.get_encoding("cl100k_base")

def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken."""
    return len(_tokenizer.encode(text))

def count_messages_tokens(messages: list[dict]) -> int:
    """Count total tokens in a list of messages."""
    total = 0
    for msg in messages:
        # Each message has role and content overhead (~4 tokens)
        total += 4
        total += count_tokens(msg.get("role", ""))
        total += count_tokens(msg.get("content", ""))
    return total

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


@app.on_event("startup")
async def startup_event():
    """Initialize heartbeat schedulers for existing agents."""
    import logging
    logger = logging.getLogger(__name__)

    agents = db.list_agents()
    for agent in agents:
        heartbeat_config = agent.get("heartbeat") or {}
        if heartbeat_config.get("enabled", False):
            # Import here to avoid circular dependency
            start_heartbeat_scheduler(agent["agent_id"], heartbeat_config)
            logger.info(f"Started heartbeat for existing agent {agent['agent_id']}")


class AgentProfile(BaseModel):
    name: str = ""
    nickname: str = ""
    avatar: str = ""
    gender: str = ""
    birthday: str = ""
    height: int | None = None
    weight: int | None = None
    blood_type: str = ""
    email: str = ""
    address: str = ""
    school: str = ""
    education: str = ""
    nationality: str = ""
    personality: str = ""
    hobbies: str = ""
    skills: str = ""
    mbti: str = ""
    background: str = ""


class UserProfile(BaseModel):
    name: str = ""
    nickname: str = ""
    avatar: str = ""
    gender: str = ""
    birthday: str = ""
    height: int | None = None
    weight: int | None = None
    blood_type: str = ""
    email: str = ""
    address: str = ""
    school: str = ""
    education: str = ""
    occupation: str = ""
    nationality: str = ""
    personality: str = ""
    hobbies: str = ""
    skills: str = ""
    mbti: str = ""
    background: str = ""


class AgentCreate(BaseModel):
    agent_id: str
    model: str
    provider: str
    profile: AgentProfile | None = None
    user_id: str | None = None
    relation: str | None = None


class AgentUpdate(BaseModel):
    profile: AgentProfile | None = None
    user_id: str | None = None
    relation: str | None = None
    mcp_servers: list[str] | None = None


class UserCreate(BaseModel):
    user_id: str
    profile: UserProfile | None = None


class UserUpdate(BaseModel):
    profile: UserProfile | None = None


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


class SkillInvoke(BaseModel):
    prompt: str
    agent_id: str


class SessionUpdate(BaseModel):
    name: str


class SettingsUpdate(BaseModel):
    tools_max_calls: int = 10
    tools_enabled: bool = True


class HeartbeatConfig(BaseModel):
    enabled: bool = False
    interval_minutes: int = 30
    prompt: str = "看了一下之前的对话，想想有没有什么想跟对方说的，或者有什么想做的事。"


agents_runtime: dict[str, Any] = {}
heartbeat_tasks: dict[str, Any] = {}


async def get_agent_runtime(agent_id: str) -> Any:
    if agent_id not in agents_runtime:
        agent_info = db.get_agent(agent_id)
        if not agent_info:
            raise ValueError(f"Agent {agent_id} not found in database")
        
        from .agent import Agent

        agent_config = config.config.copy()
        agent_config["model"] = agent_info["model"]
        agent_config["provider"] = agent_info["provider"]
        agent_config["profile"] = agent_info.get("profile")
        agent_config["user_id"] = agent_info.get("user_id")
        agent_config["relation"] = agent_info.get("relation")
        agent_config["mcp_servers"] = agent_info.get("mcp_servers")
        
        if agent_info.get("user_id"):
            user_info = db.get_user(agent_info["user_id"])
            agent_config["user_profile"] = user_info.get("profile") if user_info else None
        else:
            agent_config["user_profile"] = None

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
    return [{
        "agent_id": a["agent_id"],
        "status": a["status"],
        "profile": a.get("profile"),
        "user_id": a.get("user_id"),
        "relation": a.get("relation"),
        "mcp_servers": a.get("mcp_servers"),
    } for a in agents]


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

    profile_dict = agent.profile.model_dump() if agent.profile else None
    db.create_agent(agent.agent_id, agent.provider, agent.model, profile_dict, agent.user_id, agent.relation)
    
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
        "profile": agent.get("profile"),
        "user_id": agent.get("user_id"),
        "relation": agent.get("relation"),
        "mcp_servers": agent.get("mcp_servers"),
    }


@app.delete("/api/agents/{agent_id}")
async def delete_agent(agent_id: str):
    # Stop heartbeat scheduler
    stop_heartbeat_scheduler(agent_id)

    # Delete heartbeat logs
    db.delete_heartbeat_logs(agent_id)

    if not db.delete_agent(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent_id in agents_runtime:
        del agents_runtime[agent_id]

    return {"status": "deleted"}


@app.patch("/api/agents/{agent_id}")
async def update_agent(agent_id: str, update: AgentUpdate):
    if not db.get_agent(agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    
    profile_dict = update.profile.model_dump() if update.profile else None
    db.update_agent(agent_id, profile_dict, update.user_id, update.relation, update.mcp_servers)
    
    if agent_id in agents_runtime:
        del agents_runtime[agent_id]
    
    return {"status": "updated"}


@app.get("/api/users")
async def list_users():
    users = db.list_users()
    return [{
        "user_id": u["user_id"],
        "profile": u.get("profile"),
    } for u in users]


@app.post("/api/users")
async def create_user(user: UserCreate):
    if db.get_user(user.user_id):
        raise HTTPException(status_code=400, detail="User already exists")
    
    profile_dict = user.profile.model_dump() if user.profile else None
    db.create_user(user.user_id, profile_dict)
    
    return {"user_id": user.user_id, "status": "created"}


@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user["user_id"],
        "profile": user.get("profile"),
    }


@app.patch("/api/users/{user_id}")
async def update_user(user_id: str, update: UserUpdate):
    if not db.get_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    
    profile_dict = update.profile.model_dump() if update.profile else None
    db.update_user(user_id, profile_dict)
    
    return {"status": "updated"}


@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str):
    if not db.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted"}


avatars_dir = workspace / "avatars"
avatars_dir.mkdir(parents=True, exist_ok=True)


@app.post("/api/avatars/{avatar_type}/{entity_id}")
async def upload_avatar(avatar_type: str, entity_id: str, file: UploadFile = File(...)):
    if avatar_type not in ("agent", "user"):
        raise HTTPException(status_code=400, detail="Invalid avatar type")
    
    if avatar_type == "agent":
        if not db.get_agent(entity_id):
            raise HTTPException(status_code=404, detail="Agent not found")
    else:
        if not db.get_user(entity_id):
            raise HTTPException(status_code=404, detail="User not found")
    
    content = await file.read()
    
    avatar_path = avatars_dir / f"{avatar_type}_{entity_id}"
    avatar_path.write_bytes(content)
    
    avatar_url = f"/api/avatars/{avatar_type}/{entity_id}"
    
    if avatar_type == "agent":
        agent = db.get_agent(entity_id)
        profile = agent.get("profile", {}) or {}
        profile["avatar"] = avatar_url
        db.update_agent(entity_id, profile)
    else:
        user = db.get_user(entity_id)
        profile = user.get("profile", {}) or {}
        profile["avatar"] = avatar_url
        db.update_user(entity_id, profile)
    
    return {"avatar": avatar_url}


@app.get("/api/avatars/{avatar_type}/{entity_id}")
async def get_avatar(avatar_type: str, entity_id: str):
    if avatar_type not in ("agent", "user"):
        raise HTTPException(status_code=400, detail="Invalid avatar type")
    
    avatar_path = avatars_dir / f"{avatar_type}_{entity_id}"
    
    if not avatar_path.exists():
        raise HTTPException(status_code=404, detail="Avatar not found")
    
    content = avatar_path.read_bytes()
    
    content_type = "image/png"
    if avatar_path.suffix.lower() in (".jpg", ".jpeg"):
        content_type = "image/jpeg"
    elif avatar_path.suffix.lower() == ".gif":
        content_type = "image/gif"
    elif avatar_path.suffix.lower() == ".webp":
        content_type = "image/webp"
    
    return Response(content=content, media_type=content_type)


@app.delete("/api/avatars/{avatar_type}/{entity_id}")
async def delete_avatar(avatar_type: str, entity_id: str):
    if avatar_type not in ("agent", "user"):
        raise HTTPException(status_code=400, detail="Invalid avatar type")
    
    avatar_path = avatars_dir / f"{avatar_type}_{entity_id}"
    
    if avatar_path.exists():
        avatar_path.unlink()
    
    if avatar_type == "agent":
        agent = db.get_agent(entity_id)
        if agent:
            profile = agent.get("profile", {}) or {}
            profile["avatar"] = ""
            db.update_agent(entity_id, profile)
    else:
        user = db.get_user(entity_id)
        if user:
            profile = user.get("profile", {}) or {}
            profile["avatar"] = ""
            db.update_user(entity_id, profile)
    
    return {"status": "deleted"}


@app.get("/api/skills")
async def list_skills(agent_id: str | None = None):
    def load_skills_from_dir(skills_dir: Path, builtin: bool = False) -> list[dict]:
        if not skills_dir.exists():
            return []
        
        skills = []
        for skill_path in skills_dir.iterdir():
            if skill_path.is_dir():
                skill_md = skill_path / "SKILL.md"
                if skill_md.exists():
                    try:
                        content = skill_md.read_text(encoding="utf-8")
                        
                        name = skill_path.name
                        description = ""
                        
                        if content.startswith("---"):
                            parts = content.split("---", 2)
                            if len(parts) >= 3:
                                frontmatter = parts[1]
                                for line in frontmatter.strip().split("\n"):
                                    if line.startswith("name:"):
                                        name = line[5:].strip()
                                    elif line.startswith("description:"):
                                        description = line[12:].strip()
                        
                        skills.append({
                            "skill_id": skill_path.name,
                            "name": name,
                            "description": description,
                            "path": str(skill_path),
                            "builtin": builtin,
                        })
                    except Exception:
                        pass
        return skills
    
    builtin_skills_dir = Path.home() / ".agents" / "skills"
    
    skills = load_skills_from_dir(builtin_skills_dir, builtin=True)
    
    if agent_id:
        agent_skills_dir = workspace / agent_id / "skills"
        skills.extend(load_skills_from_dir(agent_skills_dir, builtin=False))
    else:
        for agent_dir in workspace.iterdir():
            if agent_dir.is_dir() and (agent_dir / "skills").exists():
                skills.extend(load_skills_from_dir(agent_dir / "skills", builtin=False))
    
    return skills


@app.get("/api/skills/{skill_id}")
async def get_skill(skill_id: str, agent_id: str | None = None):
    builtin_skills_dir = Path.home() / ".agents" / "skills"
    
    skill_md = None
    builtin = False
    
    if agent_id:
        agent_skill_md = workspace / agent_id / "skills" / skill_id / "SKILL.md"
        if agent_skill_md.exists():
            skill_md = agent_skill_md
            builtin = False
    
    if not skill_md:
        builtin_skill_md = builtin_skills_dir / skill_id / "SKILL.md"
        if builtin_skill_md.exists():
            skill_md = builtin_skill_md
            builtin = True
    
    if not skill_md:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    content = skill_md.read_text(encoding="utf-8")
    
    name = skill_id
    description = ""
    
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            for line in frontmatter.strip().split("\n"):
                if line.startswith("name:"):
                    name = line[5:].strip()
                elif line.startswith("description:"):
                    description = line[12:].strip()
    
    return {
        "skill_id": skill_id,
        "name": name,
        "description": description,
        "content": content,
        "builtin": builtin,
    }


@app.delete("/api/skills/{skill_id}")
async def delete_skill(skill_id: str, agent_id: str | None = None):
    import shutil
    
    builtin_skills_dir = Path.home() / ".agents" / "skills"
    builtin_skill_path = builtin_skills_dir / skill_id
    if builtin_skill_path.exists():
        raise HTTPException(status_code=403, detail="Cannot delete builtin skill")
    
    if not agent_id:
        raise HTTPException(status_code=400, detail="agent_id is required")
    
    skill_path = workspace / agent_id / "skills" / skill_id
    if not skill_path.exists():
        raise HTTPException(status_code=404, detail="Skill not found")
    
    shutil.rmtree(skill_path)
    return {"status": "deleted"}


@app.post("/api/skills/{skill_id}/invoke")
async def invoke_skill(skill_id: str, data: SkillInvoke):
    agent_id = data.agent_id
    prompt = data.prompt
    if not agent_id:
        raise HTTPException(status_code=400, detail="agent_id is required")
    
    builtin_skills_dir = Path.home() / ".agents" / "skills"
    agent_skill_path = workspace / agent_id / "skills" / skill_id
    
    skill_md = None
    skill_name = skill_id
    
    if agent_skill_path and (agent_skill_path / "SKILL.md").exists():
        skill_md = agent_skill_path / "SKILL.md"
    elif (builtin_skills_dir / skill_id / "SKILL.md").exists():
        skill_md = builtin_skills_dir / skill_id / "SKILL.md"
    
    if not skill_md:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    import uuid
    session_id = str(uuid.uuid4())[:8]
    db.create_session(session_id, agent_id, name=f"技能: {skill_name}")
    
    skill_content = skill_md.read_text(encoding="utf-8")
    db.add_message(session_id, "user", f"使用{skill_name}，{prompt}")
    
    agent_runtime = await get_agent_runtime(agent_id)
    
    class TempSkill:
        def __init__(self, content, name):
            self.content = content
            self.name = name
            self.description = ""
        def to_prompt(self):
            return self.content
    
    temp_skill = TempSkill(skill_content, skill_name)
    agent_runtime.skills = [temp_skill]
    
    try:
        result = await agent_runtime.process_message("skill_user", prompt)
        db.add_message(session_id, "assistant", result)
    except Exception as e:
        db.add_message(session_id, "assistant", f"执行失败: {str(e)}")
        result = f"执行失败: {str(e)}"
    
    return {"session_id": session_id, "result": result}


@app.get("/api/sessions")
async def list_sessions(agent_id: str | None = None):
    sessions = db.list_sessions(agent_id)
    result = []
    for s in sessions:
        count = db.get_message_count(s["session_id"])
        result.append({
            "session_id": s["session_id"],
            "agent_id": s["agent_id"],
            "name": s.get("name"),
            "message_count": count,
        })
    return result


@app.post("/api/sessions")
async def create_session(session: SessionCreate):
    if not db.get_agent(session.agent_id):
        raise HTTPException(status_code=404, detail="Agent not found")
    
    import uuid
    session_id = f"{session.agent_id}-{uuid.uuid4().hex[:8]}"
    
    db.create_session(session_id, session.agent_id)
    
    return {
        "session_id": session_id,
        "agent_id": session.agent_id,
        "status": "active",
    }


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, limit: int = 20, before_id: int | None = None):
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if before_id:
        messages = db.get_messages_before(session_id, before_id, limit)
    else:
        messages = db.get_latest_messages(session_id, limit)
    
    total_count = db.get_message_count(session_id)
    first_id = messages[0]["id"] if messages else None
    
    return {
        "session_id": session_id,
        "agent_id": session["agent_id"],
        "name": session.get("name"),
        "messages": [{"id": m["id"], "role": m["role"], "content": m["content"], "metadata": m.get("metadata")} for m in messages],
        "total_count": total_count,
        "has_more": first_id is not None and first_id > 1,
        "first_id": first_id,
    }


@app.get("/api/sessions/{session_id}/tokens")
async def get_session_tokens(session_id: str):
    """Get the input token count for the session (context that will be sent to LLM)."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    compressed_context = db.get_compressed_context(session_id)
    compressed_tokens = 0
    if compressed_context:
        compressed_tokens = count_tokens(compressed_context)

    messages = db.get_messages(session_id, limit=1000)
    message_tokens = count_messages_tokens([{"role": m["role"], "content": m["content"]} for m in messages])

    total_tokens = message_tokens + compressed_tokens + 2000

    return {
        "session_id": session_id,
        "system_tokens": 2000,
        "message_tokens": message_tokens,
        "l2_tokens": 0,
        "compressed_tokens": compressed_tokens,
        "total_tokens": total_tokens,
        "is_compressed": bool(compressed_context),
    }


@app.post("/api/sessions/{session_id}/compress")
async def compress_session(session_id: str):
    """Compress session messages into a summary, reducing token count."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all messages
    messages = db.get_messages(session_id, limit=1000)
    if not messages:
        return {"status": "no_messages", "compressed_tokens": 0}

    # Get agent for LLM
    agent = await get_agent_runtime(session["agent_id"])

    # Build conversation text for compression
    conversation_text = "\n".join([
        f"{m['role']}: {m['content']}"
        for m in messages
    ])

    # Use LLM to compress the conversation
    compress_prompt = f"""请将以下对话压缩成一个简洁的摘要，保留关键信息、决策、用户偏好和重要细节。
摘要应该足够详细，以便 AI 助手可以继续对话而不丢失上下文。
格式要求：
1. 用简洁的中文描述
2. 保留重要的具体信息（如日期、地点、名称、数值等）
3. 保留用户的偏好和决定
4. 按时间顺序组织

对话内容：
{conversation_text}

请生成压缩摘要："""

    try:
        compressed = await agent.llm.chat([
            {"role": "system", "content": "你是一个对话压缩助手，擅长将长对话压缩成简洁但信息完整的摘要。"},
            {"role": "user", "content": compress_prompt}
        ])

        # Save compressed context
        db.set_compressed_context(session_id, compressed)
        # Clear original messages
        db.clear_messages(session_id)

        # Count tokens of compressed context
        compressed_tokens = count_tokens(compressed)

        return {
            "status": "compressed",
            "compressed_tokens": compressed_tokens,
            "original_message_count": len(messages),
            "compressed_context": compressed,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compression failed: {str(e)}")


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    db.delete_session(session_id)
    return {"status": "deleted"}


@app.delete("/api/sessions/{session_id}/messages")
async def clear_session_messages(session_id: str):
    """Clear all messages in a session, keeping the session itself."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.clear_messages(session_id)
    # Also update the session name to indicate it's a fresh start
    db.update_session_name(session_id, "新对话")
    return {"status": "cleared", "session_id": session_id}


@app.patch("/api/sessions/{session_id}")
async def update_session(session_id: str, update: SessionUpdate):
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db.update_session_name(session_id, update.name)
    return {"status": "updated", "name": update.name}


async def generate_response(
    agent: Any, session_id: str, message: str
) -> AsyncGenerator[str, None]:
    try:
        messages = db.get_messages(session_id)
        is_first_message = len(messages) == 0

        db.add_message(session_id, "user", message)

        if is_first_message:
            name = message[:50] + ("..." if len(message) > 50 else "")
            db.update_session_name(session_id, name)
        
        full_response = ""
        timeline: list[dict] = []
        current_tool: dict | None = None

        async for chunk in agent.process_message_stream(session_id, message):
            # Send chunk to frontend first
            yield f"data: {json.dumps({'content': chunk})}\n\n"
            
            # Parse special markers for timeline (to save to DB)
            if "__THINKING__" in chunk:
                import re
                match = re.search(r"__THINKING__(.+?)__THINKING_END__", chunk)
                if match:
                    timeline.append({"type": "thinking", "content": match.group(1)})
            elif "__TOOL_START__" in chunk:
                import re
                match = re.search(r"__TOOL_START__(.+?)__TOOL_END__", chunk)
                if match:
                    tools = json.loads(match.group(1))
                    for t in tools:
                        current_tool = {"type": "tool", "name": t["name"], "args": t.get("args", "{}")}
            elif "__TOOL_RESULT__" in chunk:
                import re
                match = re.search(r"__TOOL_RESULT__(.+?)__TOOL_END__", chunk)
                if match and current_tool:
                    result_data = json.loads(match.group(1))
                    current_tool["result"] = result_data.get("result", "")
                    current_tool["args"] = json.dumps(result_data.get("args", {}), ensure_ascii=False)
                    timeline.append(current_tool)
                    current_tool = None
            
            # Also append to full_response (excluding markers for clean text)
            if "__THINKING__" not in chunk and "__TOOL_START__" not in chunk and "__TOOL_RESULT__" not in chunk:
                full_response += chunk

        # Save message with timeline metadata
        metadata = {"timeline": timeline} if timeline else None
        db.add_message(session_id, "assistant", full_response, metadata)
        logging.info(f"Saved assistant message for {session_id}, length: {len(full_response)}")
        
        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        import traceback
        logging.error(f"Error in generate_response: {e}\n{traceback.format_exc()}")
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
        messages = db.get_messages(session_id)
        is_first_message = len(messages) == 0

        db.add_message(session_id, "user", message.content)

        if is_first_message:
            name = message.content[:50] + ("..." if len(message.content) > 50 else "")
            db.update_session_name(session_id, name)

        response = await agent.process_message(session_id)
        
        db.add_message(session_id, "assistant", response)

        return {"status": "sent", "message": message.content, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/memory/{agent_id}")
async def get_memory(agent_id: str):
    try:
        agent = await get_agent_runtime(agent_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Agent not found")

    await agent.initialize()

    memory = agent.memory

    return {
        "l1_working": {
            "message_count": len(memory.l1.messages),
            "messages": memory.l1.get_context(),
        },
        "l2_episodic": memory.l2.get_by_user(agent_id, limit=10),
        "l3_semantic": memory.l3.get_all(agent_id)
        if hasattr(memory.l3, "get_all")
        else [],
    }


@app.post("/api/memory/{agent_id}/l3")
async def add_semantic_memory(agent_id: str, content: str):
    try:
        agent = await get_agent_runtime(agent_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Agent not found")

    await agent.initialize()
    await agent.memory.save_to_l3(agent_id, content, agent.llm)

    return {"status": "saved", "layer": "l3"}


@app.get("/api/settings")
async def get_settings():
    return {
        "tools_max_calls": config.get("tools.max_calls", 10),
        "tools_enabled": config.get("tools.enabled", True),
    }


@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    config.set("tools.max_calls", settings.tools_max_calls)
    config.set("tools.enabled", settings.tools_enabled)
    config.save()
    return {"status": "saved"}


class MCPServerConfig(BaseModel):
    command: str
    args: list[str] = []
    env: dict[str, str] | None = None
    proxy: str | None = None


@app.get("/api/mcp/servers")
async def list_mcp_servers():
    return config.get("mcp.servers", {})


@app.post("/api/mcp/servers/{name}")
async def add_mcp_server(name: str, server_config: MCPServerConfig):
    servers = config.get("mcp.servers", {})
    servers[name] = server_config.model_dump()
    config.set("mcp.servers", servers)
    config.save()
    return {"status": "added", "name": name}


@app.delete("/api/mcp/servers/{name}")
async def delete_mcp_server(name: str):
    servers = config.get("mcp.servers", {})
    if name in servers:
        del servers[name]
        config.set("mcp.servers", servers)
        config.save()
    return {"status": "deleted"}


@app.get("/api/mcp/tools")
async def get_mcp_tools():
    from .mcp_client import list_all_mcp_tools
    return await list_all_mcp_tools()


# Heartbeat Scheduler
import asyncio
import logging

logger = logging.getLogger(__name__)


async def heartbeat_scheduler(agent_id: str, interval_minutes: int, prompt: str):
    """Background task that runs heartbeat periodically for an agent."""

    async def send_message_callback(session_id: str, message: str):
        """Callback to send message to a session during heartbeat."""
        # Save user message placeholder (optional - to indicate this is a proactive message)
        # Actually send the assistant message
        db.add_message(session_id, "assistant", message)
        logger.info(f"Heartbeat sent message to session {session_id}")

    while True:
        try:
            sleep_minutes = interval_minutes * random.uniform(0.8, 1.2)
            await asyncio.sleep(sleep_minutes * 60)

            # Check if agent still exists and heartbeat is enabled
            agent_info = db.get_agent(agent_id)
            if not agent_info:
                logger.info(f"Agent {agent_id} no longer exists, stopping heartbeat")
                break

            heartbeat_config = agent_info.get("heartbeat", {})
            if not heartbeat_config.get("enabled", False):
                logger.info(f"Heartbeat disabled for {agent_id}, stopping")
                break

            # Get agent's active sessions
            sessions = db.list_sessions(agent_id)

            # Run heartbeat with sessions and send callback
            agent = await get_agent_runtime(agent_id)
            result = await agent.heartbeat(
                prompt=prompt,
                sessions=sessions,
                send_callback=send_message_callback
            )

            # Log the heartbeat with detailed info
            log_response = result.get("response", "")
            actions = result.get("actions_taken", [])
            sent = result.get("sent_messages", [])

            log_entry = log_response
            if actions:
                log_entry += f"\nActions: {len(actions)} tools executed"
            if sent:
                log_entry += f"\nMessages sent: {len(sent)}"

            db.add_heartbeat_log(agent_id, prompt, log_entry)
            logger.info(f"Heartbeat completed for {agent_id}: {len(actions)} actions, {len(sent)} messages sent")

        except asyncio.CancelledError:
            logger.info(f"Heartbeat task cancelled for {agent_id}")
            break
        except Exception as e:
            logger.error(f"Heartbeat error for {agent_id}: {e}")


def start_heartbeat_scheduler(agent_id: str, heartbeat_config: dict):
    """Start a heartbeat scheduler for an agent."""
    if agent_id in heartbeat_tasks:
        heartbeat_tasks[agent_id].cancel()

    if not heartbeat_config.get("enabled", False):
        return

    interval = heartbeat_config.get("interval_minutes", 30)
    prompt = heartbeat_config.get("prompt", "")
    task = asyncio.create_task(heartbeat_scheduler(agent_id, interval, prompt))
    heartbeat_tasks[agent_id] = task
    logger.info(f"Started heartbeat for {agent_id} with interval {interval} minutes")


def stop_heartbeat_scheduler(agent_id: str):
    """Stop heartbeat scheduler for an agent."""
    if agent_id in heartbeat_tasks:
        heartbeat_tasks[agent_id].cancel()
        del heartbeat_tasks[agent_id]
        logger.info(f"Stopped heartbeat for {agent_id}")


@app.get("/api/agents/{agent_id}/heartbeat")
async def get_agent_heartbeat(agent_id: str):
    """Get agent heartbeat configuration and status."""
    agent = db.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    heartbeat_config = agent.get("heartbeat", {})
    is_running = agent_id in heartbeat_tasks

    return {
        "agent_id": agent_id,
        "heartbeat": heartbeat_config,
        "is_running": is_running,
    }


@app.patch("/api/agents/{agent_id}/heartbeat")
async def update_agent_heartbeat(agent_id: str, heartbeat: HeartbeatConfig):
    """Update agent heartbeat configuration."""
    agent = db.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    heartbeat_dict = heartbeat.model_dump()
    db.update_agent_heartbeat(agent_id, heartbeat_dict)

    # Restart scheduler with new config
    if heartbeat.enabled:
        start_heartbeat_scheduler(agent_id, heartbeat_dict)
    else:
        stop_heartbeat_scheduler(agent_id)

    return {"agent_id": agent_id, "heartbeat": heartbeat_dict}


@app.post("/api/agents/{agent_id}/heartbeat/trigger")
async def trigger_agent_heartbeat(agent_id: str, prompt: str | None = None):
    """Manually trigger a heartbeat for an agent."""

    async def send_message_callback(session_id: str, message: str):
        """Callback to send message to a session during heartbeat."""
        db.add_message(session_id, "assistant", message)
        logger.info(f"Trigger heartbeat sent message to session {session_id}")

    agent = db.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    try:
        # Get agent's sessions
        sessions = db.list_sessions(agent_id)

        agent_runtime = await get_agent_runtime(agent_id)
        result = await agent_runtime.heartbeat(
            prompt=prompt,
            sessions=sessions,
            send_callback=send_message_callback
        )

        # Log the heartbeat with detailed info
        log_response = result.get("response", "")
        actions = result.get("actions_taken", [])
        sent = result.get("sent_messages", [])

        log_entry = log_response
        if actions:
            log_entry += f"\nActions: {len(actions)} tools executed"
        if sent:
            log_entry += f"\nMessages sent: {len(sent)}"

        db.add_heartbeat_log(
            agent_id,
            prompt or result.get("prompt", ""),
            log_entry
        )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents/{agent_id}/heartbeat/logs")
async def get_agent_heartbeat_logs(agent_id: str, limit: int = 20):
    """Get heartbeat logs for an agent."""
    agent = db.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    logs = db.get_heartbeat_logs(agent_id, limit)
    return {"agent_id": agent_id, "logs": logs}


@app.delete("/api/agents/{agent_id}/heartbeat/logs")
async def clear_agent_heartbeat_logs(agent_id: str):
    """Clear all heartbeat logs for an agent."""
    agent = db.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    db.delete_heartbeat_logs(agent_id)
    return {"status": "deleted"}


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


def run_server(host: str = "0.0.0.0", port: int = 47291):
    import uvicorn

    uvicorn.run(app, host=host, port=port)