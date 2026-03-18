import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';

interface Provider {
  name: string;
  api_base: string;
  has_key: boolean;
  models: string[];
}

export function Providers() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    api_base: '',
    api_key: '',
    models: '',
  });
  const [newModel, setNewModel] = useState({ provider: '', model: '' });

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
      alert('请输入 Provider 名称');
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
      loadProviders();
      alert('添加成功！');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm('确定删除此 Provider?')) return;
    await api.deleteProvider(name);
    loadProviders();
  };

  const handleAddModel = async () => {
    if (!newModel.provider || !newModel.model.trim()) {
      alert('请选择 Provider 并输入模型名称');
      return;
    }
    try {
      await api.addModel(newModel.provider, newModel.model.trim());
      setNewModel({ provider: '', model: '' });
      loadProviders();
      alert('添加成功！');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteModel = async (providerName: string, modelName: string) => {
    await api.deleteModel(providerName, modelName);
    loadProviders();
  };

  return (
    <div className="card">
      <h2>添加 Provider</h2>
      <div className="form-row">
        <div className="form-group">
          <label>Provider 名称</label>
          <input
            type="text"
            placeholder="如: openai, custom, deepseek"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>API Base URL</label>
          <input
            type="text"
            placeholder="如: https://api.openai.com/v1"
            value={formData.api_base}
            onChange={(e) => setFormData({ ...formData, api_base: e.target.value })}
          />
        </div>
      </div>
      <div className="form-group">
        <label>API Key</label>
        <input
          type="password"
          placeholder="输入 API Key"
          value={formData.api_key}
          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>模型列表 (逗号分隔)</label>
        <input
          type="text"
          placeholder="如: gpt-4o, gpt-3.5-turbo"
          value={formData.models}
          onChange={(e) => setFormData({ ...formData, models: e.target.value })}
        />
      </div>
      <button className="btn btn-primary" onClick={handleCreate}>
        添加 Provider
      </button>

      <h2 style={{ marginTop: '24px' }}>Provider 列表</h2>
      {providers.length === 0 ? (
        <div className="empty">暂无 Provider，请先添加</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>API Base</th>
              <th>API Key</th>
              <th>模型</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.api_base || '-'}</td>
                <td>{p.has_key ? '已配置' : '未配置'}</td>
                <td>
                  <div className="model-tags">
                    {p.models.length > 0 ? (
                      p.models.map((m) => (
                        <span key={m} className="tag">
                          {m}
                          <button
                            className="tag-remove"
                            onClick={() => handleDeleteModel(p.name, m)}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    ) : (
                      '-'
                    )}
                  </div>
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(p.name)}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: '24px' }}>添加模型到 Provider</h2>
      <div className="form-row">
        <div className="form-group">
          <label>选择 Provider</label>
          <select
            value={newModel.provider}
            onChange={(e) => setNewModel({ ...newModel, provider: e.target.value })}
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
          <label>模型名称</label>
          <input
            type="text"
            placeholder="如: gpt-4o-mini"
            value={newModel.model}
            onChange={(e) => setNewModel({ ...newModel, model: e.target.value })}
          />
        </div>
      </div>
      <button className="btn btn-primary" onClick={handleAddModel}>
        添加模型
      </button>
    </div>
  );
}