import logging
import os
import subprocess
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Dangerous commands that should be blocked
DANGEROUS_COMMANDS = [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf ~/",
    "mkfs",
    "dd if=",
    "> /dev/sd",
    ":(){ :|:& };:",
    "chmod -R 777 /",
    "chown -R",
    "shutdown",
    "reboot",
    "halt",
    "poweroff",
    "init 0",
    "init 6",
]


def is_safe_path(path: Path, allowed_dirs: list[Path]) -> bool:
    """Check if path is within allowed directories."""
    try:
        resolved = path.resolve()
        for allowed in allowed_dirs:
            try:
                resolved.relative_to(allowed.resolve())
                return True
            except ValueError:
                continue
        return False
    except Exception:
        return False


class BaseTool:
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    async def execute(self, **kwargs) -> Any:
        raise NotImplementedError


class BashTool(BaseTool):
    def __init__(self, workspace: Path, allowed_read_dirs: list[Path] | None = None):
        super().__init__("bash", "Execute shell commands")
        self.workspace = workspace
        self.allowed_read_dirs = allowed_read_dirs or []
        self.parameters = {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute"
                },
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds",
                    "default": 60
                }
            },
            "required": ["command"]
        }

    def _is_dangerous(self, command: str) -> bool:
        """Check if command is potentially dangerous."""
        cmd_lower = command.lower().strip()
        for dangerous in DANGEROUS_COMMANDS:
            if dangerous.lower() in cmd_lower:
                return True
        # Block attempts to escape workspace with rm
        if "rm" in cmd_lower and ("~/" in cmd_lower or "/root" in cmd_lower or cmd_lower.startswith("rm /")):
            return True
        return False

    async def execute(self, command: str, timeout: int = 60) -> str:
        # Safety check
        if self._is_dangerous(command):
            return f"Error: Command blocked for safety reasons: {command}"

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.workspace),
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
    def __init__(self, workspace: Path, allowed_read_dirs: list[Path] | None = None):
        super().__init__("read", "Read files. Use relative path for workspace files, or absolute path for system files (read-only).")
        self.workspace = workspace
        self.allowed_read_dirs = allowed_read_dirs or []
        self.parameters = {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to read. Relative path = workspace, absolute path = system file (read-only)."
                }
            },
            "required": ["path"]
        }

    async def execute(self, path: str) -> str:
        try:
            # Determine if absolute or relative path
            if path.startswith("/") or path.startswith("~"):
                # Absolute path - resolve it
                file_path = Path(path).expanduser().resolve()
            else:
                # Relative path - within workspace
                file_path = (self.workspace / path).resolve()

            if not file_path.exists():
                return f"File not found: {path}"
            if not file_path.is_file():
                return f"Not a file: {path}"

            # Check read permission
            all_allowed = [self.workspace] + self.allowed_read_dirs
            if not is_safe_path(file_path, all_allowed):
                return f"Permission denied: Cannot read {path}"

            content = file_path.read_text(encoding="utf-8")
            return content[:10000]
        except PermissionError:
            return f"Permission denied: {path}"
        except Exception as e:
            return f"Error reading file: {str(e)}"


class WriteTool(BaseTool):
    def __init__(self, workspace: Path):
        super().__init__("write", "Write files to workspace (write permission limited to workspace only).")
        self.workspace = workspace
        self.parameters = {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The file path to write (relative to workspace only)"
                },
                "content": {
                    "type": "string",
                    "description": "The content to write to the file"
                }
            },
            "required": ["path", "content"]
        }

    async def execute(self, path: str, content: str) -> str:
        try:
            # Only allow relative paths (workspace only)
            if path.startswith("/") or path.startswith("~"):
                return f"Permission denied: Write access is limited to workspace. Use relative path."

            file_path = (self.workspace / path).resolve()

            # Ensure the resolved path is still within workspace
            if not is_safe_path(file_path, [self.workspace]):
                return f"Permission denied: Cannot write outside workspace"

            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding="utf-8")
            return f"Written to {path}"
        except PermissionError:
            return f"Permission denied: {path}"
        except Exception as e:
            return f"Error writing file: {str(e)}"


class EditTool(BaseTool):
    def __init__(self, workspace: Path):
        super().__init__("edit", "Edit files in workspace by replacing text (workspace only).")
        self.workspace = workspace
        self.parameters = {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "The file path to edit (relative to workspace only)"
                },
                "old": {
                    "type": "string",
                    "description": "The text to replace"
                },
                "new": {
                    "type": "string",
                    "description": "The new text to insert"
                }
            },
            "required": ["path", "old", "new"]
        }

    async def execute(self, path: str, old: str, new: str) -> str:
        try:
            # Only allow relative paths (workspace only)
            if path.startswith("/") or path.startswith("~"):
                return f"Permission denied: Edit access is limited to workspace. Use relative path."

            file_path = (self.workspace / path).resolve()

            # Ensure the resolved path is still within workspace
            if not is_safe_path(file_path, [self.workspace]):
                return f"Permission denied: Cannot edit outside workspace"

            if not file_path.exists():
                return f"File not found: {path}"
            content = file_path.read_text(encoding="utf-8")
            if old not in content:
                return "Pattern not found in file"
            new_content = content.replace(old, new)
            file_path.write_text(new_content, encoding="utf-8")
            return f"Edited {path}"
        except PermissionError:
            return f"Permission denied: {path}"
        except Exception as e:
            return f"Error editing file: {str(e)}"


class MCPTool(BaseTool):
    def __init__(self):
        super().__init__("mcp", "Execute MCP server tools")
        self.parameters = {
            "type": "object",
            "properties": {
                "server": {
                    "type": "string",
                    "description": "The MCP server name"
                },
                "tool": {
                    "type": "string",
                    "description": "The tool name to execute"
                },
                "arguments": {
                    "type": "object",
                    "description": "The arguments to pass to the tool",
                    "default": {}
                }
            },
            "required": ["server", "tool"]
        }

    async def execute(self, server: str, tool: str, arguments: dict | None = None, **kwargs) -> Any:
        from .mcp_client import call_mcp_tool
        return await call_mcp_tool(server, tool, arguments or kwargs or {})


class SendMessageTool(BaseTool):
    """Tool for sending messages to users during heartbeat"""

    def __init__(self, send_callback=None, sessions: list[dict] | None = None):
        super().__init__("send_message", "给对方发消息")
        self.send_callback = send_callback
        self.sessions = sessions or []
        self.parameters = {
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "string",
                    "description": "要发给谁的对话ID。" + (
                        "可选：" + ", ".join([s['session_id'] for s in self.sessions])
                        if self.sessions else ""
                    )
                },
                "message": {
                    "type": "string",
                    "description": "想说什么"
                }
            },
            "required": ["session_id", "message"]
        }
        self._sent_messages: list[dict] = []

    async def execute(self, session_id: str, message: str) -> str:
        """Execute the send message action"""
        # Validate session exists
        session_ids = [s['session_id'] for s in self.sessions]
        if session_id not in session_ids:
            available = ", ".join(session_ids) if session_ids else "没有可用的对话"
            return f"找不到这个对话: {session_id}。可选: {available}"

        result = {"session_id": session_id, "message": message}

        if self.send_callback:
            try:
                await self.send_callback(session_id, message)
                result["status"] = "sent"
                self._sent_messages.append(result)
                return f"消息已发送"
            except Exception as e:
                return f"发送失败: {str(e)}"
        else:
            # No callback, just record the message
            self._sent_messages.append(result)
            return f"消息准备发送: {message[:50]}..."

    def get_sent_messages(self) -> list[dict]:
        return self._sent_messages


class SkillTool(BaseTool):
    """Tool wrapper for invoking skills"""
    def __init__(self, skill):
        self.skill = skill
        super().__init__(f"skill_{skill.name}", f"Invoke skill: {skill.description}")
        self.parameters = {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "The prompt or task for this skill"
                }
            },
            "required": ["prompt"]
        }

    async def execute(self, prompt: str) -> str:
        """Execute the skill by appending its content to the context"""
        # Return the skill content as context for the LLM
        return f"[Skill: {self.skill.name}]\n{self.skill.content}\n\nUser request: {prompt}"


_TOOL_REGISTRY = {}


def register_tool(tool: BaseTool):
    _TOOL_REGISTRY[tool.name] = tool


def get_tool(name: str) -> BaseTool | None:
    return _TOOL_REGISTRY.get(name)


def init_tools(workspace: Path, allowed_read_dirs: list[Path] | None = None):
    """Initialize tools with workspace and optional read-only directories.

    Args:
        workspace: Agent's workspace directory (full read/write access)
        allowed_read_dirs: Additional directories with read-only access
    """
    # Default read-only directories
    home = Path.home()
    default_read_dirs = [
        home,  # Home directory
        home / "Desktop",  # Desktop
        home / "Documents",  # Documents
        home / "Downloads",  # Downloads
    ]

    # Filter to only existing directories
    default_read_dirs = [d for d in default_read_dirs if d.exists()]

    # Merge with user-provided dirs
    all_read_dirs = default_read_dirs + (allowed_read_dirs or [])

    register_tool(BashTool(workspace, all_read_dirs))
    register_tool(ReadTool(workspace, all_read_dirs))
    register_tool(WriteTool(workspace))
    register_tool(EditTool(workspace))
    register_tool(MCPTool())


def get_all_tools() -> list[BaseTool]:
    """Get all registered tools"""
    return list(_TOOL_REGISTRY.values())
