const API_BASE = '';

interface Provider {
  name: string;
  api_base: string;
  has_key: boolean;
  models: string[];
}

interface Agent {
  agent_id: string;
  status: string;
  provider?: string;
  model?: string;
}

interface Session {
  session_id: string;
  agent_id: string;
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

export async function getSession(sessionId: string): Promise<{
  session_id: string;
  agent_id: string;
  messages: Message[];
}> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' });
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

export async function* streamMessage(
  sessionId: string,
  message: string
): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message, stream: true }),
  });

  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.content) yield data.content;
        } catch {}
      }
    }
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