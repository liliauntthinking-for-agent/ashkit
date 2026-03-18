# Ashkit

轻量级个人 AI 助手，支持飞书、三层记忆系统、MCP 和技能扩展。

## 功能特性

- **多渠道支持**: 飞书机器人集成
- **三层记忆系统**: L1 工作记忆、L2 情景记忆、L3 语义记忆（FAISS 向量检索）
- **技能系统**: 从工作空间动态加载技能
- **工具集成**: Bash、Read、Write、Edit、MCP 工具
- **Web 管理界面**: React + TypeScript 构建的管理后台
- **Provider 管理**: 可视化管理模型提供商和模型

## 安装

```bash
# 克隆仓库
git clone <repo-url>
cd ashkit

# 使用 uv 安装依赖
uv sync

# 安装前端依赖并构建
cd web && npm install && npm run build && cd ..
```

## 配置

创建配置文件 `~/.ashkit/config.json`：

```json
{
  "providers": {
    "custom": {
      "apiKey": "your-api-key",
      "apiBase": "https://api.openai.com/v1",
      "models": ["gpt-4o", "gpt-4o-mini"]
    }
  },
  "channels": {
    "feishu": {
      "enabled": false,
      "app_id": "",
      "app_secret": "",
      "encrypt_key": "",
      "verification_token": ""
    }
  },
  "agents": {
    "defaults": {
      "model": "gpt-4o",
      "provider": "custom",
      "workspace": "~/.ashkit/workspace"
    }
  },
  "memory": {
    "l1_max_tokens": 64000,
    "l2_retention": 100,
    "l3_enabled": true
  },
  "gateway": {
    "host": "127.0.0.1",
    "port": 38471
  },
  "web": {
    "host": "127.0.0.1",
    "port": 47291
  }
}
```

## 使用方法

### 启动 Web 服务

```bash
uv run python -m ashkit web
```

访问 http://127.0.0.1:47291 打开管理后台。

### 网关模式（飞书）

```bash
uv run python -m ashkit gateway
```

### 命令行模式

```bash
uv run python -m ashkit agent
```

### 指定配置文件

```bash
uv run python -m ashkit web --config /path/to/config.json
uv run python -m ashkit gateway --workspace ~/.ashkit/workspace
```

## Web 管理界面

### Provider 管理

- 添加/删除模型提供商
- 配置 API Key 和 Base URL
- 管理提供商下的模型列表

### Agent 管理

- 从已配置的 Provider 和模型中选择创建 Agent
- 查看和管理 Agent 状态

### 对话测试

- 与 Agent 进行对话测试
- 支持流式响应

### 记忆查看

- 查看 L1 短期记忆
- 查看 L2 情景记忆
- 查看 L3 语义记忆
- 手动添加语义记忆

## API 接口

### Provider 管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/providers` | 获取所有 Provider |
| POST | `/api/providers` | 创建 Provider |
| GET | `/api/providers/{name}` | 获取单个 Provider |
| PATCH | `/api/providers/{name}` | 更新 Provider |
| DELETE | `/api/providers/{name}` | 删除 Provider |
| GET | `/api/providers/{name}/models` | 获取 Provider 的模型列表 |
| POST | `/api/providers/{name}/models` | 添加模型 |
| DELETE | `/api/providers/{name}/models/{model}` | 删除模型 |

### Agent 管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/agents` | 获取所有 Agent |
| POST | `/api/agents` | 创建 Agent |
| GET | `/api/agents/{id}` | 获取 Agent 信息 |
| PATCH | `/api/agents/{id}` | 更新 Agent |
| DELETE | `/api/agents/{id}` | 删除 Agent |

### 会话管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/sessions` | 获取会话列表 |
| POST | `/api/sessions` | 创建会话 |
| POST | `/api/sessions/{id}/messages` | 发送消息（支持流式） |

### 记忆管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/memory/{agent_id}` | 获取 Agent 记忆 |
| POST | `/api/memory/{agent_id}/l3` | 添加语义记忆 |

## 记忆系统

### L1 - 工作记忆
- 当前对话上下文
- 内存存储
- 可配置 token 限制（默认 64000）

### L2 - 情景记忆
- 历史对话摘要
- SQLite 存储
- 自动摘要压缩

### L3 - 语义记忆
- 长期知识存储
- FAISS 向量索引
- 自动向量化

## 技能系统

将技能目录放在 `~/.ashkit/workspace/skills/` 下，每个技能包含 `SKILL.md` 文件：

```
skills/
├── example-skill/
│   └── SKILL.md
└── another-skill/
    └── SKILL.md
```

## 前端开发

```bash
cd web

# 开发模式
npm run dev

# 构建
npm run build
```

## 项目结构

```
ashkit/
├── src/ashkit/
│   ├── __init__.py      # 入口点
│   ├── __main__.py      # CLI 处理
│   ├── agent.py         # Agent 核心 + LLM 客户端
│   ├── config.py        # 配置管理
│   ├── gateway.py       # 多 Agent 网关
│   ├── memory.py        # L1/L2/L3 记忆系统
│   ├── skills.py        # 技能加载器
│   ├── tools.py         # 工具实现
│   ├── web.py           # FastAPI Web 服务
│   ├── channels/
│   │   └── feishu.py    # 飞书渠道
│   └── web/dist/        # 前端构建产物
├── web/                 # React 前端项目
│   ├── src/
│   │   ├── api/         # API 客户端
│   │   ├── components/  # React 组件
│   │   └── App.tsx      # 主应用
│   └── vite.config.ts   # Vite 配置
├── config.example.json  # 配置示例
└── pyproject.toml       # 项目元数据
```

## 许可证

MIT