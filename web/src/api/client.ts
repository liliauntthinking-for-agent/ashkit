const API_BASE = '';

export interface Provider {
  name: string;
  api_base: string;
  has_key: boolean;
  models: string[];
}

export interface ProfileBase {
  name: string;
  nickname: string;
  gender: string;
  birthday: string;
  height: number | null;
  weight: number | null;
  blood_type: string;
  email: string;
  address: string;
  school: string;
  education: string;
  nationality: string;
  personality: string;
  hobbies: string;
  skills: string;
  mbti: string;
  background: string;
}

export interface AgentProfile extends ProfileBase {}

export interface UserProfile extends ProfileBase {
  occupation: string;
}

export interface Agent {
  agent_id: string;
  status: string;
  provider?: string;
  model?: string;
  profile?: AgentProfile;
  user_id?: string;
  relation?: string;
  mcp_servers?: string[];
}

export interface User {
  user_id: string;
  profile?: UserProfile;
}

interface Session {
  session_id: string;
  agent_id: string;
  name?: string;
  message_count: number;
}

interface Message {
  role: string;
  content: string;
}

export async function getProviders(): Promise<Provider[]> {
  const res = await fetch(`${API_BASE}/api/providers`);
  return res.json();
}

export async function createProvider(data: {
  name: string;
  api_key?: string;
  api_base?: string;
  models?: string[];
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/providers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to create provider');
  }
}

export async function deleteProvider(name: string): Promise<void> {
  await fetch(`${API_BASE}/api/providers/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function addModel(providerName: string, modelName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/providers/${encodeURIComponent(providerName)}/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(modelName),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to add model');
  }
}

export async function deleteModel(providerName: string, modelName: string): Promise<void> {
  await fetch(`${API_BASE}/api/providers/${encodeURIComponent(providerName)}/models/${encodeURIComponent(modelName)}`, {
    method: 'DELETE',
  });
}

export async function getAgents(): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/api/agents`);
  return res.json();
}

export async function getAgent(agentId: string): Promise<Agent> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}`);
  return res.json();
}

export async function createAgent(data: {
  agent_id: string;
  model: string;
  provider: string;
  profile?: AgentProfile;
  user_id?: string;
  relation?: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to create agent');
  }
}

export async function deleteAgent(agentId: string): Promise<void> {
  await fetch(`${API_BASE}/api/agents/${agentId}`, { method: 'DELETE' });
}

export async function updateAgent(agentId: string, data: {
  profile?: AgentProfile;
  user_id?: string;
  relation?: string;
  mcp_servers?: string[];
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to update agent');
  }
}

export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/api/users`);
  return res.json();
}

export async function getUser(userId: string): Promise<User> {
  const res = await fetch(`${API_BASE}/api/users/${userId}`);
  return res.json();
}

export async function createUser(data: {
  user_id: string;
  profile?: UserProfile;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to create user');
  }
}

export async function updateUser(userId: string, profile: UserProfile): Promise<void> {
  const res = await fetch(`${API_BASE}/api/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to update user');
  }
}

export async function deleteUser(userId: string): Promise<void> {
  await fetch(`${API_BASE}/api/users/${userId}`, { method: 'DELETE' });
}

export async function getSessions(agentId?: string): Promise<Session[]> {
  const url = agentId 
    ? `${API_BASE}/api/sessions?agent_id=${encodeURIComponent(agentId)}`
    : `${API_BASE}/api/sessions`;
  const res = await fetch(url);
  return res.json();
}

export async function createSession(agentId: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: '', agent_id: agentId }),
  });
  return res.json();
}

export async function getSession(sessionId: string, limit = 50, offset = 0): Promise<{
  session_id: string;
  agent_id: string;
  messages: Message[];
  total_count: number;
  has_more: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}?limit=${limit}&offset=${offset}`);
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to clear messages');
  }
}

export async function sendMessage(
  sessionId: string,
  message: string,
  stream: boolean
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message, stream }),
  });
  const data = await res.json();
  return data.response || '';
}

export interface ToolCallInfo {
  name: string;
  args: string;
}

export interface ToolResult {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface StreamEvent {
  type: 'content' | 'tool_start' | 'tool_result' | 'thinking';
  content?: string;
  tools?: ToolCallInfo[];
  toolResult?: ToolResult;
  thinking?: string;
}

export async function* streamMessage(
  sessionId: string,
  message: string
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message, stream: true }),
  });

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              const content = data.content;
              
              if (content.includes('__THINKING__')) {
                const match = content.match(/__THINKING__(.+?)__THINKING_END__/);
                if (match) {
                  yield { type: 'thinking', thinking: match[1] };
                }
              } else if (content.includes('__TOOL_START__')) {
                const match = content.match(/__TOOL_START__(.+?)__TOOL_END__/);
                if (match) {
                  yield { type: 'tool_start', tools: JSON.parse(match[1]) };
                }
              } else if (content.includes('__TOOL_RESULT__')) {
                const match = content.match(/__TOOL_RESULT__(.+?)__TOOL_END__/);
                if (match) {
                  yield { type: 'tool_result', toolResult: JSON.parse(match[1]) };
                }
              } else {
                yield { type: 'content', content };
              }
            }
          } catch {}
        }
      }
    }
  } finally {
    reader.cancel();
  }
}

export async function getMemory(agentId: string): Promise<{
  l1_working: { messages: Message[] };
  l2_episodic: { summary: string; created_at: string }[];
  l3_semantic: { content: string }[];
}> {
  const res = await fetch(`${API_BASE}/api/memory/${agentId}`);
  return res.json();
}

export async function addL3Memory(agentId: string, content: string): Promise<void> {
  await fetch(`${API_BASE}/api/memory/${agentId}/l3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export interface Skill {
  skill_id: string;
  name: string;
  description: string;
  content?: string;
  path?: string;
  builtin?: boolean;
}

export async function getSkills(agentId?: string): Promise<Skill[]> {
  const url = agentId 
    ? `${API_BASE}/api/skills?agent_id=${encodeURIComponent(agentId)}`
    : `${API_BASE}/api/skills`;
  const res = await fetch(url);
  return res.json();
}

export async function getSkill(skillId: string, agentId?: string): Promise<Skill> {
  const url = agentId
    ? `${API_BASE}/api/skills/${skillId}?agent_id=${encodeURIComponent(agentId)}`
    : `${API_BASE}/api/skills/${skillId}`;
  const res = await fetch(url);
  return res.json();
}

export async function deleteSkill(skillId: string, agentId: string): Promise<void> {
  await fetch(`${API_BASE}/api/skills/${skillId}?agent_id=${encodeURIComponent(agentId)}`, { method: 'DELETE' });
}

export async function invokeSkill(skillId: string, prompt: string, agentId: string): Promise<{ session_id: string; result: string }> {
  const res = await fetch(`${API_BASE}/api/skills/${skillId}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, agent_id: agentId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to invoke skill');
  }
  return res.json();
}

export interface MCPServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  proxy?: string;
}

export async function getMCPServers(): Promise<Record<string, MCPServer>> {
  const res = await fetch(`${API_BASE}/api/mcp/servers`);
  return res.json();
}

export async function addMCPServer(name: string, config: MCPServer): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mcp/servers/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to add MCP server');
  }
}

export async function deleteMCPServer(name: string): Promise<void> {
  await fetch(`${API_BASE}/api/mcp/servers/${name}`, { method: 'DELETE' });
}

export interface MCPTool {
  server: string;
  name: string;
  description: string;
  input_schema: any;
}

export async function getMCPTools(): Promise<MCPTool[]> {
  const res = await fetch(`${API_BASE}/api/mcp/tools`);
  return res.json();
}

// Heartbeat APIs
export interface HeartbeatConfig {
  enabled: boolean;
  interval_minutes: number;
  prompt: string;
}

export interface HeartbeatStatus {
  agent_id: string;
  heartbeat: HeartbeatConfig | null;
  is_running: boolean;
}

export interface HeartbeatLog {
  id: number;
  agent_id: string;
  prompt: string;
  response: string;
  created_at: string;
}

export async function getAgentHeartbeat(agentId: string): Promise<HeartbeatStatus> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/heartbeat`);
  return res.json();
}

export async function updateAgentHeartbeat(agentId: string, config: HeartbeatConfig): Promise<HeartbeatStatus> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/heartbeat`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to update heartbeat');
  }
  return res.json();
}

export async function triggerHeartbeat(agentId: string, prompt?: string): Promise<{ response: string; memory_context: string }> {
  const url = prompt
    ? `${API_BASE}/api/agents/${agentId}/heartbeat/trigger?prompt=${encodeURIComponent(prompt)}`
    : `${API_BASE}/api/agents/${agentId}/heartbeat/trigger`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to trigger heartbeat');
  }
  return res.json();
}

export async function getHeartbeatLogs(agentId: string, limit = 20): Promise<{ agent_id: string; logs: HeartbeatLog[] }> {
  const res = await fetch(`${API_BASE}/api/agents/${agentId}/heartbeat/logs?limit=${limit}`);
  return res.json();
}

export async function clearHeartbeatLogs(agentId: string): Promise<void> {
  await fetch(`${API_BASE}/api/agents/${agentId}/heartbeat/logs`, { method: 'DELETE' });
}