import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gear, Check } from '@phosphor-icons/react';
import { useToast } from './Toast';

interface Settings {
  tools_max_calls: number;
  tools_enabled: boolean;
}

export function Settings() {
  const showToast = useToast();
  const [settings, setSettings] = useState<Settings>({
    tools_max_calls: 10,
    tools_enabled: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 从后端加载设置
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showToast('设置已保存');
      } else {
        showToast('保存失败', 'error');
      }
    } catch (e) {
      showToast('保存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-accent)]">
          设置
        </h1>
        <p className="text-sm text-[var(--color-accent-muted)] mt-1">
          配置系统参数
        </p>
      </div>

      {/* Settings Card */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] flex items-center justify-center">
            <Gear className="w-5 h-5 text-[var(--color-accent)]" weight="duotone" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-accent)]">工具调用设置</h3>
            <p className="text-xs text-[var(--color-accent-muted)]">配置 AI 工具调用行为</p>
          </div>
        </div>

        {/* Max Tool Calls */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
            最大工具调用次数
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="20"
              value={settings.tools_max_calls}
              onChange={(e) => setSettings({ ...settings, tools_max_calls: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-[var(--color-surface)] rounded-lg appearance-none cursor-pointer"
            />
            <span className="w-12 text-center text-sm font-medium text-[var(--color-accent)]">
              {settings.tools_max_calls}
            </span>
          </div>
          <p className="text-xs text-[var(--color-accent-muted)] mt-1">
            限制 AI 连续调用工具的最大轮次，防止无限循环
          </p>
        </div>

        {/* Enable Tools */}
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-[var(--color-accent)]">
              启用工具调用
            </label>
            <p className="text-xs text-[var(--color-accent-muted)]">
              允许 AI 使用工具（bash、read、write 等）
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.tools_enabled}
              onChange={(e) => setSettings({ ...settings, tools_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--color-surface)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
          </label>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-[var(--color-border)]">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-accent)] text-white rounded-xl font-medium text-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {loading ? '保存中...' : '保存设置'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}