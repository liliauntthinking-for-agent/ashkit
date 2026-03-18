import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';

interface Provider {
  name: string;
  models: string[];
}

interface Agent {
  agent_id: string;
  status: string;
}

interface AgentsProps {
  onAgentsChange?: () => void;
}

export function Agents({ onAgentsChange }: AgentsProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [formData, setFormData] = useState({
    agent_id: '',
    provider: '',
    model: '',
  });

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
      alert('请输入 Agent ID');
      return;
    }
    if (!formData.provider) {
      alert('请选择 Provider');
      return;
    }
    if (!formData.model) {
      alert('请选择模型');
      return;
    }
    try {
      await api.createAgent({
        agent_id: formData.agent_id.trim(),
        provider: formData.provider,
        model: formData.model,
      });
      setFormData({ agent_id: '', provider: '', model: '' });
      loadData();
      onAgentsChange?.();
      alert('创建成功！');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('确定删除此 Agent?')) return;
    await api.deleteAgent(agentId);
    loadData();
    onAgentsChange?.();
  };

  return (
    <div className="card">
      <h2>创建 Agent</h2>
      <div className="form-group">
        <label>Agent ID</label>
        <input
          type="text"
          placeholder="输入 Agent ID"
          value={formData.agent_id}
          onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Provider</label>
          <select
            value={formData.provider}
            onChange={(e) => setFormData({ ...formData, provider: e.target.value, model: '' })}
          >
            <option value="">请先添加 Provider</option>
            {providers.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>模型</label>
          <select
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            disabled={!formData.provider}
          >
            <option value="">
              {!formData.provider
                ? '请先选择 Provider'
                : selectedProvider?.models.length === 0
                ? '该 Provider 暂无模型'
                : '选择模型'}
            </option>
            {selectedProvider?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={handleCreate}>
        创建
      </button>

      <h2 style={{ marginTop: '24px' }}>Agent 列表</h2>
      {agents.length === 0 ? (
        <div className="empty">暂无 Agent</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.agent_id}>
                <td>{a.agent_id}</td>
                <td>
                  <span className="status status-active">{a.status}</span>
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(a.agent_id)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}