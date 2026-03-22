import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Lightning, MagicWand, SealCheck } from '@phosphor-icons/react';
import { useToast } from './Toast';
import { useApp } from '../AppContext';
import * as api from '../api/client';

type Skill = api.Skill;
type Agent = api.Agent;

export function Skills() {
  const showToast = useToast();
  const { setSelectedSessionId, setActiveTab } = useApp();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [invokeSkillId, setInvokeSkillId] = useState<string | null>(null);
  const [invokeSkillName, setInvokeSkillName] = useState<string>('');
  const [invokePrompt, setInvokePrompt] = useState('');
  const [invoking, setInvoking] = useState(false);

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
    } else {
      setSkills([]);
    }
  }, [selectedAgentId]);

  const handleDelete = async (skillId: string) => {
    if (!selectedAgentId) return;
    if (!confirm('确定删除此技能?')) return;
    try {
      await api.deleteSkill(skillId, selectedAgentId);
      const skillsData = await api.getSkills(selectedAgentId);
      setSkills(skillsData);
      showToast('已删除');
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    }
  };

  const handleView = async (skill: Skill) => {
    if (!selectedAgentId) return;
    try {
      const detail = await api.getSkill(skill.skill_id, selectedAgentId);
      setSelectedSkill(detail);
      setShowDetail(true);
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    }
  };

  const handleInvoke = async () => {
    if (!invokePrompt.trim() || !selectedAgentId || !invokeSkillId) return;
    
    setInvoking(true);
    try {
      const result = await api.invokeSkill(invokeSkillId, invokePrompt, selectedAgentId);
      showToast('执行成功');
      setInvokeSkillId(null);
      setInvokePrompt('');
      setSelectedSessionId(result.session_id);
      setActiveTab('chat');
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    } finally {
      setInvoking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-accent)]">
          技能管理
        </h1>
        <p className="text-sm text-[var(--color-accent-muted)] mt-1">
          管理每个 Agent 的技能
        </p>
      </div>

      {/* Agent Tabs */}
      {agents.length > 0 && (
        <div className="flex items-center gap-2 p-1 bg-[var(--color-surface)] rounded-xl overflow-x-auto">
          {agents.map((agent) => {
            const isSelected = selectedAgentId === agent.agent_id;
            return (
              <button
                key={agent.agent_id}
                onClick={() => setSelectedAgentId(agent.agent_id)}
                className={`
                  flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${isSelected 
                    ? 'bg-white text-[var(--color-accent)] shadow-sm' 
                    : 'text-[var(--color-accent-muted)] hover:text-[var(--color-accent)] hover:bg-white/50'
                  }
                `}
              >
                {agent.profile?.name || agent.agent_id}
              </button>
            );
          })}
        </div>
      )}

      {/* Skills List */}
      {agents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] 
              flex items-center justify-center">
              <Lightning className="w-8 h-8 text-[var(--color-accent-muted)]" weight="duotone" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-accent)] mb-1">暂无 Agent</h3>
            <p className="text-sm text-[var(--color-accent-muted)]">
              请先创建 Agent
            </p>
          </div>
        </div>
      ) : skills.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] 
              flex items-center justify-center">
              <Lightning className="w-8 h-8 text-[var(--color-accent-muted)]" weight="duotone" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-accent)] mb-1">暂无技能</h3>
            <p className="text-sm text-[var(--color-accent-muted)]">
              通过元 Agent 创建技能，或在 agent 目录下的 skills 文件夹手动创建
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((s, index) => (
            <motion.div
              key={s.skill_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleView(s)}
              className="group bg-white rounded-2xl border border-[var(--color-border)] p-5
                hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${s.builtin ? 'bg-amber-50' : 'bg-[var(--color-surface)]'}`}
                  >
                    <Lightning className={`w-5 h-5 ${s.builtin ? 'text-amber-500' : 'text-[var(--color-accent)]'}`} weight="duotone" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-[var(--color-accent)] truncate">
                        {s.name}
                      </h3>
                      {s.builtin && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 
                          text-amber-600 text-xs rounded-md font-medium flex-shrink-0">
                          <SealCheck className="w-3 h-3" weight="fill" />
                          内置
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-sm text-[var(--color-accent-muted)] mt-1 line-clamp-2">
                        {s.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInvokeSkillId(s.skill_id);
                    setInvokeSkillName(s.name);
                    setInvokePrompt('');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white 
                    rounded-lg font-medium text-sm transition-all"
                >
                  <MagicWand className="w-4 h-4" weight="bold" />
                  调用
                </motion.button>
                {!s.builtin && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.skill_id);
                    }}
                    className="px-4 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-accent-muted)]
                      font-medium text-sm hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    删除
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Invoke Modal */}
      {invokeSkillId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-accent)]">
                调用技能: {invokeSkillName}
              </h2>
              <button
                onClick={() => {
                  setInvokeSkillId(null);
                  setInvokePrompt('');
                }}
                className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  输入提示词
                </label>
                <textarea
                  value={invokePrompt}
                  onChange={(e) => setInvokePrompt(e.target.value)}
                  placeholder="输入调用此技能的提示词..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all resize-none"
                />
              </div>
              
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleInvoke}
                  disabled={invoking || !invokePrompt.trim()}
                  className="flex-1 px-4 py-2.5 bg-[var(--color-accent)] text-white 
                    rounded-xl font-medium text-sm disabled:opacity-50"
                >
                  {invoking ? '执行中...' : '执行'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setInvokeSkillId(null);
                    setInvokePrompt('');
                  }}
                  className="px-4 py-2.5 bg-[var(--color-surface)] text-[var(--color-accent-muted)]
                    rounded-xl font-medium text-sm"
                >
                  取消
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Skill Detail Modal */}
      {showDetail && selectedSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-[var(--color-accent)]">
                  {selectedSkill.name}
                </h2>
                {selectedSkill.builtin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 
                    text-amber-600 text-xs rounded-md font-medium">
                    <SealCheck className="w-3 h-3" weight="fill" />
                    内置技能
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-accent-muted)]">ID</label>
                <p className="text-sm text-[var(--color-accent)]">{selectedSkill.skill_id}</p>
              </div>
              
              {selectedSkill.description && (
                <div>
                  <label className="text-sm font-medium text-[var(--color-accent-muted)]">描述</label>
                  <p className="text-sm text-[var(--color-accent)]">{selectedSkill.description}</p>
                </div>
              )}
              
              {selectedSkill.content && (
                <div>
                  <label className="text-sm font-medium text-[var(--color-accent-muted)]">内容</label>
                  <div className="mt-2 p-4 bg-[var(--color-surface)] rounded-xl text-sm 
                    overflow-auto max-h-[50vh] prose prose-sm max-w-none
                    prose-headings:text-[var(--color-accent)] prose-headings:font-semibold
                    prose-code:text-[var(--color-accent)] prose-code:bg-white prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                    prose-pre:bg-white prose-pre:text-[var(--color-accent)]
                    prose-a:text-[var(--color-accent)] prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-[var(--color-accent)] prose-li:text-[var(--color-accent)]
                    prose-p:text-[var(--color-accent)] prose-p:my-2">
                    <ReactMarkdown>{selectedSkill.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}