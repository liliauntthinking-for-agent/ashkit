import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gear, Check, Plus, Trash, PuzzlePiece, PencilSimple, DownloadSimple, UploadSimple, X } from '@phosphor-icons/react';
import { useToast } from './Toast';
import * as api from '../api/client';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null);
  const [importPreview, setImportPreview] = useState<api.ImportPreview | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ashkit-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('导出成功');
    } catch (e: unknown) {
      const error = e as Error;
      showToast('导出失败: ' + error.message, 'error');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const preview = await api.importPreview(data);
      setImportData(data);
      setImportPreview(preview);
      setSelectedProviders(new Set(preview.providers.map(p => p.name)));
      setSelectedAgents(new Set(preview.agents.map(a => a.agent_id)));
      setSelectedUsers(new Set(preview.users.map(u => u.user_id)));
      setImportOverwrite(false);
      setShowImportModal(true);
    } catch (e: unknown) {
      const error = e as Error;
      showToast('读取文件失败: ' + error.message, 'error');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!importData) return;
    setImporting(true);
    try {
      const result = await api.importExecute(
        importData,
        Array.from(selectedProviders),
        Array.from(selectedAgents),
        Array.from(selectedUsers),
        importOverwrite
      );
      showToast(`导入成功: ${result.providers} 个提供商, ${result.agents} 个 Agent, ${result.users} 个用户`);
      setShowImportModal(false);
      setImportData(null);
      setImportPreview(null);
      fetchMCPServers();
    } catch (e: unknown) {
      const error = e as Error;
      showToast('导入失败: ' + error.message, 'error');
    } finally {
      setImporting(false);
    }
  };

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

      {/* Import/Export Card */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--color-border)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] flex items-center justify-center">
            <Gear className="w-5 h-5 text-[var(--color-accent)]" weight="duotone" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-accent)]">数据导入导出</h3>
            <p className="text-xs text-[var(--color-accent-muted)]">备份和恢复 Agent、用户、提供商配置</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] text-white rounded-xl font-medium text-sm"
          >
            <DownloadSimple className="w-5 h-5" />
            导出配置
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-surface)] text-[var(--color-accent)] rounded-xl font-medium text-sm border border-[var(--color-border)]"
          >
            <UploadSimple className="w-5 h-5" />
            导入配置
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <p className="text-xs text-[var(--color-accent-muted)]">
          导出包含所有 Agent、用户档案和提供商配置。导入时可选择性导入。
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

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && importPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--color-accent)]">选择要导入的内容</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-1 rounded-lg hover:bg-[var(--color-surface)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto space-y-4">
                {importPreview.providers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-[var(--color-accent)]">提供商 ({importPreview.providers.length})</h3>
                      <label className="flex items-center gap-2 text-xs text-[var(--color-accent-muted)]">
                        <input
                          type="checkbox"
                          checked={importPreview.providers.every(p => selectedProviders.has(p.name))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProviders(new Set(importPreview.providers.map(p => p.name)));
                            } else {
                              setSelectedProviders(new Set());
                            }
                          }}
                          className="rounded"
                        />
                        全选
                      </label>
                    </div>
                    <div className="space-y-1">
                      {importPreview.providers.map(p => (
                        <label key={p.name} className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg cursor-pointer hover:bg-[var(--color-border)]/30">
                          <input
                            type="checkbox"
                            checked={selectedProviders.has(p.name)}
                            onChange={(e) => {
                              const newSet = new Set(selectedProviders);
                              if (e.target.checked) newSet.add(p.name);
                              else newSet.delete(p.name);
                              setSelectedProviders(newSet);
                            }}
                            className="rounded"
                          />
                          <span className="flex-1 text-sm text-[var(--color-accent)]">{p.name}</span>
                          <span className="text-xs text-[var(--color-accent-muted)]">{p.model_count} 模型</span>
                          {p.exists && <span className="text-xs text-amber-600">已存在</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {importPreview.agents.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-[var(--color-accent)]">Agent ({importPreview.agents.length})</h3>
                      <label className="flex items-center gap-2 text-xs text-[var(--color-accent-muted)]">
                        <input
                          type="checkbox"
                          checked={importPreview.agents.every(a => selectedAgents.has(a.agent_id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgents(new Set(importPreview.agents.map(a => a.agent_id)));
                            } else {
                              setSelectedAgents(new Set());
                            }
                          }}
                          className="rounded"
                        />
                        全选
                      </label>
                    </div>
                    <div className="space-y-1">
                      {importPreview.agents.map(a => (
                        <label key={a.agent_id} className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg cursor-pointer hover:bg-[var(--color-border)]/30">
                          <input
                            type="checkbox"
                            checked={selectedAgents.has(a.agent_id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedAgents);
                              if (e.target.checked) newSet.add(a.agent_id);
                              else newSet.delete(a.agent_id);
                              setSelectedAgents(newSet);
                            }}
                            className="rounded"
                          />
                          <span className="flex-1 text-sm text-[var(--color-accent)]">{a.name || a.agent_id}</span>
                          <span className="text-xs text-[var(--color-accent-muted)]">{a.provider}/{a.model}</span>
                          {a.exists && <span className="text-xs text-amber-600">已存在</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {importPreview.users.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-[var(--color-accent)]">用户 ({importPreview.users.length})</h3>
                      <label className="flex items-center gap-2 text-xs text-[var(--color-accent-muted)]">
                        <input
                          type="checkbox"
                          checked={importPreview.users.every(u => selectedUsers.has(u.user_id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers(new Set(importPreview.users.map(u => u.user_id)));
                            } else {
                              setSelectedUsers(new Set());
                            }
                          }}
                          className="rounded"
                        />
                        全选
                      </label>
                    </div>
                    <div className="space-y-1">
                      {importPreview.users.map(u => (
                        <label key={u.user_id} className="flex items-center gap-2 p-2 bg-[var(--color-surface)] rounded-lg cursor-pointer hover:bg-[var(--color-border)]/30">
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(u.user_id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedUsers);
                              if (e.target.checked) newSet.add(u.user_id);
                              else newSet.delete(u.user_id);
                              setSelectedUsers(newSet);
                            }}
                            className="rounded"
                          />
                          <span className="flex-1 text-sm text-[var(--color-accent)]">{u.name || u.user_id}</span>
                          {u.exists && <span className="text-xs text-amber-600">已存在</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)] mt-4">
                <label className="flex items-center gap-2 text-sm text-[var(--color-accent-muted)]">
                  <input
                    type="checkbox"
                    checked={importOverwrite}
                    onChange={(e) => setImportOverwrite(e.target.checked)}
                    className="rounded"
                  />
                  覆盖已存在的项目
                </label>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-[var(--color-surface)] text-[var(--color-accent)] rounded-lg text-sm"
                  >
                    取消
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleImport}
                    disabled={importing || (selectedProviders.size === 0 && selectedAgents.size === 0 && selectedUsers.size === 0)}
                    className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {importing ? '导入中...' : `导入 (${selectedProviders.size + selectedAgents.size + selectedUsers.size})`}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}