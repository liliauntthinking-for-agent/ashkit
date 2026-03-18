import asyncio
import json
import logging
import subprocess
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class BaseTool:
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    async def execute(self, **kwargs) -> Any:
        raise NotImplementedError


class BashTool(BaseTool):
    def __init__(self):
        super().__init__("bash", "Execute shell commands")

    async def execute(self, command: str, timeout: int = 60) -> str:
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = result.stdout
            if result.stderr:
                output += f"\n[stderr] {result.stderr}"
            return output or "[no output]"
        except subprocess.TimeoutExpired:
            return f"Command timed out after {timeout}s"
        except Exception as e:
            return f"Error: {str(e)}"


class ReadTool(BaseTool):
    def __init__(self, workspace: Path):
        super().__init__("read", "Read files from workspace")
        self.workspace = workspace

    async def execute(self, path: str) -> str:
        try:
            file_path = self.workspace / path
            if not file_path.exists():
                return f"File not found: {path}"
            if not file_path.is_file():
                return f"Not a file: {path}"
            content = file_path.read_text(encoding="utf-8")
            return content[:10000]
        except Exception as e:
            return f"Error reading file: {str(e)}"


class WriteTool(BaseTool):
    def __init__(self, workspace: Path):
        super().__init__("write", "Write files to workspace")
        self.workspace = workspace

    async def execute(self, path: str, content: str) -> str:
        try:
            file_path = self.workspace / path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding="utf-8")
            return f"Written to {path}"
        except Exception as e:
            return f"Error writing file: {str(e)}"


class EditTool(BaseTool):
    def __init__(self, workspace: Path):
        super().__init__("edit", "Edit files in workspace")
        self.workspace = workspace

    async def execute(self, path: str, old: str, new: str) -> str:
        try:
            file_path = self.workspace / path
            if not file_path.exists():
                return f"File not found: {path}"
            content = file_path.read_text(encoding="utf-8")
            if old not in content:
                return f"Pattern not found in file"
            new_content = content.replace(old, new)
            file_path.write_text(new_content, encoding="utf-8")
            return f"Edited {path}"
        except Exception as e:
            return f"Error editing file: {str(e)}"


class MCPTool(BaseTool):
    def __init__(self):
        super().__init__("mcp", "Execute MCP server tools")

    async def execute(self, server: str, tool: str, **kwargs) -> Any:
        return f"MCP tool execution not implemented yet: {server}.{tool}"


_TOOL_REGISTRY = {}


def register_tool(tool: BaseTool):
    _TOOL_REGISTRY[tool.name] = tool


def get_tool(name: str) -> BaseTool | None:
    return _TOOL_REGISTRY.get(name)


def init_tools(workspace: Path):
    register_tool(BashTool())
    register_tool(ReadTool(workspace))
    register_tool(WriteTool(workspace))
    register_tool(EditTool(workspace))
    register_tool(MCPTool())
