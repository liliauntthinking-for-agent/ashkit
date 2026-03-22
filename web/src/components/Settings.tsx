import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gear, Check, Plus, Trash, PuzzlePiece, PencilSimple } from '@phosphor-icons/react';
import { useToast } from './Toast';

interface Settings {
  tools_max_calls: number;
  tools_enabled: boolean;
}

interface MCPServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  proxy?: string;
}

interface MCPTool {
  server: string;
  name: string;
  description: string;
  input_schema: any;
}

export function Settings() {
  const showToast = useToast();
  const [settings, setSettings] = useState<Settings>({
    tools_max_calls: 10,
    tools_enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [mcpServers, setMcpServers] = useState<Record<string, MCPServer>>({});
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [showAddServer, setShowAddServer] = useState(false);
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [jsonConfig, setJsonConfig] = useState('');
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchMCPServers();
    fetchMCPTools();
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

  const fetchMCPServers = async () => {
    try {
      const res = await fetch('/api/mcp/servers');
      if (res.ok) {
        const data = await res.json();
        setMcpServers(data || {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMCPTools = async () => {
    try {
      const res = await fetch('/api/mcp/tools');
      if (res.ok) {
        const data = await res.json();
        setMcpTools(data || []);
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

  const handleAddFromJson = async () => {
    setJsonError('');
    try {
      const config = JSON.parse(jsonConfig);
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        setJsonError('配置格式错误：缺少 mcpServers 对象');
        return;
      }
      
      let addedCount = 0;
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const server = serverConfig as MCPServer;
        const res = await fetch(`/api/mcp/servers/${name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: server.command,
            args: server.args || [],
            env: server.env,
            proxy: server.proxy,
          }),
        });
        if (res.ok) addedCount++;
      }
      
      if (addedCount > 0) {
        showToast(`成功 ${editingServer ? '更新' : '添加'} ${addedCount} 个 MCP 服务器`);
        setJsonConfig('');
        setShowAddServer(false);
        setEditingServer(null);
        fetchMCPServers();
        fetchMCPTools();
      } else {
        setJsonError('没有成功添加任何服务器');
      }
    } catch (e) {
      setJsonError('JSON 格式错误：' + (e as Error).message);
    }
  };

  const handleEditMCPServer = (name: string) => {
    const config = mcpServers[name];
    if (!config) return;
    
    const serverConfig: Record<string, MCPServer> = {};
    serverConfig[name] = {
      command: config.command,
      args: config.args || [],
      env: config.env,
      proxy: config.proxy,
    };
    
    setJsonConfig(JSON.stringify({ mcpServers: serverConfig }, null, 2));
    setEditingServer(name);
    setShowAddServer(true);
  };

  const handleDeleteMCPServer = async (name: string) => {
    if (!confirm(`确定删除 MCP 服务器 "${name}"?`)) return;
    
    try {
      const res = await fetch(`/api/mcp/servers/${name}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('已删除');
        fetchMCPServers();
        fetchMCPTools();
      }
    } catch (e) {
      showToast('删除失败', 'error');
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

      {/* MCP Servers Card */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] flex items-center justify-center">
              <PuzzlePiece className="w-5 h-5 text-[var(--color-accent)]" weight="duotone" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-accent)]">MCP 服务器</h3>
              <p className="text-xs text-[var(--color-accent-muted)]">Model Context Protocol 工具服务器</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowAddServer(true); setEditingServer(null); setJsonConfig(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" />
            添加
          </motion.button>
        </div>

        {/* Add/Edit Server Form */}
        {showAddServer && (
          <div className="p-4 bg-[var(--color-surface)] rounded-xl space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-accent-muted)] mb-1">
                {editingServer ? `编辑: ${editingServer}` : 'JSON 配置 (支持 Claude Desktop 配置格式)'}
              </label>
              <textarea
                value={jsonConfig}
                onChange={(e) => setJsonConfig(e.target.value)}
                placeholder={`{\n  "mcpServers": {\n    "brave-search": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-brave-search"],\n      "env": { "BRAVE_API_KEY": "your-key" },\n      "proxy": "http://127.0.0.1:7890"\n    }\n  }\n}`}
                className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm font-mono h-40 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]"
              />
              {jsonError && (
                <p className="text-xs text-red-500 mt-1">{jsonError}</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddFromJson}
                className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm"
              >
                {editingServer ? '保存' : '从 JSON 添加'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setShowAddServer(false); setJsonConfig(''); setJsonError(''); setEditingServer(null); }}
                className="px-4 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm"
              >
                取消
              </motion.button>
            </div>
          </div>
        )}

        {/* Server List */}
        {Object.keys(mcpServers).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(mcpServers).map(([name, config]) => (
              <div key={name} className="flex items-center justify-between p-3 bg-[var(--color-surface)] rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--color-accent)]">{name}</div>
                  <div className="text-xs text-[var(--color-accent-muted)] font-mono truncate">
                    {config.command} {config.args?.join(' ')}
                  </div>
                  {config.proxy && (
                    <div className="text-xs text-amber-600 mt-1">
                      代理: {config.proxy}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditMCPServer(name)}
                    className="p-2 rounded-lg hover:bg-white text-[var(--color-accent-muted)] hover:text-[var(--color-accent)] transition-colors"
                    title="编辑"
                  >
                    <PencilSimple className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteMCPServer(name)}
                    className="p-2 rounded-lg hover:bg-red-50 text-[var(--color-accent-muted)] hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-accent-muted)] text-sm">
            暂无 MCP 服务器配置
          </div>
        )}

        {/* Available Tools */}
        {mcpTools.length > 0 && (
          <div className="pt-4 border-t border-[var(--color-border)]">
            <h4 className="text-sm font-medium text-[var(--color-accent)] mb-2">可用工具</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {mcpTools.map((tool, i) => (
                <div key={i} className="text-xs p-2 bg-[var(--color-surface)] rounded">
                  <span className="font-mono text-[var(--color-accent)]">{tool.server}.{tool.name}</span>
                  {tool.description && (
                    <span className="text-[var(--color-accent-muted)] ml-2">- {tool.description}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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