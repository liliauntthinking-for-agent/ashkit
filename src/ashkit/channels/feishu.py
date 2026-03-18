import json
import logging
from typing import Callable
import httpx
import websockets
from websockets.client import WebSocketClientProtocol

logger = logging.getLogger(__name__)


class FeishuClient:
    def __init__(
        self,
        app_id: str,
        app_secret: str,
        encrypt_key: str = "",
        verification_token: str = "",
    ):
        self.app_id = app_id
        self.app_secret = app_secret
        self.encrypt_key = encrypt_key
        self.verification_token = verification_token
        self._tenant_access_token = ""
        self._token_expires_at = 0
        self.ws: WebSocketClientProtocol | None = None
        self._handlers: dict[str, Callable] = {}

    async def get_tenant_access_token(self) -> str:
        import time

        if self._tenant_access_token and time.time() < self._token_expires_at - 300:
            return self._tenant_access_token

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                json={
                    "app_id": self.app_id,
                    "app_secret": self.app_secret,
                },
            )
            data = resp.json()
            if data.get("code") != 0:
                raise Exception(f"Failed to get token: {data}")
            self._tenant_access_token = data["tenant_access_token"]
            self._token_expires_at = data["expire"]
            return self._tenant_access_token

    async def send_message(self, receive_id: str, content: str, msg_type: str = "text"):
        token = await self.get_tenant_access_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://open.feishu.cn/open-apis/im/v1/messages",
                params={"receive_id_type": "open_id"},
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "receive_id": receive_id,
                    "msg_type": msg_type,
                    "content": json.dumps({"text": content})
                    if msg_type == "text"
                    else content,
                },
            )
            return resp.json()

    async def reply_message(
        self, message_id: str, content: str, msg_type: str = "text"
    ):
        token = await self.get_tenant_access_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/reply",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "msg_type": msg_type,
                    "content": json.dumps({"text": content})
                    if msg_type == "text"
                    else content,
                },
            )
            return resp.json()

    async def connect_websocket(self):
        token = await self.get_tenant_access_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://open.feishu.cn/open-apis/im/v1/im_app_msgs/cover",
                headers={"Authorization": f"Bearer {token}"},
                json={"method": "get_ws_token"},
            )
            data = resp.json()
            if data.get("code") != 0:
                raise Exception(f"Failed to get ws token: {data}")
            ws_token = data["data"]["ws_token"]

        self.ws = await websockets.connect(
            f"wss://open.feishu.cn/im/ws?token={ws_token}",
            ping_interval=20,
            ping_timeout=10,
        )
        logger.info("Feishu WebSocket connected")
        return self.ws

    async def listen(self):
        if not self.ws:
            await self.connect_websocket()

        async for msg in self.ws:
            data = json.loads(msg)
            event_type = data.get("type", "")
            if event_type == "ping":
                await self.ws.send(json.dumps({"type": "pong"}))
            elif event_type == "im.message":
                message = data.get("event", {}).get("message", {})
                handler = self._handlers.get(event_type)
                if handler:
                    await handler(message)
            else:
                logger.debug(f"Unknown event type: {event_type}")

    def on_message(self, handler: Callable):
        self._handlers["im.message"] = handler
        return handler

    async def upload_file(self, file_path: str) -> str:
        token = await self.get_tenant_access_token()
        async with httpx.AsyncClient() as client:
            with open(file_path, "rb") as f:
                resp = await client.post(
                    "https://open.feishu.cn/open-apis/im/v1/files",
                    headers={"Authorization": f"Bearer {token}"},
                    files={"file": f},
                )
            data = resp.json()
            if data.get("code") != 0:
                raise Exception(f"Failed to upload file: {data}")
            return data["data"]["file_key"]
