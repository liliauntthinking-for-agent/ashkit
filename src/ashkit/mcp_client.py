import asyncio
import logging
import traceback
from pathlib import Path
from typing import Any

from .config import Config

logger = logging.getLogger(__name__)

_mcp_sessions: dict[str, Any] = {}


async def get_mcp_session(server_name: str, server_config: dict) -> Any:
    if server_name in _mcp_sessions:
        return _mcp_sessions[server_name]
    
    try:
        from mcp import ClientSession
        from mcp.client.stdio import stdio_client, StdioServerParameters
        from contextlib import asynccontextmanager
        import os
        
        command = server_config.get("command")
        args = server_config.get("args", [])
        env = server_config.get("env", {})
        proxy = server_config.get("proxy")
        
        if not command:
            raise ValueError(f"MCP server '{server_name}' has no command configured")
        
        # Add proxy to environment if configured
        if proxy:
            env = dict(env) if env else {}
            env["HTTP_PROXY"] = proxy
            env["HTTPS_PROXY"] = proxy
            env["http_proxy"] = proxy
            env["https_proxy"] = proxy
            env["PROXY"] = proxy
            # Use NODE_OPTIONS to load proxy agent for Node.js fetch
            proxy_script = Path.home() / ".mcp-proxy" / "proxy.mjs"
            if proxy_script.exists():
                env["NODE_OPTIONS"] = f"--import file://{proxy_script}"
            logger.info(f"Setting proxy for MCP server '{server_name}': {proxy}")
        
        if env:
            logger.info(f"MCP server '{server_name}' environment: {list(env.keys())}")
        
        server_params = StdioServerParameters(
            command=command,
            args=args,
            env=env if env else None,
        )
        
        # Use context manager properly
        cm = stdio_client(server_params)
        read_stream, write_stream = await cm.__aenter__()
        
        # Create client session
        session = ClientSession(read_stream, write_stream)
        await session.__aenter__()
        await session.initialize()
        
        _mcp_sessions[server_name] = {
            'session': session,
            'stdio_cm': cm,
        }
        
        logger.info(f"Connected to MCP server: {server_name}")
        return _mcp_sessions[server_name]
        
    except Exception as e:
        logger.error(f"Failed to connect to MCP server '{server_name}': {e}")
        logger.error(traceback.format_exc())
        raise


async def list_mcp_tools(server_name: str) -> list[dict]:
    config = Config()
    servers = config.get("mcp.servers", {})
    
    if server_name not in servers:
        return []
    
    try:
        session_info = await get_mcp_session(server_name, servers[server_name])
        session = session_info['session']
        tools = await session.list_tools()
        return [
            {
                "name": tool.name,
                "description": tool.description or "",
                "input_schema": tool.inputSchema,
            }
            for tool in tools.tools
        ]
    except Exception as e:
        logger.error(f"Failed to list MCP tools for '{server_name}': {e}")
        logger.error(traceback.format_exc())
        return []


async def call_mcp_tool(server_name: str, tool_name: str, arguments: dict) -> Any:
    config = Config()
    servers = config.get("mcp.servers", {})
    
    if server_name not in servers:
        return f"MCP server '{server_name}' not found in configuration"
    
    try:
        session_info = await get_mcp_session(server_name, servers[server_name])
        session = session_info['session']
        result = await session.call_tool(tool_name, arguments)
        
        if result.isError:
            error_msg = result.content[0].text if result.content else "Unknown error"
            return f"MCP tool error: {error_msg}"
        
        if result.content:
            texts = []
            for content in result.content:
                if hasattr(content, "text"):
                    texts.append(content.text)
                elif hasattr(content, "data"):
                    texts.append(str(content.data))
            return "\n".join(texts) if texts else "Tool executed successfully"
        
        return "Tool executed successfully"
        
    except Exception as e:
        logger.error(f"Failed to call MCP tool '{server_name}.{tool_name}': {e}")
        logger.error(traceback.format_exc())
        return f"Error calling MCP tool: {str(e)}"


async def list_all_mcp_tools() -> list[dict]:
    config = Config()
    servers = config.get("mcp.servers", {})
    
    all_tools = []
    for server_name in servers:
        tools = await list_mcp_tools(server_name)
        for tool in tools:
            all_tools.append({
                "server": server_name,
                "name": tool["name"],
                "description": tool["description"],
                "input_schema": tool["input_schema"],
            })
    
    return all_tools


def close_all_sessions():
    global _mcp_sessions
    for name, session_info in _mcp_sessions.items():
        try:
            session = session_info.get('session')
            cm = session_info.get('stdio_cm')
            if session:
                asyncio.create_task(session.__aexit__(None, None, None))
            if cm:
                asyncio.create_task(cm.__aexit__(None, None, None))
        except Exception as e:
            logger.warning(f"Error closing MCP session '{name}': {e}")
    _mcp_sessions = {}