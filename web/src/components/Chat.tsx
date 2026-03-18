import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../api/client';

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

export function Chat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamMode, setStreamMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadAgents = useCallback(async () => {
    try {
      const data = await api.getAgents();
      setAgents(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    loadSessions();
  }, [loadAgents, loadSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectSession = async (sessionId: string) => {
    try {
      const session = await api.getSession(sessionId);
      setSelectedSession(sessionId);
      setSelectedAgent(session.agent_id);
      setMessages(session.messages || []);
      setShowNewSession(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除此会话?')) return;
    
    await api.deleteSession(sessionId);
    loadSessions();
    
    if (selectedSession === sessionId) {
      setSelectedSession(null);
      setMessages([]);
    }
  };

  const handleNewSession = () => {
    setShowNewSession(true);
    setSelectedSession(null);
    setMessages([]);
  };

  const handleCreateSession = () => {
    if (!selectedAgent) {
      alert('请选择 Agent');
      return;
    }
    setShowNewSession(false);
    setSelectedSession(selectedAgent);
    loadSessions();
  };

  const handleSend = async () => {
    let sessionId = selectedSession;
    
    if (!sessionId) {
      if (!selectedAgent) {
        alert('请选择 Agent');
        return;
      }
      sessionId = selectedAgent;
      setSelectedSession(sessionId);
    }

    if (!input.trim()) {
      alert('请输入消息');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      if (streamMode) {
        let responseText = '';
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        for await (const chunk of api.streamMessage(sessionId!, userMessage)) {
          responseText += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: responseText };
            return updated;
          });
        }
      } else {
        const response = await api.sendMessage(sessionId, userMessage, false);
        setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
      }
      
      loadSessions();
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: ' + e.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <button className="btn btn-primary new-session-btn" onClick={handleNewSession}>
          + 新会话
        </button>
        
        <div className="session-list">
          {sessions.length === 0 ? (
            <div className="session-empty">暂无会话</div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.session_id}
                className={`session-item ${selectedSession === s.session_id ? 'active' : ''}`}
                onClick={() => handleSelectSession(s.session_id)}
              >
                <div className="session-info">
                  <div className="session-id">{s.session_id}</div>
                  <div className="session-meta">
                    {s.agent_id} · {s.message_count} 条消息
                  </div>
                </div>
                <button
                  className="session-delete"
                  onClick={(e) => handleDeleteSession(s.session_id, e)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-main">
        {showNewSession ? (
          <div className="card new-session-form">
            <h2>新会话</h2>
            <div className="form-group">
              <label>选择 Agent</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
              >
                <option value="">请选择 Agent</option>
                {agents.map((a) => (
                  <option key={a.agent_id} value={a.agent_id}>
                    {a.agent_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleCreateSession}>
                开始对话
              </button>
              <button className="btn btn-secondary" onClick={() => setShowNewSession(false)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-header">
              {selectedSession ? (
                <span>会话: {selectedSession}</span>
              ) : (
                <span>请选择会话或创建新会话</span>
              )}
              <label className="stream-toggle">
                <input
                  type="checkbox"
                  checked={streamMode}
                  onChange={(e) => setStreamMode(e.target.checked)}
                />
                流式响应
              </label>
            </div>

            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty">发送消息开始对话</div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`message message-${msg.role}`}>
                    <div className="message-role">
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className="message-content">{msg.content}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
              <textarea
                placeholder="输入消息..."
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || !selectedSession && !selectedAgent}
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={loading}
              >
                发送
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}