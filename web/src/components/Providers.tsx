import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlugsConnected, Plus, Trash, Globe, Cube,
  Warning, CheckCircle 
} from '@phosphor-icons/react';
import { useToast } from './Toast';
import * as api from '../api/client';

interface Provider {
  name: string;
  api_base: string;
  has_key: boolean;
  models: string[];
}

export function Providers() {
  const showToast = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    api_base: '',
    api_key: '',
    models: '',
  });
  const [newModel, setNewModel] = useState({ provider: '', model: '' });
  const [showForm, setShowForm] = useState(false);

  const loadProviders = useCallback(async () => {
    try {
      const data = await api.getProviders();
      setProviders(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      showToast('请输入 Provider 名称', 'error');
      return;
    }
    try {
      const models = formData.models
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m);
      await api.createProvider({
        name: formData.name.trim(),
        api_base: formData.api_base.trim(),
        api_key: formData.api_key,
        models,
      });
      setFormData({ name: '', api_base: '', api_key: '', models: '' });
      setShowForm(false);
      loadProviders();
      showToast('添加成功');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm('确定删除此 Provider?')) return;
    await api.deleteProvider(name);
    loadProviders();
    showToast('已删除');
  };

  const handleAddModel = async () => {
    if (!newModel.provider || !newModel.model.trim()) {
      showToast('请选择 Provider 并输入模型名称', 'error');
      return;
    }
    try {
      await api.addModel(newModel.provider, newModel.model.trim());
      setNewModel({ provider: '', model: '' });
      loadProviders();
      showToast('添加成功');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteModel = async (providerName: string, modelName: string) => {
    await api.deleteModel(providerName, modelName);
    loadProviders();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-accent)]">
            模型提供商
          </h1>
          <p className="text-sm text-[var(--color-accent-muted)] mt-1">
            管理你的 AI 模型提供商和 API 配置
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
          添加提供商
        </motion.button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 space-y-4">
              <h3 className="text-base font-semibold text-[var(--color-accent)]">新建 Provider</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                    Provider 名称
                  </label>
                  <input
                    type="text"
                    placeholder="如: openai, deepseek"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                      focus:border-[var(--color-accent)] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                    API Base URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    value={formData.api_base}
                    onChange={(e) => setFormData({ ...formData, api_base: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                      focus:border-[var(--color-accent)] transition-all"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  模型列表 (逗号分隔)
                </label>
                <input
                  type="text"
                  placeholder="gpt-4o, gpt-4o-mini"
                  value={formData.models}
                  onChange={(e) => setFormData({ ...formData, models: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreate}
                  className="px-4 py-2.5 bg-[var(--color-accent)] text-white 
                    rounded-xl font-medium text-sm"
                >
                  添加
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
        )}
      </AnimatePresence>

      {/* Provider List */}
      {providers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] 
              flex items-center justify-center">
              <PlugsConnected className="w-8 h-8 text-[var(--color-accent-muted)]" weight="duotone" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-accent)] mb-1">暂无提供商</h3>
            <p className="text-sm text-[var(--color-accent-muted)]">
              添加一个模型提供商开始使用
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {providers.map((p, index) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl border border-[var(--color-border)] p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] 
                    flex items-center justify-center">
                    <Cube className="w-5 h-5 text-[var(--color-accent)]" weight="duotone" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--color-accent)]">{p.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-accent-muted)]">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {p.api_base || '未配置'}
                      </span>
                      <span className={`flex items-center gap-1 ${p.has_key ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {p.has_key ? (
                          <>
                            <CheckCircle className="w-3 h-3" weight="fill" />
                            已配置 Key
                          </>
                        ) : (
                          <>
                            <Warning className="w-3 h-3" weight="fill" />
                            未配置 Key
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDelete(p.name)}
                  className="p-2 rounded-lg hover:bg-red-50 text-[var(--color-accent-muted)] 
                    hover:text-red-500 transition-colors"
                >
                  <Trash className="w-4 h-4" />
                </motion.button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {p.models.length > 0 ? (
                  p.models.map((m) => (
                    <span
                      key={m}
                      className="group flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface)]
                        rounded-lg text-sm text-[var(--color-accent)]"
                    >
                      {m}
                      <button
                        onClick={() => handleDeleteModel(p.name, m)}
                        className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full
                          hover:bg-red-100 text-[var(--color-accent-muted)] hover:text-red-500
                          flex items-center justify-center transition-all"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[var(--color-accent-muted)]">暂无模型</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Model Section */}
      {providers.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
          <h3 className="text-base font-semibold text-[var(--color-accent)] mb-4">添加模型</h3>
          <div className="flex gap-3">
            <select
              value={newModel.provider}
              onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
              className="flex-1 px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            >
              <option value="">选择 Provider</option>
              {providers.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="模型名称"
              value={newModel.model}
              onChange={(e) => setNewModel({ ...newModel, model: e.target.value })}
              className="flex-1 px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAddModel}
              className="px-4 py-2.5 bg-[var(--color-accent)] text-white 
                rounded-xl font-medium text-sm"
            >
              添加
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}