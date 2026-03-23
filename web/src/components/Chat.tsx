import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatCircle, Plus, Trash, PaperPlaneTilt,
  Spinner, User, Robot, Sparkle, Wrench, CaretDown, CaretRight, Brain, Eraser
} from '@phosphor-icons/react';
import { useToast } from './Toast';
import { useApp } from '../AppContext';
import * as api from '../api/client';

interface Agent {
  agent_id: string;
  status: string;
}

interface Session {
  session_id: string;
  agent_id: string;
  name?: string;
  message_count: number;
}

interface ToolCall {
  name: string;
  args: string;
  result?: string;
  status?: 'pending' | 'success' | 'error';
  expanded?: boolean;
}

interface ThinkingBlock {
  content: string;
  expanded?: boolean;
}

interface TimelineEvent {
  type: 'thinking' | 'tool';
  data: ThinkingBlock | ToolCall;
}

interface Message {
  role: string;
  content: string;
  timeline?: TimelineEvent[];
}

function parseTimelineFromContent(content: string): { content: string; timeline?: TimelineEvent[] } {
  const timeline: TimelineEvent[] = [];
  let cleanContent = content;
  
  // Parse thinking blocks
  const thinkingRegex = /__THINKING__(.+?)__THINKING_END__/g;
  let match;
  while ((match = thinkingRegex.exec(content)) !== null) {
    timeline.push({
      type: 'thinking',
      data: { content: match[1], expanded: false }
    });
    cleanContent = cleanContent.replace(match[0], '');
  }
  
  // Parse tool calls and results
  const toolStartRegex = /__TOOL_START__(.+?)__TOOL_END__/g;
  const toolResults: Record<string, { args: string; result: string }> = {};
  
  // First pass: collect tool results
  const toolResultRegex = /__TOOL_RESULT__(.+?)__TOOL_END__/g;
  while ((match = toolResultRegex.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const key = data.name;
      toolResults[key] = { args: JSON.stringify(data.args, null, 2), result: data.result };
      cleanContent = cleanContent.replace(match[0], '');
    } catch {}
  }
  
  // Second pass: parse tool starts
  while ((match = toolStartRegex.exec(content)) !== null) {
    try {
      const tools = JSON.parse(match[1]);
      for (const t of tools) {
        let formattedArgs = t.args;
        try {
          const parsed = JSON.parse(t.args);
          formattedArgs = JSON.stringify(parsed, null, 2);
        } catch {}
        
        const toolResult = toolResults[t.name];
        timeline.push({
          type: 'tool',
          data: {
            name: t.name,
            args: toolResult?.args || formattedArgs,
            result: toolResult?.result,
            status: toolResult ? 'success' : 'pending',
            expanded: false
          }
        });
      }
      cleanContent = cleanContent.replace(match[0], '');
    } catch {}
  }
  
  return {
    content: cleanContent.trim(),
    timeline: timeline.length > 0 ? timeline : undefined
  };
}

function ThinkingCard({ thinking, onToggle }: { thinking: ThinkingBlock; onToggle: () => void }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg mb-2 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-amber-100/50 transition-colors"
      >
        {thinking.expanded ? (
          <CaretDown className="w-4 h-4 text-amber-600" />
        ) : (
          <CaretRight className="w-4 h-4 text-amber-600" />
        )}
        <Brain className="w-4 h-4 text-amber-600" weight="duotone" />
        <span className="font-medium text-amber-700">思考过程</span>
      </button>
      <AnimatePresence>
        {thinking.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-amber-200"
          >
            <div className="p-3">
              <pre className="text-xs text-amber-800 whitespace-pre-wrap">{thinking.content}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolCallCard({ toolCall, onToggle }: { toolCall: ToolCall; onToggle: () => void }) {
  const statusColor = toolCall.status === 'error' ? 'text-red-600' : toolCall.status === 'success' ? 'text-green-600' : 'text-amber-600';
  const statusIcon = toolCall.status === 'error' ? '✗' : toolCall.status === 'success' ? '✓' : '⟳';
  
  return (
    <div className={`bg-[var(--color-surface)] border rounded-lg mb-2 overflow-hidden ${toolCall.status === 'error' ? 'border-red-200' : 'border-[var(--color-border)]'}`}>
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-white/50 transition-colors"
      >
        {toolCall.expanded ? (
          <CaretDown className="w-4 h-4 text-[var(--color-accent-muted)]" />
        ) : (
          <CaretRight className="w-4 h-4 text-[var(--color-accent-muted)]" />
        )}
        <Wrench className="w-4 h-4 text-[var(--color-accent)]" weight="duotone" />
        <span className="font-medium text-[var(--color-accent)]">{toolCall.name}</span>
        {toolCall.status && (
          <span className={`text-xs ml-auto ${statusColor}`}>{statusIcon} {toolCall.status}</span>
        )}
      </button>
      <AnimatePresence>
        {toolCall.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[var(--color-border)]"
          >
            <div className="p-3 space-y-2">
              <div>
                <div className="text-xs font-medium text-[var(--color-accent-muted)] mb-1">参数</div>
                <pre className="text-xs bg-white/50 p-2 rounded border border-[var(--color-border)] overflow-x-auto">
                  {toolCall.args}
                </pre>
              </div>
              {toolCall.result !== undefined && (
                <div>
                  <div className="text-xs font-medium text-[var(--color-accent-muted)] mb-1">结果</div>
                  <pre className={`text-xs p-2 rounded border overflow-x-auto max-h-40 overflow-y-auto ${toolCall.status === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white/50 border-[var(--color-border)]'}`}>
                    {toolCall.result}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Chat() {
  const showToast = useToast();
  const { selectedSessionId, setSelectedSessionId } = useApp();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streamMode, setStreamMode] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState<Set<string>>(new Set());
  const [showNewSession, setShowNewSession] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesMapRef = useRef<Map<string, Message[]>>(new Map());
  const selectedSessionRef = useRef<string | null>(null);
  const shouldSmoothScrollRef = useRef(false);

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

  const handleSelectSession = useCallback(async (sessionId: string) => {
    setSelectedSession(sessionId);
    selectedSessionRef.current = sessionId;

    const cached = messagesMapRef.current.get(sessionId);
    if (cached) {
      setMessages(cached);
    }

    try {
      const session = await api.getSession(sessionId, 50, 0);
      setCurrentAgentId(session.agent_id);
      setHasMore(session.has_more);
      if (!cached) {
        // Parse messages - use metadata.timeline if available, otherwise parse from content
        const parsedMessages = (session.messages || []).map((m: any) => {
          let timeline: TimelineEvent[] | undefined;

          // Use metadata.timeline from server if available
          if (m.metadata?.timeline) {
            timeline = m.metadata.timeline.map((t: any) => {
              if (t.type === 'thinking') {
                return {
                  type: 'thinking' as const,
                  data: { content: t.content, expanded: false }
                };
              } else {
                return {
                  type: 'tool' as const,
                  data: {
                    name: t.name,
                    args: typeof t.args === 'string' ? t.args : JSON.stringify(t.args, null, 2),
                    result: t.result,
                    status: t.result ? 'success' : 'pending',
                    expanded: false
                  }
                };
              }
            });
          } else {
            // Fallback: parse from content
            const parsed = parseTimelineFromContent(m.content);
            if (parsed.timeline) {
              timeline = parsed.timeline;
            }
          }

          return {
            role: m.role,
            content: m.content,
            timeline
          };
        });
        setMessages(parsedMessages);
        messagesMapRef.current.set(sessionId, parsedMessages);
        // Scroll to bottom on initial load
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        });
      }
      setShowNewSession(false);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!selectedSession || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    try {
      const offset = messages.length;
      const session = await api.getSession(selectedSession, 50, offset);

      // Parse older messages
      const olderMessages = (session.messages || []).map((m: any) => {
        let timeline: TimelineEvent[] | undefined;

        if (m.metadata?.timeline) {
          timeline = m.metadata.timeline.map((t: any) => {
            if (t.type === 'thinking') {
              return {
                type: 'thinking' as const,
                data: { content: t.content, expanded: false }
              };
            } else {
              return {
                type: 'tool' as const,
                data: {
                  name: t.name,
                  args: typeof t.args === 'string' ? t.args : JSON.stringify(t.args, null, 2),
                  result: t.result,
                  status: t.result ? 'success' : 'pending',
                  expanded: false
                }
              };
            }
          });
        } else {
          const parsed = parseTimelineFromContent(m.content);
          if (parsed.timeline) {
            timeline = parsed.timeline;
          }
        }

        return {
          role: m.role,
          content: m.content,
          timeline
        };
      });

      // Prepend older messages
      const newMessages = [...olderMessages, ...messages];
      setMessages(newMessages);
      messagesMapRef.current.set(selectedSession, newMessages);
      setHasMore(session.has_more);

      // Restore scroll position after loading
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [selectedSession, loadingMore, hasMore, messages]);

  // Handle scroll to load more
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    // When scrolled to top (within 100px), load more
    if (container.scrollTop < 100 && hasMore && !loadingMore && messages.length > 0) {
      handleLoadMore();
    }
  }, [hasMore, loadingMore, messages.length, handleLoadMore]);

  useEffect(() => {
    loadAgents();
    loadSessions();
  }, [loadAgents, loadSessions]);

  useEffect(() => {
    if (selectedSessionId) {
      handleSelectSession(selectedSessionId);
      setSelectedSessionId(null);
    }
  }, [selectedSessionId, setSelectedSessionId, handleSelectSession]);

  useEffect(() => {
    // Only scroll when shouldSmoothScrollRef is true (new message sent)
    // Don't scroll on expand/collapse or load more
    if (shouldSmoothScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldSmoothScrollRef.current = false;
    }
  }, [messages]);

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

  const handleClearMessages = async () => {
    if (!selectedSession) return;
    if (!confirm('确定清空当前对话? 这将删除所有消息但保留会话。')) return;

    try {
      await api.clearSessionMessages(selectedSession);
      setMessages([]);
      setHasMore(false);
      messagesMapRef.current.set(selectedSession, []);
      loadSessions();
      showToast('对话已清空');
    } catch (e: any) {
      showToast('清空失败: ' + e.message, 'error');
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
    const sessionId = selectedSession;
    setInput('');
    
    const currentMessages = messagesMapRef.current.get(sessionId) || [];
    const newMessages = [...currentMessages, { role: 'user' as const, content: userMessage }];
    messagesMapRef.current.set(sessionId, newMessages);
    if (selectedSessionRef.current === sessionId) {
      shouldSmoothScrollRef.current = true;
      setMessages(newMessages);
    }
    setLoadingSessions((prev) => new Set(prev).add(sessionId));

    try {
      if (streamMode) {
        let responseText = '';
        let timeline: TimelineEvent[] = [];
        const streamMessages = [...newMessages, { role: 'assistant' as const, content: '', timeline: [] }];
        messagesMapRef.current.set(sessionId, streamMessages);
        if (selectedSessionRef.current === sessionId) {
          setMessages(streamMessages);
        }

        for await (const event of api.streamMessage(sessionId, userMessage)) {
          if (event.type === 'thinking' && event.thinking) {
            timeline = [...timeline, { type: 'thinking' as const, data: { content: event.thinking, expanded: false } }];
            const updated = messagesMapRef.current.get(sessionId) || [];
            if (updated.length > 0) {
              updated[updated.length - 1] = { 
                role: 'assistant', 
                content: responseText,
                timeline
              };
              messagesMapRef.current.set(sessionId, [...updated]);
              if (selectedSessionRef.current === sessionId) {
                setMessages([...updated]);
              }
            }
          } else if (event.type === 'content' && event.content) {
            responseText += event.content;
            const updated = messagesMapRef.current.get(sessionId) || [];
            if (updated.length > 0) {
              updated[updated.length - 1] = { 
                role: 'assistant', 
                content: responseText,
                timeline: timeline.length > 0 ? timeline : undefined
              };
              messagesMapRef.current.set(sessionId, [...updated]);
              if (selectedSessionRef.current === sessionId) {
                setMessages([...updated]);
              }
            }
          } else if (event.type === 'tool_start' && event.tools) {
            // Add new tool calls to timeline
            for (const t of event.tools) {
              let formattedArgs = t.args;
              try {
                const parsed = JSON.parse(t.args);
                formattedArgs = JSON.stringify(parsed, null, 2);
              } catch {}
              timeline = [...timeline, { 
                type: 'tool' as const, 
                data: {
                  name: t.name,
                  args: formattedArgs,
                  status: 'pending' as const,
                  expanded: false
                }
              }];
            }
            const updated = messagesMapRef.current.get(sessionId) || [];
            if (updated.length > 0) {
              updated[updated.length - 1] = { 
                role: 'assistant', 
                content: responseText,
                timeline
              };
              messagesMapRef.current.set(sessionId, [...updated]);
              if (selectedSessionRef.current === sessionId) {
                setMessages([...updated]);
              }
            }
          } else if (event.type === 'tool_result' && event.toolResult) {
            // Find the last pending tool with matching name
            let foundIdx = -1;
            for (let i = timeline.length - 1; i >= 0; i--) {
              const evt = timeline[i];
              if (evt.type === 'tool' && 
                  (evt.data as ToolCall).name === event.toolResult!.name && 
                  (evt.data as ToolCall).status === 'pending') {
                foundIdx = i;
                break;
              }
            }
            
            if (foundIdx !== -1) {
              const isError = event.toolResult.result?.toString().toLowerCase().includes('error') || 
                             event.toolResult.result?.toString().toLowerCase().includes('fail');
              const oldData = timeline[foundIdx].data as ToolCall;
              timeline = [...timeline];
              timeline[foundIdx] = {
                type: 'tool',
                data: {
                  ...oldData,
                  args: JSON.stringify(event.toolResult.args, null, 2),
                  result: event.toolResult.result,
                  status: isError ? 'error' : 'success'
                }
              };
              const updated = messagesMapRef.current.get(sessionId) || [];
              if (updated.length > 0) {
                updated[updated.length - 1] = { 
                  role: 'assistant', 
                  content: responseText,
                  timeline
                };
                messagesMapRef.current.set(sessionId, [...updated]);
                if (selectedSessionRef.current === sessionId) {
                  setMessages([...updated]);
                }
              }
            }
          }
        }
      } else {
        const response = await api.sendMessage(sessionId, userMessage, false);
        const updated = [...newMessages, { role: 'assistant' as const, content: response }];
        messagesMapRef.current.set(sessionId, updated);
        if (selectedSessionRef.current === sessionId) {
          setMessages(updated);
        }
      }
      
      loadSessions();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setLoadingSessions((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
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
                        {s.name || s.session_id}
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
                      {sessions.find(s => s.session_id === selectedSession)?.name || selectedSession}
                    </span>
                  ) : (
                    <span className="text-[var(--color-accent-muted)]">请选择会话或创建新会话</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {selectedSession && messages.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClearMessages}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-accent-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Eraser className="w-4 h-4" />
                      清空对话
                    </motion.button>
                  )}
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
              </div>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-6 space-y-4"
              >
                {/* Loading indicator at top */}
                {loadingMore && (
                  <div className="flex justify-center py-2">
                    <div className="flex items-center gap-2 text-sm text-[var(--color-accent-muted)]">
                      <Spinner className="w-4 h-4 animate-spin" />
                      加载中...
                    </div>
                  </div>
                )}

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
                          <div className="space-y-2">
                            {msg.timeline && msg.timeline.length > 0 && (
                              <div className="mb-2">
                                {msg.timeline.map((event, ei) => (
                                  event.type === 'thinking' ? (
                                    <ThinkingCard
                                      key={ei}
                                      thinking={event.data as ThinkingBlock}
                                      onToggle={() => {
                                        const updated = [...messages];
                                        const m = updated[i] as Message;
                                        if (m.timeline && m.timeline[ei].type === 'thinking') {
                                          const oldData = m.timeline[ei].data as ThinkingBlock;
                                          m.timeline[ei] = { 
                                            type: 'thinking', 
                                            data: { ...oldData, expanded: !oldData.expanded } 
                                          };
                                        }
                                        if (selectedSessionRef.current) {
                                          messagesMapRef.current.set(selectedSessionRef.current, updated);
                                        }
                                        setMessages(updated);
                                      }}
                                    />
                                  ) : (
                                    <ToolCallCard
                                      key={ei}
                                      toolCall={event.data as ToolCall}
                                      onToggle={() => {
                                        const updated = [...messages];
                                        const m = updated[i] as Message;
                                        if (m.timeline && m.timeline[ei].type === 'tool') {
                                          const oldData = m.timeline[ei].data as ToolCall;
                                          m.timeline[ei] = { 
                                            type: 'tool', 
                                            data: { ...oldData, expanded: !oldData.expanded } 
                                          };
                                        }
                                        if (selectedSessionRef.current) {
                                          messagesMapRef.current.set(selectedSessionRef.current, updated);
                                        }
                                        setMessages(updated);
                                      }}
                                    />
                                  )
                                ))}
                              </div>
                            )}
                            {msg.content === '' && isLoading && i === messages.length - 1 ? (
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
                            ) : msg.content ? (
                              <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
                {/* Loading indicator - only for non-stream mode */}
                {isLoading && !streamMode && (
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