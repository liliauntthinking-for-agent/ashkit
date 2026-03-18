import json
import logging
from pathlib import Path

from .channels.feishu import FeishuClient
from .agent import Agent
from .config import config

logger = logging.getLogger(__name__)


class Gateway:
    """Multi-agent center node - routes messages to agents and manages shared memory"""

    def __init__(self, config_path: Path | None = None):
        self.config = config
        if config_path:
            self.config = type(config)(config_path)
        self.feishu: FeishuClient | None = None
        self.agents: dict[str, Agent] = {}
        self._running = False

    async def start(self):
        """Start the gateway and connect to Feishu"""
        feishu_config = self.config.get("channels.feishu", {})

        if not feishu_config.get("enabled", False):
            logger.warning("Feishu channel is disabled")
            return

        self.feishu = FeishuClient(
            app_id=feishu_config.get("app_id", ""),
            app_secret=feishu_config.get("app_secret", ""),
            encrypt_key=feishu_config.get("encrypt_key", ""),
            verification_token=feishu_config.get("verification_token", ""),
        )

        self.feishu.on_message(self._handle_message)

        logger.info("Starting Gateway...")
        await self.feishu.connect_websocket()

        self._running = True
        await self.feishu.listen()

    async def stop(self):
        """Stop the gateway"""
        self._running = False
        if self.feishu and self.feishu.ws:
            await self.feishu.ws.close()

    async def _handle_message(self, message: dict):
        """Handle incoming Feishu messages"""
        msg_type = message.get("msg_type", "")
        if msg_type != "text":
            return

        content = json.loads(message.get("content", "{}"))
        text = content.get("text", "")
        user_id = message.get("sender_id", {}).get("open_id", "")
        message_id = message.get("message_id", "")

        if not text or not user_id:
            return

        logger.info(f"Received message from {user_id}: {text[:50]}...")

        agent = self._get_agent(user_id)

        try:
            response = await agent.process_message(user_id, text)

            if self.feishu:
                await self.feishu.reply_message(message_id, response)

            logger.info(f"Sent response to {user_id}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            if self.feishu:
                await self.feishu.reply_message(message_id, f"Error: {str(e)}")

    def _get_agent(self, user_id: str) -> Agent:
        """Get or create agent for user"""
        if user_id not in self.agents:
            workspace = Path(
                self.config.get("agents.defaults.workspace", "~/.ashkit/workspace")
            ).expanduser()
            workspace.mkdir(parents=True, exist_ok=True)

            self.agents[user_id] = Agent(
                agent_id=user_id,
                config=self.config.config,
                workspace=workspace,
            )

        return self.agents[user_id]

    async def send_to_agent(self, target_agent_id: str, message: str) -> str:
        """Send message to another agent (inter-agent communication)"""
        if target_agent_id not in self.agents:
            return f"Agent {target_agent_id} not found"

        return await self.agents[target_agent_id].process_message(
            target_agent_id, message
        )

    def list_agents(self) -> list[dict]:
        """List all active agents"""
        return [
            {"agent_id": agent_id, "initialized": agent._initialized}
            for agent_id, agent in self.agents.items()
        ]
