import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { 
  ChatCircle, Plus, Trash, PaperPlaneTilt, 
  Spinner, User, Robot, Sparkle 
} from '@phosphor-icons/react';
import { useToast } from './Toast';
import * as api from '../api/client';

interface Agent {
  agent_id: string;
  status: string;
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
  const showToast = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamMode, setStreamMode] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState<Set<string>>(new Set());
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
      setCurrentAgentId(session.agent_id);
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
    showToast('已删除');
    
    if (selectedSession === sessionId) {
      setSelectedSession(null);
      setMessages([]);
    }
  };

  const handleNewSession = () => {
    setShowNewSession(true);
    setSelectedSession(null);
    setMessages([]);
    setCurrentAgentId('');
  };

  const handleCreateSession = async () => {
    if (!currentAgentId) {
      showToast('请选择 Agent', 'error');
      return;
    }
    
    try {
      const session = await api.createSession(currentAgentId);
      setSelectedSession(session.session_id);
      setShowNewSession(false);
      setMessages([]);
      loadSessions();
      showToast('会话已创建');
    } catch (e: any) {
      showToast('创建会话失败: ' + e.message, 'error');
    }
  };

  const handleSend = async () => {
    if (!selectedSession) {
      showToast('请先创建会话', 'error');
      return;
    }

    if (!input.trim()) {
      showToast('请输入消息', 'error');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoadingSessions((prev) => new Set(prev).add(selectedSession));

    try {
      if (streamMode) {
        let responseText = '';
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        for await (const chunk of api.streamMessage(selectedSession, userMessage)) {
          responseText += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: responseText };
            return updated;
          });
        }
      } else {
        const response = await api.sendMessage(selectedSession, userMessage, false);
        setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
      }
      
      loadSessions();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setLoadingSessions((prev) => {
        const next = new Set(prev);
        next.delete(selectedSession);
        return next;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = selectedSession ? loadingSessions.has(selectedSession) : false;

  return (
    <div className="flex gap-6 h-[calc(100dvh-140px)]">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 flex flex-col h-full">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-4
            bg-[var(--color-accent)] text-white rounded-xl font-medium text-sm
            shadow-lg shadow-[var(--color-accent)]/10 hover:shadow-xl transition-shadow"
        >
          <Plus className="w-4 h-4" weight="bold" />
          新会话
        </motion.button>
        
        <div className="flex-1 bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[var(--color-border)] flex-shrink-0">
            <h3 className="text-xs font-semibold text-[var(--color-accent-muted)] uppercase tracking-wider">
              会话历史
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sessions.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--color-accent-muted)]">
                <ChatCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                暂无会话
              </div>
            ) : (
              <div className="p-2">
                {sessions.map((s, index) => (
                  <motion.div
                    key={s.session_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectSession(s.session_id)}
                    className={`
                      group flex items-center justify-between p-3 rounded-xl cursor-pointer
                      transition-colors duration-200
                      ${selectedSession === s.session_id 
                        ? 'bg-[var(--color-surface)] shadow-sm' 
                        : 'hover:bg-[var(--color-surface)]/50'
                      }
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--color-accent)] truncate">
                        {s.session_id}
                      </div>
                      <div className="text-xs text-[var(--color-accent-muted)] mt-0.5">
                        {s.agent_id} · {s.message_count} 条消息
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.session_id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                        hover:bg-red-50 text-[var(--color-accent-muted)] hover:text-red-500
                        transition-all"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden h-full">
        <AnimatePresence mode="wait">
          {showNewSession ? (
            <motion.div
              key="new-session"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex items-center justify-center p-8"
            >
              <div className="w-full max-w-sm space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--color-surface)] 
                    flex items-center justify-center mb-4">
                    <Sparkle className="w-6 h-6 text-[var(--color-accent)]" weight="duotone" />
                  </div>
                  <h2 className="text-xl font-semibold text-[var(--color-accent)]">创建新会话</h2>
                  <p className="text-sm text-[var(--color-accent-muted)]">选择一个 Agent 开始对话</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                      选择 Agent
                    </label>
                    <select
                      value={currentAgentId}
                      onChange={(e) => setCurrentAgentId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm text-[var(--color-accent)] focus:outline-none focus:ring-2 
                        focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]
                        transition-all"
                    >
                      <option value="">请选择 Agent</option>
                      {agents.map((a) => (
                        <option key={a.agent_id} value={a.agent_id}>
                          {a.agent_id}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCreateSession}
                      className="flex-1 px-4 py-2.5 bg-[var(--color-accent)] text-white 
                        rounded-xl font-medium text-sm hover:bg-[var(--color-accent)]/90 transition-colors"
                    >
                      开始对话
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowNewSession(false)}
                      className="px-4 py-2.5 bg-[var(--color-surface)] text-[var(--color-accent-muted)]
                        rounded-xl font-medium text-sm hover:bg-[var(--color-surface-elevated)] transition-colors"
                    >
                      取消
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <div className="text-sm font-medium text-[var(--color-accent)]">
                  {selectedSession ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {selectedSession}
                    </span>
                  ) : (
                    <span className="text-[var(--color-accent-muted)]">请选择会话或创建新会话</span>
                  )}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-[var(--color-accent-muted)]">流式响应</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={streamMode}
                      onChange={(e) => setStreamMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[var(--color-surface)] rounded-full peer-checked:bg-[var(--color-accent)]
                      transition-colors duration-200" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm
                      peer-checked:translate-x-4 transition-transform duration-200" />
                  </div>
                </label>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-[var(--color-accent-muted)]">
                      <ChatCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">发送消息开始对话</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${msg.role === 'user' 
                          ? 'bg-[var(--color-accent)]' 
                          : 'bg-[var(--color-surface)]'
                        }
                      `}>
                        {msg.role === 'user' ? (
                          <User className="w-4 h-4 text-white" weight="duotone" />
                        ) : (
                          <Robot className="w-4 h-4 text-[var(--color-accent)]" weight="duotone" />
                        )}
                      </div>
                      <div className={`
                        max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                        ${msg.role === 'user' 
                          ? 'bg-[var(--color-accent)] text-white rounded-tr-md' 
                          : 'bg-[var(--color-surface)] text-[var(--color-accent)] rounded-tl-md'
                        }
                      `}>
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        ) : (
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
                {/* Loading indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--color-surface)]">
                      <Robot className="w-4 h-4 text-[var(--color-accent)]" weight="duotone" />
                    </div>
                    <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tl-md bg-[var(--color-surface)] text-[var(--color-accent)] text-sm">
                      <div className="flex items-center gap-1">
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                          className="w-2 h-2 rounded-full bg-[var(--color-accent-muted)]"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                          className="w-2 h-2 rounded-full bg-[var(--color-accent-muted)]"
                        />
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                          className="w-2 h-2 rounded-full bg-[var(--color-accent-muted)]"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-[var(--color-border)]">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      placeholder="输入消息..."
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading || !selectedSession}
                      className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm resize-none focus:outline-none focus:ring-2 
                        focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]
                        disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSend}
                    disabled={isLoading || !selectedSession}
                    className="w-12 h-12 flex items-center justify-center
                      bg-[var(--color-accent)] text-white rounded-xl
                      disabled:opacity-50 disabled:cursor-not-allowed
                      hover:bg-[var(--color-accent)]/90 transition-colors"
                  >
                    {isLoading ? (
                      <Spinner className="w-5 h-5 animate-spin" />
                    ) : (
                      <PaperPlaneTilt className="w-5 h-5" weight="fill" />
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}