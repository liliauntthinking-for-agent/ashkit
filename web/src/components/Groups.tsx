import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Users, Plus, Trash, PaperPlaneTilt, Spinner, User, Robot, X
} from '@phosphor-icons/react';
import { useToast } from './Toast';
import * as api from '../api/client';

interface Agent {
  agent_id: string;
  status: string;
  profile?: {
    name?: string;
    nickname?: string;
    avatar?: string;
  };
}

interface User {
  user_id: string;
  profile?: {
    name?: string;
    nickname?: string;
    avatar?: string;
  };
}

interface GroupMemberInfo {
  id: string;
  type: 'user' | 'agent';
  name: string;
  avatar?: string;
}

export function Groups() {
  const showToast = useToast();
  const [groups, setGroups] = useState<api.Group[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMemberInfo[]>([]);
  const [messages, setMessages] = useState<api.GroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [firstMessageId, setFirstMessageId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Streaming state
  const [streamingAgents, setStreamingAgents] = useState<Set<string>>(new Set());
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});

  const loadGroups = useCallback(async () => {
    try {
      const data = await api.getGroups();
      setGroups(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const data = await api.getAgents();
      setAgents(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
      if (data.length > 0 && !currentUserId) {
        setCurrentUserId(data[0].user_id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadGroups();
    loadAgents();
    loadUsers();
  }, [loadGroups, loadAgents, loadUsers]);

  const loadGroupData = useCallback(async (groupId: string) => {
    try {
      const data = await api.getGroup(groupId, 50);

      // Build member info map
      const memberInfo: GroupMemberInfo[] = data.members.map(m => {
        if (m.member_type === 'user') {
          const user = users.find(u => u.user_id === m.member_id);
          return {
            id: m.member_id,
            type: 'user' as const,
            name: user?.profile?.nickname || user?.profile?.name || m.member_id,
            avatar: user?.profile?.avatar
          };
        } else {
          const agent = agents.find(a => a.agent_id === m.member_id);
          return {
            id: m.member_id,
            type: 'agent' as const,
            name: agent?.profile?.nickname || agent?.profile?.name || m.member_id,
            avatar: agent?.profile?.avatar
          };
        }
      });

      setGroupName(data.name);
      setMembers(memberInfo);
      setMessages(data.messages);
      setHasMore(data.has_more);
      setFirstMessageId(data.first_id);

      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      });
    } catch (e) {
      console.error(e);
      showToast('加载群组失败', 'error');
    }
  }, [users, agents, showToast]);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupData(selectedGroup);
    }
  }, [selectedGroup, loadGroupData]);

  const handleLoadMore = useCallback(async () => {
    if (!selectedGroup || loadingMore || !hasMore || !firstMessageId) return;

    setLoadingMore(true);
    try {
      const data = await api.getGroup(selectedGroup, 50, firstMessageId);
      setMessages(prev => [...data.messages, ...prev]);
      setHasMore(data.has_more);
      setFirstMessageId(data.first_id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  }, [selectedGroup, loadingMore, hasMore, firstMessageId]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (hasMore && !loadingMore && messages.length > 0 && container.scrollTop < 300) {
      handleLoadMore();
    }
  }, [hasMore, loadingMore, messages.length, handleLoadMore]);

  const handleCreateGroup = async () => {
    if (!newGroupId.trim()) {
      showToast('请输入群组ID', 'error');
      return;
    }

    try {
      const group = await api.createGroup(newGroupId.trim(), newGroupName.trim() || undefined);
      setGroups(prev => [...prev, group]);
      setShowNewGroup(false);
      setNewGroupId('');
      setNewGroupName('');
      setSelectedGroup(group.group_id);
      showToast('群组已创建');
    } catch (e: any) {
      showToast('创建失败: ' + e.message, 'error');
    }
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除此群组?')) return;

    try {
      await api.deleteGroup(groupId);
      setGroups(prev => prev.filter(g => g.group_id !== groupId));
      if (selectedGroup === groupId) {
        setSelectedGroup(null);
        setMessages([]);
        setMembers([]);
      }
      showToast('已删除');
    } catch (e: any) {
      showToast('删除失败: ' + e.message, 'error');
    }
  };

  const handleAddMember = async (memberId: string, memberType: 'user' | 'agent') => {
    if (!selectedGroup) return;

    try {
      await api.addGroupMember(selectedGroup, memberId, memberType);
      await loadGroupData(selectedGroup);
      showToast('已添加成员');
    } catch (e: any) {
      showToast('添加失败: ' + e.message, 'error');
    }
  };

  const handleRemoveMember = async (memberId: string, memberType: 'user' | 'agent') => {
    if (!selectedGroup) return;

    try {
      await api.removeGroupMember(selectedGroup, memberId, memberType);
      await loadGroupData(selectedGroup);
      showToast('已移除成员');
    } catch (e: any) {
      showToast('移除失败: ' + e.message, 'error');
    }
  };

  const handleSend = async () => {
    if (!selectedGroup) {
      showToast('请选择群组', 'error');
      return;
    }
    if (!input.trim()) {
      showToast('请输入消息', 'error');
      return;
    }
    if (!currentUserId) {
      showToast('请先创建用户', 'error');
      return;
    }

    const message = input.trim();
    setInput('');
    setLoading(true);

    // Add user message immediately
    const userMsg: api.GroupMessage = {
      id: Date.now(),
      group_id: selectedGroup,
      sender_id: currentUserId,
      sender_type: 'user',
      content: message,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Stream the message - use local variables for tracking during iteration
      let currentStreamingAgent: string | null = null;
      const agentContents: Record<string, string> = {};

      for await (const event of api.streamGroupMessage(selectedGroup, currentUserId, message)) {
        if (event.type === 'agent_start' && event.agent_id) {
          const agentId = event.agent_id;
          currentStreamingAgent = agentId;
          agentContents[agentId] = '';
          setStreamingAgents(prev => new Set(prev).add(agentId));
          setStreamingContent(prev => ({ ...prev, [agentId]: '' }));
        } else if (event.type === 'content' && event.content && currentStreamingAgent) {
          const agentId = currentStreamingAgent;
          agentContents[agentId] = (agentContents[agentId] || '') + event.content;
          setStreamingContent(prev => ({
            ...prev,
            [agentId]: agentContents[agentId]
          }));
        } else if (event.type === 'agent_end' && event.agent_id) {
          const agentId = event.agent_id;
          const content = agentContents[agentId] || '';

          // Add the agent message to the list
          if (content) {
            const agentMsg: api.GroupMessage = {
              id: Date.now() + Math.random(),
              group_id: selectedGroup,
              sender_id: agentId,
              sender_type: 'agent',
              content,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, agentMsg]);
          }

          // Clear streaming state for this agent
          currentStreamingAgent = null;
          setStreamingAgents(prev => {
            const next = new Set(prev);
            next.delete(agentId);
            return next;
          });
          setStreamingContent(prev => {
            const next = { ...prev };
            delete next[agentId];
            return next;
          });
        }
      }

      loadGroups();
    } catch (e: any) {
      showToast('发送失败: ' + e.message, 'error');
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

  const getMemberInfo = (senderId: string, senderType: 'user' | 'agent'): GroupMemberInfo => {
    const member = members.find(m => m.id === senderId && m.type === senderType);
    if (member) return member;

    // Fallback
    if (senderType === 'user') {
      const user = users.find(u => u.user_id === senderId);
      return {
        id: senderId,
        type: 'user',
        name: user?.profile?.nickname || user?.profile?.name || senderId,
        avatar: user?.profile?.avatar
      };
    } else {
      const agent = agents.find(a => a.agent_id === senderId);
      return {
        id: senderId,
        type: 'agent',
        name: agent?.profile?.nickname || agent?.profile?.name || senderId,
        avatar: agent?.profile?.avatar
      };
    }
  };

  // Available members to add
  const availableUsers = users.filter(u => !members.some(m => m.id === u.user_id && m.type === 'user'));
  const availableAgents = agents.filter(a => !members.some(m => m.id === a.agent_id && m.type === 'agent'));

  return (
    <div className="flex gap-6 h-[calc(100dvh-140px)]">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 flex flex-col h-full">
        <div className="flex gap-2 mb-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowNewGroup(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
              bg-[var(--color-accent)] text-white rounded-xl font-medium text-sm
              shadow-lg shadow-[var(--color-accent)]/10 hover:shadow-xl transition-shadow"
          >
            <Plus className="w-4 h-4" weight="bold" />
            新群组
          </motion.button>
          <select
            value={currentUserId}
            onChange={(e) => setCurrentUserId(e.target.value)}
            className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)]
              rounded-xl text-sm focus:outline-none"
          >
            {users.map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.profile?.nickname || u.profile?.name || u.user_id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden flex flex-col">
          <div className="p-3 border-b border-[var(--color-border)] flex-shrink-0">
            <h3 className="text-xs font-semibold text-[var(--color-accent-muted)] uppercase tracking-wider">
              群组列表
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {groups.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--color-accent-muted)]">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                暂无群组
              </div>
            ) : (
              <div className="p-2">
                {groups.map((g, index) => (
                  <motion.div
                    key={g.group_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedGroup(g.group_id)}
                    className={`
                      group flex items-center justify-between p-3 rounded-xl cursor-pointer
                      transition-colors duration-200
                      ${selectedGroup === g.group_id
                        ? 'bg-[var(--color-surface)] shadow-sm'
                        : 'hover:bg-[var(--color-surface)]/50'
                      }
                    `}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--color-accent)] truncate">
                        {g.name || g.group_id}
                      </div>
                      <div className="text-xs text-[var(--color-accent-muted)] mt-0.5">
                        {g.member_count || 0} 成员 · {g.message_count || 0} 消息
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteGroup(g.group_id, e)}
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
      <div className="flex-1 flex min-w-0 bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden h-full">
        <AnimatePresence mode="wait">
          {showNewGroup ? (
            <motion.div
              key="new-group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex items-center justify-center p-8"
            >
              <div className="w-full max-w-sm space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--color-surface)]
                    flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-[var(--color-accent)]" weight="duotone" />
                  </div>
                  <h2 className="text-xl font-semibold text-[var(--color-accent)]">创建新群组</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                      群组ID
                    </label>
                    <input
                      type="text"
                      value={newGroupId}
                      onChange={(e) => setNewGroupId(e.target.value)}
                      placeholder="输入群组ID"
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                      群组名称（可选）
                    </label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="输入群组名称"
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCreateGroup}
                      className="flex-1 px-4 py-2.5 bg-[var(--color-accent)] text-white
                        rounded-xl font-medium text-sm hover:bg-[var(--color-accent)]/90 transition-colors"
                    >
                      创建
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowNewGroup(false)}
                      className="px-4 py-2.5 bg-[var(--color-surface)] text-[var(--color-accent-muted)]
                        rounded-xl font-medium text-sm hover:bg-[var(--color-surface-elevated)] transition-colors"
                    >
                      取消
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : selectedGroup ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-[var(--color-accent)]">
                    {groupName || selectedGroup}
                  </span>
                  <span className="text-xs text-[var(--color-accent-muted)]">
                    ({members.length} 成员)
                  </span>
                </div>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-accent)]
                    hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加成员
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-6 space-y-4"
                >
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
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">发送消息开始群聊</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const info = getMemberInfo(msg.sender_id, msg.sender_type);
                      const isUser = msg.sender_type === 'user';
                      const isStreaming = streamingAgents.has(msg.sender_id) && i === messages.length - 1;
                      const streamContent = streamingContent[msg.sender_id] || '';

                      return (
                        <motion.div
                          key={msg.id || i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <div className={`
                              w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden
                              ${isUser ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface)]'}
                            `}>
                              {info.avatar ? (
                                <img src={info.avatar} alt={info.name} className="w-full h-full object-cover" />
                              ) : isUser ? (
                                <User className="w-4 h-4 text-white" weight="duotone" />
                              ) : (
                                <Robot className="w-4 h-4 text-[var(--color-accent)]" weight="duotone" />
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--color-accent-muted)] max-w-[60px] truncate text-center">
                              {info.name}
                            </span>
                          </div>
                          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                            {msg.created_at && (
                              <span className="text-[10px] text-[var(--color-accent-muted)] mb-1">
                                {new Date(msg.created_at).toLocaleString('zh-CN', {
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                            <div className={`
                              max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                              ${isUser
                                ? 'bg-[var(--color-accent)] text-white rounded-tr-md'
                                : 'bg-[var(--color-surface)] text-[var(--color-accent)] rounded-tl-md'
                              }
                            `}>
                              {isUser ? (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              ) : (
                                <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {isStreaming ? streamContent || msg.content : msg.content}
                                  </ReactMarkdown>
                                  {isStreaming && !streamContent && (
                                    <div className="flex items-center gap-1 mt-2">
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
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Members sidebar */}
                <div className="w-48 border-l border-[var(--color-border)] flex flex-col">
                  <div className="p-3 border-b border-[var(--color-border)]">
                    <h4 className="text-xs font-semibold text-[var(--color-accent-muted)] uppercase tracking-wider">
                      成员
                    </h4>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {members.map((m) => (
                      <div
                        key={`${m.type}-${m.id}`}
                        className="group flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-surface)]"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`
                            w-6 h-6 rounded flex items-center justify-center overflow-hidden
                            ${m.type === 'user' ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface)] border border-[var(--color-border)]'}
                          `}>
                            {m.avatar ? (
                              <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                            ) : m.type === 'user' ? (
                              <User className="w-3 h-3 text-white" weight="duotone" />
                            ) : (
                              <Robot className="w-3 h-3 text-[var(--color-accent)]" weight="duotone" />
                            )}
                          </div>
                          <span className="text-xs text-[var(--color-accent)] truncate max-w-[80px]">
                            {m.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(m.id, m.type)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="p-4 border-t border-[var(--color-border)]">
                <div className="flex gap-3">
                  <textarea
                    placeholder="输入消息..."
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-xl text-sm resize-none focus:outline-none focus:ring-2
                      focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]
                      disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSend}
                    disabled={loading || !selectedGroup}
                    className="w-12 h-12 flex items-center justify-center
                      bg-[var(--color-accent)] text-white rounded-xl
                      disabled:opacity-50 disabled:cursor-not-allowed
                      hover:bg-[var(--color-accent)]/90 transition-colors"
                  >
                    {loading ? (
                      <Spinner className="w-5 h-5 animate-spin" />
                    ) : (
                      <PaperPlaneTilt className="w-5 h-5" weight="fill" />
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center text-[var(--color-accent-muted)]">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">选择或创建一个群组开始聊天</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
            onClick={() => setShowAddMember(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl p-6 w-80 max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--color-accent)]">添加成员</h3>
                <button
                  onClick={() => setShowAddMember(false)}
                  className="p-1 hover:bg-[var(--color-surface)] rounded-lg"
                >
                  <X className="w-5 h-5 text-[var(--color-accent-muted)]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {availableUsers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--color-accent-muted)] uppercase mb-2">用户</h4>
                    <div className="space-y-1">
                      {availableUsers.map(u => (
                        <button
                          key={u.user_id}
                          onClick={() => handleAddMember(u.user_id, 'user')}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--color-surface)] text-left"
                        >
                          <div className="w-6 h-6 rounded bg-[var(--color-accent)] flex items-center justify-center overflow-hidden">
                            {u.profile?.avatar ? (
                              <img src={u.profile.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3 h-3 text-white" weight="duotone" />
                            )}
                          </div>
                          <span className="text-sm text-[var(--color-accent)]">
                            {u.profile?.nickname || u.profile?.name || u.user_id}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableAgents.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--color-accent-muted)] uppercase mb-2">Agent</h4>
                    <div className="space-y-1">
                      {availableAgents.map(a => (
                        <button
                          key={a.agent_id}
                          onClick={() => handleAddMember(a.agent_id, 'agent')}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--color-surface)] text-left"
                        >
                          <div className="w-6 h-6 rounded bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
                            {a.profile?.avatar ? (
                              <img src={a.profile.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Robot className="w-3 h-3 text-[var(--color-accent)]" weight="duotone" />
                            )}
                          </div>
                          <span className="text-sm text-[var(--color-accent)]">
                            {a.profile?.nickname || a.profile?.name || a.agent_id}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableUsers.length === 0 && availableAgents.length === 0 && (
                  <div className="text-center text-sm text-[var(--color-accent-muted)] py-4">
                    所有成员已在群组中
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}