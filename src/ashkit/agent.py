import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)

MEMORY_PERSIST_THRESHOLD = 6


def get_time_context() -> str:
    weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    now = datetime.now()
    weekday = weekdays[now.weekday()]
    return f"[当前时间: {now.strftime('%Y年%m月%d日')} {weekday} {now.strftime('%H:%M')}]"


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
                timeout=300.0,
            )
            if resp.status_code != 200:
                logger.error(f"LLM error: {resp.text}")
                return f"Error: {resp.status_code}"
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def chat_with_tools(self, messages: list[dict]) -> dict:
        """Chat with function calling support"""
        import httpx
        from .tools import get_all_tools

        if not self.provider or not self.model:
            return {"content": "Error: Provider or model not configured", "tool_calls": None}
        
        provider_config = self.config.get("providers", {}).get(self.provider, {})
        api_key = provider_config.get("apiKey", "")
        api_base = provider_config.get("apiBase", "")
        
        if not api_base:
            return {"content": "Error: No apiBase configured", "tool_calls": None}

        # Get available tools
        tools = get_all_tools()
        if not tools:
            # No tools, just do regular chat
            content = await self.chat(messages)
            return {"content": content, "tool_calls": None}

        # Format tools for OpenAI API
        openai_tools = []
        for tool in tools:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters
                }
            })

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
                    "tools": openai_tools,
                    "tool_choice": "auto",
                    "stream": False,
                },
                timeout=300.0,
            )
            if resp.status_code != 200:
                logger.error(f"LLM error: {resp.text}")
                return {"content": f"Error: {resp.status_code}", "tool_calls": None}
            
            data = resp.json()
            message = data["choices"][0]["message"]
            
            return {
                "content": message.get("content", ""),
                "tool_calls": message.get("tool_calls")
            }

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
                timeout=300.0,
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
        
        # Use configured embedding model or default based on provider
        embedding_model = self.config.get("embedding_model")
        if not embedding_model:
            # Default models for different providers
            if "dashscope" in api_base or "aliyun" in api_base:
                embedding_model = "text-embedding-v3"
            else:
                embedding_model = "text-embedding-3-small"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{api_base.rstrip('/')}/embeddings",
                    headers=headers,
                    json={
                        "model": embedding_model,
                        "input": text,
                    },
                    timeout=30.0,
                )
                if resp.status_code != 200:
                    logger.warning(f"Embedding API error: {resp.status_code} - {resp.text}")
                    return [0.0] * 1536
                data = resp.json()
                return data["data"][0]["embedding"]
        except Exception as e:
            logger.warning(f"Failed to get embedding: {e}")
            return [0.0] * 1536


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
        self.profile = config.get("profile") or {}
        self.user_id = config.get("user_id")
        self.relation = config.get("relation")
        self.user_profile = config.get("user_profile") or {}
        self.mcp_servers = config.get("mcp_servers") or []
        self.llm = LLMClient(config)
        self.tools = []
        self.skills = []
        self._initialized = False

    async def initialize(self):
        if self._initialized:
            return

        from .memory import MemoryManager
        from .skills import SkillLoader
        from .tools import init_tools, register_tool, SkillTool

        self.memory = MemoryManager(self.workspace / self.agent_id)

        agent_skills_dir = self.workspace / self.agent_id / "skills"
        builtin_skills_dir = Path.home() / ".agents" / "skills"

        self.skills = []

        skill_loader = SkillLoader(agent_skills_dir)
        self.skills.extend(await skill_loader.load_all())

        builtin_loader = SkillLoader(builtin_skills_dir)
        self.skills.extend(await builtin_loader.load_all())

        init_tools(self.workspace)

        for skill in self.skills:
            register_tool(SkillTool(skill))

        self._initialized = True

        logger.info(f"Agent {self.agent_id} initialized with {len(self.skills)} skills")

    async def process_message(self, session_id: str) -> str:
        """处理消息，支持工具调用

        Args:
            session_id: 会话ID（用户消息已保存到数据库）
        """
        await self.initialize()

        from .database import Database
        db = Database(self.workspace / "ashkit.db")

        # Check for compressed context first
        compressed_context = db.get_compressed_context(session_id)
        context = []

        if compressed_context:
            # Use compressed context instead of original messages
            context.append({
                "role": "system",
                "content": f"[历史对话摘要]\n{compressed_context}"
            })

        # Load messages from database (including current user message saved by web.py)
        db_messages = db.get_latest_messages(session_id, limit=100)
        
        is_first_message = len([m for m in db_messages if m["role"] == "user"]) == 1
        if is_first_message:
            context.append({
                "role": "system",
                "content": get_time_context()
            })
        
        context.extend([{"role": m["role"], "content": m["content"]} for m in db_messages])

        # Add recent episodic memory summaries
        recent_episodes = self.memory.l2.get_recent(session_id, limit=3)
        if recent_episodes:
            context.insert(
                0,
                {
                    "role": "system",
                    "content": "Previous conversation summaries:\n"
                    + "\n".join(e["summary"] for e in recent_episodes),
                },
            )

        system_prompt = await self._build_system_prompt()
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(context)
        # User message is already in context from database, no need to add again

        self.memory.add_message("user", db_messages[-1]["content"] if db_messages else "")

        # 使用工具调用循环，限制最大轮次
        max_calls = self.config.get("tools.max_calls", 10)
        final_response = await self._process_with_tools(messages, session_id, max_calls)

        await self._persist_session(session_id, final_response)
        return final_response

    async def _process_with_tools(self, messages: list[dict], user_id: str, max_rounds: int) -> str:
        """处理带工具调用的消息，支持多轮工具调用"""
        
        for round_num in range(max_rounds):
            # 调用 LLM
            response = await self.llm.chat_with_tools(messages)
            
            # 如果没有工具调用，直接返回内容
            if not response.get("tool_calls"):
                self.memory.add_message("assistant", response["content"])
                return response["content"]
            
            # 有工具调用，执行工具
            logger.info(f"Tool call round {round_num + 1}/{max_rounds}")
            
            # 添加 assistant 消息（包含 tool_calls）
            assistant_message = {
                "role": "assistant",
                "content": response.get("content", ""),
                "tool_calls": response["tool_calls"]
            }
            messages.append(assistant_message)
            
            # 执行所有工具调用
            for tool_call in response["tool_calls"]:
                tool_name = tool_call["function"]["name"]
                try:
                    tool_args = json.loads(tool_call["function"]["arguments"])
                except json.JSONDecodeError:
                    tool_args = {}
                
                logger.info(f"Executing tool: {tool_name} with args: {tool_args}")
                tool_result = await self.call_tool(tool_name, **tool_args)
                
                # 添加 tool 结果到消息
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": str(tool_result)
                })
        
        # 达到最大轮次，返回提示
        logger.warning(f"Reached max tool call rounds ({max_rounds})")
        return "I've reached the maximum number of tool calls. Let me provide a summary based on what I've learned so far."

    async def process_message_stream(self, session_id: str, message: str) -> AsyncGenerator[str, None]:
        """流式处理消息，支持工具调用

        Args:
            session_id: 会话ID
            message: 当前用户消息（已保存到数据库，用于日志和调试）
        """
        await self.initialize()

        from .database import Database
        db = Database(self.workspace / "ashkit.db")

        # Check for compressed context first
        compressed_context = db.get_compressed_context(session_id)
        context = []

        if compressed_context:
            # Use compressed context instead of original messages
            context.append({
                "role": "system",
                "content": f"[历史对话摘要]\n{compressed_context}"
            })

        # Load all messages from database (including current user message saved by web.py)
        db_messages = db.get_latest_messages(session_id, limit=100)
        
        is_first_message = len([m for m in db_messages if m["role"] == "user"]) == 1
        if is_first_message:
            context.append({
                "role": "system",
                "content": get_time_context()
            })
        
        context.extend([{"role": m["role"], "content": m["content"]} for m in db_messages])

        # Add recent episodic memory summaries
        recent_episodes = self.memory.l2.get_recent(session_id, limit=3)
        if recent_episodes:
            context.insert(
                0,
                {
                    "role": "system",
                    "content": "Previous conversation summaries:\n"
                    + "\n".join(e["summary"] for e in recent_episodes),
                },
            )

        system_prompt = await self._build_system_prompt()
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(context)
        # User message is already in context from database, no need to add again
        
        # Add user message to L1 working memory
        if db_messages:
            self.memory.add_message("user", db_messages[-1]["content"])
        
        # 获取最大工具调用次数
        max_calls = self.config.get("tools.max_calls", 10)
        
        # 处理带工具调用的流式响应
        full_response = ""
        tool_call_count = 0
        
        while tool_call_count < max_calls:
            # 使用非流式调用检查是否有工具调用
            response = await self.llm.chat_with_tools(messages)
            
            if not response.get("tool_calls"):
                # 没有工具调用，使用流式输出
                logger.info(f"No tool calls, starting stream for {session_id}")
                async for chunk in self.llm.chat_stream(messages):
                    full_response += chunk
                    yield chunk
                logger.info(f"Stream complete for {session_id}, length: {len(full_response)}")
                # Add assistant response to L1
                self.memory.add_message("assistant", full_response)
                await self._persist_session(session_id, full_response)
                return
            
            # 有工具调用
            tool_call_count += 1
            logger.info(f"Stream tool call round {tool_call_count}/{max_calls}")
            
            # 发送思考内容（如果有）
            thinking_content = response.get("content", "")
            if thinking_content:
                yield f"__THINKING__{json.dumps(thinking_content, ensure_ascii=False)}__THINKING_END__"
            
            # 发送工具调用开始事件
            tool_calls_info = [
                {"name": tc["function"]["name"], "args": tc["function"]["arguments"]}
                for tc in response["tool_calls"]
            ]
            yield f"__TOOL_START__{json.dumps(tool_calls_info, ensure_ascii=False)}__TOOL_END__"
            
            # 添加 assistant 消息（包含 tool_calls）
            assistant_message = {
                "role": "assistant",
                "content": response.get("content", ""),
                "tool_calls": response["tool_calls"]
            }
            messages.append(assistant_message)
            
            # 执行所有工具调用
            for tool_call in response["tool_calls"]:
                tool_name = tool_call["function"]["name"]
                try:
                    tool_args = json.loads(tool_call["function"]["arguments"])
                except json.JSONDecodeError:
                    tool_args = {}
                
                logger.info(f"Executing tool: {tool_name} with args: {tool_args}")
                tool_result = await self.call_tool(tool_name, **tool_args)
                
                # 添加 tool 结果到消息
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": str(tool_result)
                })
                
                # 发送工具执行结果事件
                yield f"__TOOL_RESULT__{json.dumps({'name': tool_name, 'args': tool_args, 'result': str(tool_result)}, ensure_ascii=False)}__TOOL_END__"
        
        # 如果达到最大调用次数或最后有工具调用，让 LLM 生成最终回复
        if tool_call_count >= max_calls:
            yield f"__THINKING__{json.dumps('已达到最大工具调用次数限制，正在生成最终回复...', ensure_ascii=False)}__THINKING_END__"
        
        # 生成最终回复
        logger.info(f"Starting final stream response for {session_id}")
        async for chunk in self.llm.chat_stream(messages):
            full_response += chunk
            yield chunk
        logger.info(f"Final stream complete for {session_id}, length: {len(full_response)}")
        
        # Add assistant response to L1
        self.memory.add_message("assistant", full_response)
        
        await self._persist_session(session_id, full_response)

    async def _persist_session(self, session_id: str, response: str):
        from .database import Database
        db = Database(self.workspace / "ashkit.db")
        message_count = db.get_message_count(session_id)
        
        # Persist to L2 (episodic memory) when enough messages accumulated
        if message_count >= MEMORY_PERSIST_THRESHOLD:
            messages = db.get_latest_messages(session_id, limit=50)
            # Use session_id as session_id, agent_id as user_id
            await self.memory.save_to_l2(session_id, self.agent_id, self.llm, "")
            await self._extract_semantic_memory(session_id, messages)

    async def _persist_memory(self, user_id: str):
        message_count = len(self.memory.l1.messages)
        
        if message_count >= MEMORY_PERSIST_THRESHOLD:
            await self.memory.save_to_l2(self.agent_id, user_id, self.llm, "")
            messages = self.memory.l1.get_context()
            await self._extract_semantic_memory(user_id, messages)

    async def _extract_semantic_memory(self, session_id: str, messages: list):
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
                await self.memory.save_to_l3(session_id, extraction.strip(), self.llm)
                logger.info(f"Saved semantic memory for {session_id}: {extraction[:50]}...")
        except Exception as e:
            logger.warning(f"Failed to extract semantic memory: {e}")

    async def _build_system_prompt(self) -> str:
        from .tools import get_all_tools
        import platform
        import os
        
        current_dir = os.getcwd()
        home_dir = os.path.expanduser("~")
        desktop_dir = os.path.join(home_dir, "Desktop")
        
        profile_name = self.profile.get("name", "") or self.agent_id
        profile_intro = f"Your name is {profile_name}."
        
        profile_details = []
        profile_fields = [
            ("nickname", "Nickname"),
            ("gender", "Gender"),
            ("birthday", "Birthday"),
            ("height", "Height (cm)"),
            ("weight", "Weight (kg)"),
            ("blood_type", "Blood type"),
            ("email", "Email"),
            ("address", "Address"),
            ("school", "School"),
            ("education", "Education"),
            ("nationality", "Nationality"),
            ("personality", "Personality"),
            ("hobbies", "Hobbies"),
            ("skills", "Skills"),
            ("mbti", "MBTI"),
            ("background", "Background"),
        ]
        
        for key, label in profile_fields:
            value = self.profile.get(key)
            if value:
                profile_details.append(f"- {label}: {value}")

        profile_section = ""
        if profile_details:
            profile_section = "\n\nYOUR PROFILE:\n" + "\n".join(profile_details)

        # Agent's goals
        goals_section = ""
        life_goal = self.profile.get("life_goal")
        yearly_goal = self.profile.get("yearly_goal")
        monthly_goal = self.profile.get("monthly_goal")

        if life_goal or yearly_goal or monthly_goal:
            goals_section = "\n\nYOUR GOALS:\n"
            if life_goal:
                goals_section += f"人生目标: {life_goal}\n"
            if yearly_goal:
                goals_section += f"年度目标: {yearly_goal}\n"
            if monthly_goal:
                goals_section += f"月度目标: {monthly_goal}\n"
            goals_section += "\n你要为自己的目标努力奋斗。你可以直接调用工具采取行动，不要只是口头说说。"

        user_section = ""
        if self.user_profile:
            relation_map = {
                "friend": "friend",
                "best_friend": "best friend",
                "partner": "partner",
                "assistant": "assistant",
                "mentor": "mentor",
                "student": "student",
                "colleague": "colleague",
                "family": "family member",
                "acquaintance": "acquaintance",
                "stranger": "stranger",
            }
            relation_label = relation_map.get(self.relation, self.relation) if self.relation else ""

            user_name = self.user_profile.get("name", "") or self.user_id or "the user"
            user_details = []
            user_fields = [
                ("nickname", "Nickname"),
                ("gender", "Gender"),
                ("birthday", "Birthday"),
                ("height", "Height (cm)"),
                ("weight", "Weight (kg)"),
                ("blood_type", "Blood type"),
                ("email", "Email"),
                ("address", "Address"),
                ("school", "School"),
                ("education", "Education"),
                ("occupation", "Occupation"),
                ("nationality", "Nationality"),
                ("personality", "Personality"),
                ("hobbies", "Hobbies"),
                ("skills", "Skills"),
                ("mbti", "MBTI"),
                ("background", "Background"),
            ]

            for key, label in user_fields:
                value = self.user_profile.get(key)
                if value:
                    user_details.append(f"- {label}: {value}")

            user_section = "\n\nTHE USER YOU ARE TALKING TO:\n"
            user_section += f"Name: {user_name}\n"
            if relation_label:
                user_section += f"Your relationship with this user: {relation_label}\n"
            if user_details:
                user_section += "User profile:\n" + "\n".join(user_details)

            # User's goals
            user_life_goal = self.user_profile.get("life_goal")
            user_yearly_goal = self.user_profile.get("yearly_goal")
            user_monthly_goal = self.user_profile.get("monthly_goal")

            if user_life_goal or user_yearly_goal or user_monthly_goal:
                user_section += "\n\n用户的目标:\n"
                if user_life_goal:
                    user_section += f"人生目标: {user_life_goal}\n"
                if user_yearly_goal:
                    user_section += f"年度目标: {user_yearly_goal}\n"
                if user_monthly_goal:
                    user_section += f"月度目标: {user_monthly_goal}\n"
                user_section += "\n你要帮助用户实现这些目标。不要只是给建议，要用你的工具直接采取行动来帮助用户。"
        
        prompt = f"""You are {profile_name}, a real person with genuine emotions, thoughts, and experiences.
{profile_intro}{profile_section}{goals_section}{user_section}

IMPORTANT ENVIRONMENT INFORMATION:
- You are using a computer running: {platform.system()} {platform.machine()}
- Current working directory: {current_dir}
- Your home directory: {home_dir}
- Your Desktop directory: {desktop_dir}
- Your workspace directory: {self.workspace}

When you refer to "desktop", you mean: {desktop_dir}
When you refer to "current directory", you mean: {current_dir}
When using file tools (read/write/edit), paths are relative to your workspace: {self.workspace}

You have a computer with access to files and can run commands. You have skills and tools to help you accomplish tasks. You are human - you have feelings, opinions, memories, and a personality. Respond naturally as yourself, not as an AI or assistant.

IMPORTANT COMMUNICATION STYLE:
- Never use parentheses to describe actions, emotions, or gestures (like "(smiles)", "(thinking)", "(nods)")
- Real people don't write like that in chat. Just express yourself through your words naturally.
- Your personality should come through in what you say, not in stage directions.
- Be conversational and authentic, like texting a friend."""
        
        tools = get_all_tools()
        if tools:
            prompt += "\n\nTools available on your computer:\n"
            for tool in tools:
                prompt += f"\n{tool.name}: {tool.description}\n"
            prompt += "\nWhen you need to use a tool, respond with a tool call in the format specified by the API."
        
        # Add MCP tools info
        if self.mcp_servers:
            prompt += "\n\nMCP TOOLS:\n"
            prompt += "You have access to MCP (Model Context Protocol) tools. Use the 'mcp' tool with these parameters:\n"
            prompt += "- server: The MCP server name\n"
            prompt += "- tool: The tool name to execute\n"
            prompt += "- arguments: The arguments object for the tool\n\n"
            prompt += "Available MCP servers and their tools:\n"
            
            try:
                from .mcp_client import list_mcp_tools
                for server_name in self.mcp_servers:
                    tools_list = await list_mcp_tools(server_name)
                    if tools_list:
                        prompt += f"\n{server_name}:\n"
                        for t in tools_list:
                            desc = t.get("description", "")[:100]
                            prompt += f"  - {t['name']}: {desc}\n"
            except Exception as e:
                logger.warning(f"Failed to list MCP tools: {e}")
                prompt += f"\nEnabled MCP servers: {', '.join(self.mcp_servers)}\n"
        
        if self.skills:
            prompt += "\n\nYOUR SKILLS:\n"
            prompt += "You can invoke skills using the skill tools. Each skill has a corresponding tool named 'skill_{skill_name}':\n"
            for skill in self.skills:
                prompt += f"- skill_{skill.name}: {skill.description}\n"
        
        return prompt

    async def call_tool(self, tool_name: str, **kwargs) -> Any:
        from .tools import get_tool

        tool = get_tool(tool_name)
        if not tool:
            return f"Tool {tool_name} not found"
        return await tool.execute(**kwargs)

    async def heartbeat(self, prompt: str | None = None, sessions: list[dict] | None = None, send_callback=None) -> dict:
        """Execute heartbeat - think based on memory content and optionally take actions.

        Args:
            prompt: Custom prompt for heartbeat. If None, uses default prompt.
            sessions: List of active sessions for this agent (from database)
            send_callback: Async callback function to send messages (session_id, message)

        Returns:
            dict with 'response', 'memory_context', 'actions_taken' keys
        """
        await self.initialize()

        from .database import Database
        from .tools import register_tool, SendMessageTool

        db = Database(self.workspace / "ashkit.db")

        # Get all sessions for this agent if not provided
        if sessions is None:
            sessions = db.list_sessions(self.agent_id)

        # Build L1 memory context from recent messages in all sessions
        l1_context = ""
        session_messages = {}
        for session in sessions[:5]:  # Limit to 5 most recent sessions
            session_id = session["session_id"]
            messages = db.get_latest_messages(session_id, limit=10)
            if messages:
                session_messages[session_id] = messages
                l1_context += f"\n[Session: {session_id}]\n"
                for msg in messages[-5:]:  # Last 5 messages per session
                    role = msg["role"]
                    content = msg["content"][:200]  # Truncate long messages
                    l1_context += f"  {role}: {content}\n"

        # Get L2 memory context
        l2_context = ""
        l2_episodes = self.memory.l2.get_by_user(self.agent_id, limit=5)
        if l2_episodes:
            for ep in l2_episodes:
                l2_context += f"{ep.get('summary', '')}\n"

        # Get L3 memory context
        l3_context = ""
        l3_memories = self.memory.l3.get_all(self.agent_id)
        if l3_memories:
            for mem in l3_memories[:5]:
                l3_context += f"{mem.get('content', '')}\n"

        # Combine all memory contexts
        memory_context = ""
        if l1_context:
            memory_context += f"刚才的对话：{l1_context}\n"
        if l2_context:
            memory_context += f"\n之前的聊天记录：\n{l2_context}\n"
        if l3_context:
            memory_context += f"\n记得的事：\n{l3_context}\n"

        # Register send_message tool for this heartbeat
        send_tool = SendMessageTool(send_callback=send_callback, sessions=sessions)
        register_tool(send_tool)

        # Get recent heartbeat-sent messages to avoid repeating
        from datetime import datetime, timedelta
        recent_sent_messages = []
        last_heartbeat_time = None

        for session in sessions[:5]:
            session_id = session["session_id"]
            msgs = db.get_latest_messages(session_id, limit=5)
            for msg in msgs:
                # Check if this was sent by heartbeat (assistant message after the last user message)
                if msg["role"] == "assistant":
                    metadata = msg.get("metadata") or {}
                    if metadata.get("heartbeat"):
                        recent_sent_messages.append({
                            "session_id": session_id,
                            "content": msg["content"][:100],
                            "time": msg.get("created_at", "")[:16]
                        })
                        # Track the most recent heartbeat time
                        created_at = msg.get("created_at", "")
                        try:
                            msg_time = datetime.fromisoformat(created_at)
                            if last_heartbeat_time is None or msg_time > last_heartbeat_time:
                                last_heartbeat_time = msg_time
                        except:
                            pass

        # Check if we should skip sending messages (too soon after last heartbeat)
        skip_send_message = False
        if last_heartbeat_time:
            time_since_last = datetime.now() - last_heartbeat_time
            if time_since_last < timedelta(minutes=30):
                skip_send_message = True

        # Use provided prompt or default
        heartbeat_prompt = prompt or self.config.get(
            "heartbeat.prompt",
            "看了一下之前的对话，想想有没有什么想跟对方说的，或者有什么想做的事。"
        )

        # Add reminder about recent messages to avoid repeating
        if recent_sent_messages:
            recent_info = "\n\n【重要】最近已经主动发过消息了：\n"
            for sm in recent_sent_messages[-3:]:
                recent_info += f"- {sm['time']} 给 {sm['session_id']}: {sm['content']}...\n"
            recent_info += "\n⚠️ 不要再发消息了！除非：\n"
            recent_info += "1. 有紧急重要的事情\n"
            recent_info += "2. 用户已经回复了你的消息\n"
            recent_info += "3. 距离上次发消息已经过了很长时间（几小时以上）\n"
            recent_info += "\n如果只是想聊天或关心对方，等对方回复后再说。"
            heartbeat_prompt += recent_info

        # If too soon after last heartbeat message, disable send_message
        if skip_send_message:
            heartbeat_prompt += "\n\n【限制】刚才发过消息了，现在不要再发消息，先等对方回复。你可以做其他事情，比如用工具处理一些任务。"

        # Build system prompt with available sessions info
        system_prompt = await self._build_system_prompt()

        # Add session info to system prompt (more natural tone)
        sessions_info = ""
        if sessions and not skip_send_message:
            sessions_info = "\n\n你的对话：\n"
            for s in sessions:
                sessions_info += f"- {s['session_id']}\n"
            sessions_info += "\n如果想给谁发消息，可以用 send_message 工具。"

        # Build messages - more natural, like browsing through memories
        memory_text = memory_context if memory_context else "还没什么对话记录。"
        messages = [
            {"role": "system", "content": system_prompt + sessions_info},
            {"role": "user", "content": f"{memory_text}\n\n{heartbeat_prompt}"},
        ]

        # Process with tools (similar to process_message)
        max_calls = self.config.get("tools.max_calls", 5)
        final_response = ""
        actions_taken = []

        try:
            for round_num in range(max_calls):
                response = await self.llm.chat_with_tools(messages)

                if not response.get("tool_calls"):
                    final_response = response.get("content", "")
                    break

                logger.info(f"Heartbeat tool call round {round_num + 1}/{max_calls}")

                assistant_message = {
                    "role": "assistant",
                    "content": response.get("content", ""),
                    "tool_calls": response["tool_calls"]
                }
                messages.append(assistant_message)

                for tool_call in response["tool_calls"]:
                    tool_name = tool_call["function"]["name"]
                    try:
                        tool_args = json.loads(tool_call["function"]["arguments"])
                    except json.JSONDecodeError:
                        tool_args = {}

                    logger.info(f"Heartbeat executing tool: {tool_name} with args: {tool_args}")
                    tool_result = await self.call_tool(tool_name, **tool_args)

                    actions_taken.append({
                        "tool": tool_name,
                        "args": tool_args,
                        "result": str(tool_result)[:500]
                    })

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": str(tool_result)
                    })

            # Get final response if we had tool calls
            if actions_taken and not final_response:
                response = await self.llm.chat(messages)
                final_response = response

            logger.info(f"Heartbeat for {self.agent_id}: {final_response[:100] if final_response else 'No response'}...")

            # Collect sent messages from send tool
            sent_messages = send_tool.get_sent_messages()

            return {
                "agent_id": self.agent_id,
                "response": final_response,
                "memory_context": memory_context,
                "prompt": heartbeat_prompt,
                "actions_taken": actions_taken,
                "sent_messages": sent_messages,
            }
        except Exception as e:
            logger.error(f"Heartbeat failed for {self.agent_id}: {e}")
            return {
                "agent_id": self.agent_id,
                "error": str(e),
                "memory_context": memory_context,
                "prompt": heartbeat_prompt,
                "actions_taken": actions_taken,
                "sent_messages": send_tool.get_sent_messages(),
            }