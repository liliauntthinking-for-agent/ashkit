import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';

interface Agent {
  agent_id: string;
  status: string;
}

interface MemoryData {
  l1_working: { messages: { role: string; content: string }[] };
  l2_episodic: { summary: string; created_at: string }[];
  l3_semantic: { content: string }[];
}

export function Memory() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [activeLayer, setActiveLayer] = useState<'l1' | 'l2' | 'l3'>('l1');
  const [l3Content, setL3Content] = useState('');

  const loadAgents = useCallback(async () => {
    try {
      const data = await api.getAgents();
      setAgents(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleLoadMemory = async () => {
    if (!selectedAgent) {
      alert('请选择 Agent');
      return;
    }
    try {
      const data = await api.getMemory(selectedAgent);
      setMemoryData(data);
    } catch (e: any) {
      alert('加载失败: ' + e.message);
    }
  };

  const handleAddL3 = async () => {
    if (!selectedAgent) {
      alert('请选择 Agent');
      return;
    }
    if (!l3Content.trim()) {
      alert('请输入内容');
      return;
    }
    try {
      await api.addL3Memory(selectedAgent, l3Content.trim());
      setL3Content('');
      handleLoadMemory();
      alert('保存成功');
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    }
  };

  const renderContent = () => {
    if (!memoryData) return '选择 Agent 并加载记忆';

    switch (activeLayer) {
      case 'l1': {
        const msgs = memoryData.l1_working?.messages || [];
        return msgs.length > 0
          ? msgs.map((m) => `[${m.role}]: ${m.content}`).join('\n\n')
          : '暂无记忆';
      }
      case 'l2': {
        const episodes = memoryData.l2_episodic || [];
        return episodes.length > 0
          ? episodes.map((e) => `[${e.created_at}]\n${e.summary}`).join('\n\n')
          : '暂无记忆';
      }
      case 'l3': {
        const semantic = memoryData.l3_semantic || [];
        return semantic.length > 0
          ? semantic.map((m) => m.content).join('\n\n')
          : '暂无记忆';
      }
    }
  };

  return (
    <div className="card">
      <h2>记忆查看</h2>
      <div className="form-group">
        <label>选择 Agent</label>
        <select
          value={selectedAgent}
          onChange={(e) => {
            setSelectedAgent(e.target.value);
            setMemoryData(null);
          }}
        >
          <option value="">请先创建 Agent</option>
          {agents.map((a) => (
            <option key={a.agent_id} value={a.agent_id}>
              {a.agent_id}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" onClick={handleLoadMemory}>
        加载记忆
      </button>

      <div className="memory-section">
        <div className="memory-tabs">
          {(['l1', 'l2', 'l3'] as const).map((layer) => (
            <button
              key={layer}
              className={`memory-tab ${activeLayer === layer ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer)}
            >
              {layer === 'l1' ? 'L1 短期记忆' : layer === 'l2' ? 'L2 情景记忆' : 'L3 语义记忆'}
            </button>
          ))}
        </div>
        <div className="memory-content">{renderContent()}</div>
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <label>添加语义记忆 (L3)</label>
        <textarea
          placeholder="输入要保存的重要信息..."
          value={l3Content}
          onChange={(e) => setL3Content(e.target.value)}
        />
        <button
          className="btn btn-primary"
          style={{ marginTop: '8px' }}
          onClick={handleAddL3}
        >
          保存到 L3
        </button>
      </div>
    </div>
  );
}