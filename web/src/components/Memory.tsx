import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Brain, Database, Clock, Lightning, UploadSimple } from '@phosphor-icons/react';
import { useToast } from './Toast';
import * as api from '../api/client';

interface MemoryData {
  l1_working: { messages: { role: string; content: string }[] };
  l2_episodic: { summary: string; created_at: string }[];
  l3_semantic: { content: string }[];
}

const memoryTabs = [
  { id: 'l1' as const, label: 'L1 短期记忆', icon: Lightning, desc: '当前对话上下文' },
  { id: 'l2' as const, label: 'L2 情景记忆', icon: Clock, desc: '历史对话摘要' },
  { id: 'l3' as const, label: 'L3 语义记忆', icon: Database, desc: '长期知识存储' },
];

export function MemoryPanel() {
  const showToast = useToast();
  const [agents, setAgents] = useState<api.Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [activeLayer, setActiveLayer] = useState<'l1' | 'l2' | 'l3'>('l1');
  const [l3Content, setL3Content] = useState('');

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
      api.getMemory(selectedAgentId).then(setMemoryData).catch(() => setMemoryData(null));
    } else {
      setMemoryData(null);
    }
  }, [selectedAgentId]);

  const handleAddL3 = async () => {
    if (!selectedAgentId) {
      showToast('请选择 Agent', 'error');
      return;
    }
    if (!l3Content.trim()) {
      showToast('请输入内容', 'error');
      return;
    }
    try {
      await api.addL3Memory(selectedAgentId, l3Content.trim());
      setL3Content('');
      const data = await api.getMemory(selectedAgentId);
      setMemoryData(data);
      showToast('保存成功');
    } catch (e: unknown) {
      const error = e as Error;
      showToast('保存失败: ' + error.message, 'error');
    }
  };

  const renderContent = () => {
    if (!memoryData) return null;

    switch (activeLayer) {
      case 'l1': {
        const msgs = memoryData.l1_working?.messages || [];
        return msgs.length > 0
          ? msgs.map((m, i) => (
              <div key={i} className="p-3 bg-[var(--color-surface)] rounded-xl mb-2 last:mb-0">
                <div className="text-xs font-medium text-[var(--color-accent-muted)] mb-1 uppercase">
                  {m.role}
                </div>
                <p className="text-sm text-[var(--color-accent)] whitespace-pre-wrap">{m.content}</p>
              </div>
            ))
          : <div className="text-center py-8 text-[var(--color-accent-muted)]">暂无记忆</div>;
      }
      case 'l2': {
        const episodes = memoryData.l2_episodic || [];
        return episodes.length > 0
          ? episodes.map((e, i) => (
              <div key={i} className="p-3 bg-[var(--color-surface)] rounded-xl mb-2 last:mb-0">
                <div className="text-xs text-[var(--color-accent-muted)] mb-1">{e.created_at}</div>
                <p className="text-sm text-[var(--color-accent)]">{e.summary}</p>
              </div>
            ))
          : <div className="text-center py-8 text-[var(--color-accent-muted)]">暂无记忆</div>;
      }
      case 'l3': {
        const semantic = memoryData.l3_semantic || [];
        return semantic.length > 0
          ? semantic.map((m, i) => (
              <div key={i} className="p-3 bg-[var(--color-surface)] rounded-xl mb-2 last:mb-0">
                <p className="text-sm text-[var(--color-accent)]">{m.content}</p>
              </div>
            ))
          : <div className="text-center py-8 text-[var(--color-accent-muted)]">暂无记忆</div>;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-accent)]">
          记忆系统
        </h1>
        <p className="text-sm text-[var(--color-accent-muted)] mt-1">
          查看和管理 Agent 的三层记忆
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

      {/* Memory Display */}
      {agents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] 
              flex items-center justify-center">
              <Brain className="w-8 h-8 text-[var(--color-accent-muted)]" weight="duotone" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-accent)] mb-1">暂无 Agent</h3>
            <p className="text-sm text-[var(--color-accent-muted)]">
              请先创建 Agent
            </p>
          </div>
        </div>
      ) : memoryData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden"
        >
          {/* Memory Tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            {memoryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeLayer === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveLayer(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-4 py-4 
                    text-sm font-medium transition-colors relative
                    ${isActive 
                      ? 'text-[var(--color-accent)]' 
                      : 'text-[var(--color-accent-muted)] hover:text-[var(--color-accent)]'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" weight={isActive ? 'duotone' : 'regular'} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeMemoryTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="max-h-[400px] overflow-y-auto">
              {renderContent()}
            </div>
          </div>

          {/* L3 Add */}
          <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-surface)]/50">
            <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
              添加语义记忆
            </label>
            <div className="flex gap-3">
              <textarea
                placeholder="输入要保存的重要信息..."
                value={l3Content}
                onChange={(e) => setL3Content(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white border border-[var(--color-border)]
                  rounded-xl text-sm resize-none focus:outline-none focus:ring-2 
                  focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
                rows={2}
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddL3}
                className="px-4 py-2.5 bg-[var(--color-accent)] text-white 
                  rounded-xl font-medium text-sm h-fit"
              >
                <UploadSimple className="w-4 h-4" weight="bold" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}