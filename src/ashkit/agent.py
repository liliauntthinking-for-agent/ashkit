import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class LLMClient:
    """Unified LLM client with custom provider support"""

    def __init__(self, config: dict):
        self.config = config
        self.model = config.get("model", "")
        self.provider = config.get("provider", "custom")
        self._client = None

    async def chat(self, messages: list[dict]) -> str:
        if self.provider == "custom":
            return await self._custom_chat(messages)
        else:
            raise NotImplementedError(f"Provider {self.provider} not implemented")

    async def _custom_chat(self, messages: list[dict]) -> str:
        import httpx

        provider_config = self.config.get("providers", {}).get("custom", {})
        api_key = provider_config.get("apiKey", "")
        api_base = provider_config.get("apiBase", "")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{api_base.rstrip('/')}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                },
                timeout=120.0,
            )
            if resp.status_code != 200:
                logger.error(f"LLM error: {resp.text}")
                return f"Error: {resp.status_code}"
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def get_embedding(self, text: str) -> list[float]:
        import httpx

        provider_config = self.config.get("providers", {}).get("custom", {})
        api_key = provider_config.get("apiKey", "")
        api_base = provider_config.get("apiBase", "")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{api_base.rstrip('/')}/embeddings",
                headers=headers,
                json={
                    "model": "text-embedding-3-small",
                    "input": text,
                },
                timeout=30.0,
            )
            if resp.status_code != 200:
                return [0.0] * 1536
            data = resp.json()
            return data["data"][0]["embedding"]


class Agent:
    """Core Agent with tools, memory and skills"""

    def __init__(
        self,
        agent_id: str,
        config: dict,
        workspace: Path,
    ):
        self.agent_id = agent_id
        self.config = config
        self.workspace = workspace
        self.llm = LLMClient(config)
        self.tools = []
        self.skills = []
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return

        from .memory import MemoryManager
        from .skills import SkillLoader

        self.memory = MemoryManager(self.workspace / self.agent_id)
        self.skill_loader = SkillLoader(self.workspace / "skills")
        self.skills = await self.skill_loader.load_all()
        self._initialized = True

        logger.info(f"Agent {self.agent_id} initialized with {len(self.skills)} skills")

    async def process_message(self, user_id: str, message: str) -> str:
        await self.initialize()

        context = await self.memory.get_context(self.agent_id, user_id, self.llm)

        system_prompt = self._build_system_prompt()
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(context)
        messages.append({"role": "user", "content": message})

        response = await self.llm.chat(messages)

        self.memory.add_message("user", message)
        self.memory.add_message("assistant", response)

        return response

    def _build_system_prompt(self) -> str:
        prompt = "You are a helpful AI assistant."
        if self.skills:
            prompt += "\n\nAvailable skills:\n"
            for skill in self.skills:
                prompt += f"- {skill.name}: {skill.description}\n"
        return prompt

    async def call_tool(self, tool_name: str, **kwargs) -> Any:
        from .tools import get_tool

        tool = get_tool(tool_name)
        if not tool:
            return f"Tool {tool_name} not found"
        return await tool.execute(**kwargs)
