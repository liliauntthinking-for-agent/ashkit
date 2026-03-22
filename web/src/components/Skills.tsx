import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Lightning, MagicWand, SealCheck, PuzzlePiece, Check, X } from '@phosphor-icons/react';
import { useToast } from './Toast';
import { useApp } from '../AppContext';
import * as api from '../api/client';

type Skill = api.Skill;
type Agent = api.Agent;
type MCPServer = api.MCPServer;
type MCPTool = api.MCPTool;

export function Skills() {
  const showToast = useToast();
  const { setSelectedSessionId, setActiveTab: setAppTab } = useApp();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'skills' | 'mcp'>('skills');
  
  // Skills state
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [invokeSkillId, setInvokeSkillId] = useState<string | null>(null);
  const [invokeSkillName, setInvokeSkillName] = useState<string>('');
  const [invokePrompt, setInvokePrompt] = useState('');
  const [invoking, setInvoking] = useState(false);
  
  // MCP state
  const [mcpServers, setMcpServers] = useState<Record<string, MCPServer>>({});
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [agentMcpServers, setAgentMcpServers] = useState<string[]>([]);
  const [showMcpSelector, setShowMcpSelector] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const agentsData = await api.getAgents();
      setAgents(agentsData);
      if (agentsData.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agentsData[0].agent_id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedAgentId) {
      api.getSkills(selectedAgentId).then(setSkills).catch(console.error);
      const agent = agents.find(a => a.agent_id === selectedAgentId);
      setAgentMcpServers(agent?.mcp_servers || []);
    } else {
      setSkills([]);
      setAgentMcpServers([]);
    }
  }, [selectedAgentId, agents]);

  useEffect(() => {
    api.getMCPServers().then(setMcpServers).catch(console.error);
    api.getMCPTools().then(setMcpTools).catch(console.error);
  }, []);

  const handleDelete = async (skillId: string) => {
    if (!selectedAgentId) return;
    if (!confirm('确定删除此技能?')) return;
    try {
      await api.deleteSkill(skillId, selectedAgentId);
      setSkills((prev) => prev.filter((s) => s.skill_id !== skillId));
      showToast('已删除');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleView = (skill: Skill) => {
    setSelectedSkill(skill);
    setShowDetail(true);
  };

  const handleInvokeClick = (skill: Skill) => {
    setInvokeSkillId(skill.skill_id);
    setInvokeSkillName(skill.name);
    setInvokePrompt('');
  };

  const handleInvoke = async () => {
    if (!selectedAgentId || !invokeSkillId || !invokePrompt.trim()) return;
    setInvoking(true);
    try {
      const result = await api.invokeSkill(invokeSkillId, invokePrompt, selectedAgentId);
      setInvokeSkillId(null);
      setInvokePrompt('');
      setSelectedSessionId(result.session_id);
      setAppTab('chat');
      showToast('技能调用成功，已创建会话');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setInvoking(false);
    }
  };

  const handleToggleMcpServer = async (serverName: string) => {
    if (!selectedAgentId) return;
    
    const newServers = agentMcpServers.includes(serverName)
      ? agentMcpServers.filter(s => s !== serverName)
      : [...agentMcpServers, serverName];
    
    try {
      await api.updateAgent(selectedAgentId, { mcp_servers: newServers });
      setAgentMcpServers(newServers);
      setAgents(prev => prev.map(a => 
        a.agent_id === selectedAgentId ? { ...a, mcp_servers: newServers } : a
      ));
      showToast(agentMcpServers.includes(serverName) ? '已移除 MCP 服务器' : '已添加 MCP 服务器');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const builtinSkills = skills.filter((s) => s.builtin);
  const agentSkills = skills.filter((s) => !s.builtin);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-accent)]">
            技能管理
          </h1>
          <p className="text-sm text-[var(--color-accent-muted)] mt-1">
            管理每个 Agent 的技能和 MCP 工具
          </p>
        </div>
        <select
          value={selectedAgentId}
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
        >
          <option value="">选择 Agent</option>
          {agents.map((a) => (
            <option key={a.agent_id} value={a.agent_id}>
              {a.profile?.name || a.agent_id}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => setCurrentTab('skills')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            currentTab === 'skills'
              ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
              : 'text-[var(--color-accent-muted)] hover:text-[var(--color-accent)]'
          }`}
        >
          <span className="flex items-center gap-2">
            <MagicWand className="w-4 h-4" />
            Skills
          </span>
        </button>
        <button
          onClick={() => setCurrentTab('mcp')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            currentTab === 'mcp'
              ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
              : 'text-[var(--color-accent-muted)] hover:text-[var(--color-accent)]'
          }`}
        >
          <span className="flex items-center gap-2">
            <PuzzlePiece className="w-4 h-4" />
            MCP
          </span>
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {currentTab === 'skills' ? (
          <motion.div
            key="skills"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Skills Content */}
            {selectedAgentId ? (
              <>
                {/* Built-in Skills */}
                {builtinSkills.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-accent)] mb-4 flex items-center gap-2">
                      <SealCheck className="w-5 h-5 text-emerald-500" weight="duotone" />
                      内置技能
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {builtinSkills.map((skill) => (
                        <SkillCard
                          key={skill.skill_id}
                          skill={skill}
                          onView={() => handleView(skill)}
                          onInvoke={() => handleInvokeClick(skill)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent-specific Skills */}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-accent)] mb-4 flex items-center gap-2">
                    <Lightning className="w-5 h-5 text-amber-500" weight="duotone" />
                    Agent 技能
                  </h2>
                  {agentSkills.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {agentSkills.map((skill) => (
                        <SkillCard
                          key={skill.skill_id}
                          skill={skill}
                          onView={() => handleView(skill)}
                          onDelete={() => handleDelete(skill.skill_id)}
                          onInvoke={() => handleInvokeClick(skill)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-[var(--color-border)]">
                      <Lightning className="w-12 h-12 text-[var(--color-accent-muted)] mx-auto mb-3 opacity-30" weight="duotone" />
                      <p className="text-[var(--color-accent-muted)]">暂无 Agent 专属技能</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-[var(--color-border)]">
                <MagicWand className="w-12 h-12 text-[var(--color-accent-muted)] mx-auto mb-3 opacity-30" weight="duotone" />
                <p className="text-[var(--color-accent-muted)]">请先选择一个 Agent</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="mcp"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* MCP Content */}
            {selectedAgentId ? (
              <>
                {/* Current Agent MCP Servers */}
                <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-[var(--color-accent)]">当前 Agent 启用的 MCP</h3>
                    <button
                      onClick={() => setShowMcpSelector(true)}
                      className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-lg text-sm"
                    >
                      配置 MCP
                    </button>
                  </div>
                  {agentMcpServers.length > 0 ? (
                    <div className="space-y-2">
                      {agentMcpServers.map((serverName) => (
                        <div key={serverName} className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-lg">
                          <div className="flex items-center gap-2">
                            <PuzzlePiece className="w-4 h-4 text-[var(--color-accent)]" />
                            <span className="font-medium">{serverName}</span>
                          </div>
                          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">已启用</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-accent-muted)]">此 Agent 尚未启用任何 MCP 服务器</p>
                  )}
                </div>

                {/* Available MCP Tools */}
                {mcpTools.length > 0 && (
                  <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
                    <h3 className="font-medium text-[var(--color-accent)] mb-4">可用 MCP 工具</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mcpTools.map((tool, i) => (
                        <div key={i} className="p-3 bg-[var(--color-surface)] rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <PuzzlePiece className="w-4 h-4 text-[var(--color-accent)]" />
                            <span className="font-mono text-sm font-medium">{tool.server}.{tool.name}</span>
                          </div>
                          {tool.description && (
                            <p className="text-xs text-[var(--color-accent-muted)]">{tool.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-[var(--color-border)]">
                <PuzzlePiece className="w-12 h-12 text-[var(--color-accent-muted)] mx-auto mb-3 opacity-30" weight="duotone" />
                <p className="text-[var(--color-accent-muted)]">请先选择一个 Agent</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MCP Selector Modal */}
      {showMcpSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-accent)]">配置 MCP 服务器</h3>
              <button
                onClick={() => setShowMcpSelector(false)}
                className="p-2 hover:bg-[var(--color-surface)] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {Object.keys(mcpServers).length > 0 ? (
                Object.entries(mcpServers).map(([name, config]) => (
                  <div
                    key={name}
                    onClick={() => handleToggleMcpServer(name)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                      agentMcpServers.includes(name)
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-surface)] hover:bg-[var(--color-border)]'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{name}</div>
                      <div className={`text-xs ${agentMcpServers.includes(name) ? 'text-white/70' : 'text-[var(--color-accent-muted)]'}`}>
                        {config.command} {config.args?.slice(0, 2).join(' ')}...
                      </div>
                    </div>
                    {agentMcpServers.includes(name) && <Check className="w-5 h-5" />}
                  </div>
                ))
              ) : (
                <p className="text-center text-[var(--color-accent-muted)] py-4">
                  暂无 MCP 服务器配置，请先在设置页面添加
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Skill Detail Modal */}
      {showDetail && selectedSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-accent)]">{selectedSkill.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-1 rounded-full ${selectedSkill.builtin ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {selectedSkill.builtin ? '内置' : '自定义'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-2 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{selectedSkill.description || '暂无描述'}</ReactMarkdown>
            </div>
          </motion.div>
        </div>
      )}

      {/* Invoke Skill Modal */}
      {invokeSkillId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-lg m-4"
          >
            <h3 className="text-lg font-semibold text-[var(--color-accent)] mb-4">
              调用技能: {invokeSkillName}
            </h3>
            <textarea
              value={invokePrompt}
              onChange={(e) => setInvokePrompt(e.target.value)}
              placeholder="输入提示词..."
              className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            />
            <div className="flex gap-2 mt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleInvoke}
                disabled={invoking || !invokePrompt.trim()}
                className="flex-1 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {invoking ? '调用中...' : '调用'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setInvokeSkillId(null)}
                className="px-4 py-2 bg-[var(--color-surface)] text-[var(--color-accent)] rounded-lg text-sm font-medium"
              >
                取消
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Skill Card Component
function SkillCard({
  skill,
  onView,
  onDelete,
  onInvoke,
}: {
  skill: Skill;
  onView: () => void;
  onDelete?: () => void;
  onInvoke: () => void;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white rounded-xl border border-[var(--color-border)] p-4 hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-surface)] flex items-center justify-center shrink-0">
          <Lightning className="w-5 h-5 text-[var(--color-accent)]" weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-[var(--color-accent)] truncate">{skill.name}</h3>
            {skill.builtin && (
              <SealCheck className="w-4 h-4 text-emerald-500" weight="duotone" />
            )}
          </div>
          <p className="text-xs text-[var(--color-accent-muted)] line-clamp-2 mt-1">
            {skill.description || '暂无描述'}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onInvoke(); }}
          className="flex-1 px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-lg text-xs font-medium"
        >
          调用
        </button>
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
          >
            删除
          </button>
        )}
      </div>
    </motion.div>
  );
}