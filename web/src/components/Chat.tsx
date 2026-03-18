import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../api/client';

interface Agent {
  agent_id: string;
  status: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function Chat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamMode, setStreamMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadAgents = useCallback(async () => {
    try {
      const data = await api.getAgents();
      setAgents(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!selectedAgent) {
      alert('请选择 Agent');
      return;
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

        for await (const chunk of api.streamMessage(selectedAgent, userMessage)) {
          responseText += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: responseText };
            return updated;
          });
        }
      } else {
        const response = await api.sendMessage(selectedAgent, userMessage, false);
        setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
      }
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
    <div className="card">
      <h2>对话测试</h2>
      <div className="form-group">
        <label>选择 Agent</label>
        <select
          value={selectedAgent}
          onChange={(e) => {
            setSelectedAgent(e.target.value);
            setMessages([]);
          }}
        >
          <option value="">请先创建 Agent</option>
          {agents.map((a) => (
            <option key={a.agent_id} value={a.agent_id}>
              {a.agent_id}
            </option>
          ))}
        </select>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty">发送消息开始对话</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message message-${msg.role}`}>
              <div className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
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
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={loading}
        >
          发送
        </button>
      </div>

      <div style={{ marginTop: '12px' }}>
        <label>
          <input
            type="checkbox"
            checked={streamMode}
            onChange={(e) => setStreamMode(e.target.checked)}
          />{' '}
          流式响应
        </label>
      </div>
    </div>
  );
}