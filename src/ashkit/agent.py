import json
import logging
from pathlib import Path
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)

MEMORY_PERSIST_THRESHOLD = 6


class LLMClient:
    """Unified LLM client with custom provider support"""

    def __init__(self, config: dict):
        self.config = config
        self.model = config.get("model", "")
        self.provider = config.get("provider", "")
        self._client = None

    async def chat(self, messages: list[dict]) -> str:
        return await self._custom_chat(messages)

    async def chat_stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        async for chunk in self._custom_chat_stream(messages):
            yield chunk

    async def _custom_chat(self, messages: list[dict]) -> str:
        import httpx

        if not self.provider:
            logger.error("No provider configured")
            return "Error: No provider configured. Please select a provider when creating the agent."
        
        if not self.model:
            logger.error("No model configured")
            return "Error: No model configured. Please select a model when creating the agent."
        
        provider_config = self.config.get("providers", {}).get(self.provider, {})
        api_key = provider_config.get("apiKey", "")
        api_base = provider_config.get("apiBase", "")
        
        if not api_base:
            logger.error(f"No apiBase configured for provider: {self.provider}")
            return f"Error: Provider '{self.provider}' has no apiBase configured"

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

    async def _custom_chat_stream(self, messages: list[dict]) -> AsyncGenerator[str, None]:
        import httpx

        if not self.provider:
            yield "Error: No provider configured."
            return
        
        if not self.model:
            yield "Error: No model configured."
            return
        
        provider_config = self.config.get("providers", {}).get(self.provider, {})
        api_key = provider_config.get("apiKey", "")
        api_base = provider_config.get("apiBase", "")
        
        if not api_base:
            yield f"Error: Provider '{self.provider}' has no apiBase configured."
            return

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{api_base.rstrip('/')}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                },
                timeout=120.0,
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield f"Error: {response.status_code}"
                    return
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

    async def get_embedding(self, text: str) -> list[float]:
        import httpx

        provider_config = self.config.get("providers", {}).get(self.provider, {})
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
        from .tools import init_tools

        self.memory = MemoryManager(self.workspace / self.agent_id)
        self.skill_loader = SkillLoader(self.workspace / "skills")
        self.skills = await self.skill_loader.load_all()
        init_tools(self.workspace)
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

        await self._persist_memory(user_id)

        return response

    async def process_message_stream(self, user_id: str, message: str) -> AsyncGenerator[str, None]:
        await self.initialize()

        context = await self.memory.get_context(self.agent_id, user_id, self.llm)

        system_prompt = self._build_system_prompt()
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(context)
        messages.append({"role": "user", "content": message})

        self.memory.add_message("user", message)
        
        full_response = ""
        async for chunk in self.llm.chat_stream(messages):
            full_response += chunk
            yield chunk
        
        self.memory.add_message("assistant", full_response)

        await self._persist_memory(user_id)

    async def _persist_memory(self, user_id: str):
        message_count = len(self.memory.l1.messages)
        
        if message_count >= MEMORY_PERSIST_THRESHOLD:
            await self.memory.save_to_l2(self.agent_id, user_id, self.llm, "")
            await self._extract_semantic_memory(user_id)

    async def _extract_semantic_memory(self, user_id: str):
        messages = self.memory.l1.get_context()
        if len(messages) < 4:
            return

        try:
            extraction = await self.llm.chat([
                {
                    "role": "system",
                    "content": "Extract important user information (name, preferences, facts about user) from the conversation. "
                    "Return ONLY the facts, one per line. If nothing important to remember, return 'NONE'. "
                    "Be concise. Example format:\nUser name: John\nLikes: Python programming"
                },
                {"role": "user", "content": str(messages)}
            ])
            
            if extraction and extraction.strip() != "NONE":
                await self.memory.save_to_l3(user_id, extraction.strip(), self.llm)
                logger.info(f"Saved semantic memory for {user_id}: {extraction[:50]}...")
        except Exception as e:
            logger.warning(f"Failed to extract semantic memory: {e}")

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
