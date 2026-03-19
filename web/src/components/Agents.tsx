import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cube, Plus, Trash, Circle } from '@phosphor-icons/react';
import { useToast } from './Toast';
import * as api from '../api/client';

interface Provider {
  name: string;
  models: string[];
}

interface Agent {
  agent_id: string;
  status: string;
}

export function Agents() {
  const showToast = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [formData, setFormData] = useState({
    agent_id: '',
    provider: '',
    model: '',
  });
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [providersData, agentsData] = await Promise.all([
        api.getProviders(),
        api.getAgents(),
      ]);
      setProviders(providersData);
      setAgents(agentsData);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedProvider = providers.find((p) => p.name === formData.provider);

  const handleCreate = async () => {
    if (!formData.agent_id.trim()) {
      showToast('请输入 Agent ID', 'error');
      return;
    }
    if (!formData.provider) {
      showToast('请选择 Provider', 'error');
      return;
    }
    if (!formData.model) {
      showToast('请选择模型', 'error');
      return;
    }
    try {
      await api.createAgent({
        agent_id: formData.agent_id.trim(),
        provider: formData.provider,
        model: formData.model,
      });
      setFormData({ agent_id: '', provider: '', model: '' });
      setShowForm(false);
      loadData();
      showToast('创建成功');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('确定删除此 Agent?')) return;
    await api.deleteAgent(agentId);
    loadData();
    showToast('已删除');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-accent)]">
            Agent 管理
          </h1>
          <p className="text-sm text-[var(--color-accent-muted)] mt-1">
            创建和管理你的 AI 助手
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-accent)] text-white 
            rounded-xl font-medium text-sm shadow-lg shadow-[var(--color-accent)]/10"
        >
          <Plus className="w-4 h-4" weight="bold" />
          创建 Agent
        </motion.button>
      </div>

      {/* Create Form */}
      <motion.div
        initial={false}
        animate={{ 
          height: showForm ? 'auto' : 0,
          opacity: showForm ? 1 : 0 
        }}
        className="overflow-hidden"
      >
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 space-y-4">
          <h3 className="text-base font-semibold text-[var(--color-accent)]">创建新 Agent</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                Agent ID
              </label>
              <input
                type="text"
                placeholder="输入唯一标识符"
                value={formData.agent_id}
                onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                  rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                  focus:border-[var(--color-accent)] transition-all"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  Provider
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value, model: '' })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                >
                  <option value="">选择 Provider</option>
                  {providers.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  模型
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  disabled={!formData.provider}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!formData.provider
                      ? '请先选择 Provider'
                      : selectedProvider?.models.length === 0
                      ? '该 Provider 暂无模型'
                      : '选择模型'}
                  </option>
                  {selectedProvider?.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreate}
              className="px-4 py-2.5 bg-[var(--color-accent)] text-white 
                rounded-xl font-medium text-sm"
            >
              创建
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 bg-[var(--color-surface)] text-[var(--color-accent-muted)]
                rounded-xl font-medium text-sm"
            >
              取消
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Agent List */}
      {agents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] 
              flex items-center justify-center">
              <Cube className="w-8 h-8 text-[var(--color-accent-muted)]" weight="duotone" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-accent)] mb-1">暂无 Agent</h3>
            <p className="text-sm text-[var(--color-accent-muted)]">
              创建你的第一个 AI 助手
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a, index) => (
            <motion.div
              key={a.agent_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group bg-white rounded-2xl border border-[var(--color-border)] p-5
                hover:border-[var(--color-border-strong)] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] 
                    flex items-center justify-center">
                    <Cube className="w-5 h-5 text-[var(--color-accent)]" weight="duotone" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--color-accent)]">{a.agent_id}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Circle 
                        className="w-2 h-2 text-emerald-500" 
                        weight="fill" 
                      />
                      <span className="text-xs text-[var(--color-accent-muted)]">{a.status}</span>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDelete(a.agent_id)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg 
                    hover:bg-red-50 text-[var(--color-accent-muted)] hover:text-red-500 
                    transition-all"
                >
                  <Trash className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}