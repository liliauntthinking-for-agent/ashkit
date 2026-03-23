import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cube, Plus, Circle, User, IdentificationBadge, Users, PencilSimple, Check, Heart, Play, Clock, Scroll, Camera } from '@phosphor-icons/react';
import { useToast } from './Toast';
import * as api from '../api/client';

interface Provider {
  name: string;
  models: string[];
}

type Agent = api.Agent;
type User = api.User;

const errorMessages: Record<string, string> = {
  'Agent already exists': 'Agent ID 已存在，请使用其他名称',
  'Provider not found': 'Provider 不存在',
  'Model not found': 'Model 不存在',
};

const translateError = (msg: string) => errorMessages[msg] || msg;

const defaultProfile = {
  name: '',
  nickname: '',
  avatar: '',
  gender: '',
  birthday: '',
  height: '',
  weight: '',
  blood_type: '',
  email: '',
  address: '',
  school: '',
  education: '',
  nationality: '',
  personality: '',
  hobbies: '',
  skills: '',
  mbti: '',
  background: '',
};

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
];

const bloodTypeOptions = [
  { value: 'A', label: 'A型' },
  { value: 'B', label: 'B型' },
  { value: 'O', label: 'O型' },
  { value: 'AB', label: 'AB型' },
];

const educationOptions = [
  { value: 'primary', label: '小学' },
  { value: 'junior', label: '初中' },
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大专' },
  { value: 'bachelor', label: '本科' },
  { value: 'master', label: '硕士' },
  { value: 'doctor', label: '博士' },
];

const mbtiOptions = [
  { value: 'INTJ', label: 'INTJ', desc: '建筑师 - 富有想象力的战略家' },
  { value: 'INTP', label: 'INTP', desc: '逻辑学家 - 创新的发明家' },
  { value: 'ENTJ', label: 'ENTJ', desc: '指挥官 - 大胆的领导者' },
  { value: 'ENTP', label: 'ENTP', desc: '辩论家 - 聪明的探索者' },
  { value: 'INFJ', label: 'INFJ', desc: '提倡者 - 安静的理想主义者' },
  { value: 'INFP', label: 'INFP', desc: '调停者 - 诗意的理想主义者' },
  { value: 'ENFJ', label: 'ENFJ', desc: '主人公 - 富有魅力的领导者' },
  { value: 'ENFP', label: 'ENFP', desc: '竞选者 - 热情的探索者' },
  { value: 'ISTJ', label: 'ISTJ', desc: '物流师 - 可靠的实干家' },
  { value: 'ISFJ', label: 'ISFJ', desc: '守卫者 - 忠诚的守护者' },
  { value: 'ESTJ', label: 'ESTJ', desc: '总经理 - 优秀的管理者' },
  { value: 'ESFJ', label: 'ESFJ', desc: '执政官 - 热心的助人者' },
  { value: 'ISTP', label: 'ISTP', desc: '鉴赏家 - 大胆的实验家' },
  { value: 'ISFP', label: 'ISFP', desc: '探险家 - 灵活的艺术家' },
  { value: 'ESTP', label: 'ESTP', desc: '企业家 - 精明的冒险家' },
  { value: 'ESFP', label: 'ESFP', desc: '表演者 - 自发的娱乐者' },
];

const relationOptions = [
  { value: 'friend', label: '朋友' },
  { value: 'best_friend', label: '挚友' },
  { value: 'partner', label: '伴侣' },
  { value: 'assistant', label: '助手' },
  { value: 'mentor', label: '导师' },
  { value: 'student', label: '学生' },
  { value: 'colleague', label: '同事' },
  { value: 'family', label: '家人' },
  { value: 'acquaintance', label: '熟人' },
  { value: 'stranger', label: '陌生人' },
];

export function Agents() {
  const showToast = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    agent_id: '',
    provider: '',
    model: '',
    profile: { ...defaultProfile },
    user_id: '',
    relation: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{
    profile: typeof defaultProfile | null;
    user_id: string;
    relation: string;
  }>({ profile: null, user_id: '', relation: '' });
  const [heartbeatConfig, setHeartbeatConfig] = useState<api.HeartbeatConfig>({
    enabled: false,
    interval_minutes: 30,
    prompt: '根据你的记忆内容，思考是否有需要主动做的事情。如果有，说明是什么以及为什么；如果没有，说明当前状态良好。',
  });
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);
  const [heartbeatLogs, setHeartbeatLogs] = useState<api.HeartbeatLog[]>([]);
  const [showHeartbeatLogs, setShowHeartbeatLogs] = useState(false);
  const [heartbeatLoading, setHeartbeatLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [providersData, agentsData, usersData] = await Promise.all([
        api.getProviders(),
        api.getAgents(),
        api.getUsers(),
      ]);
      setProviders(providersData);
      setAgents(agentsData);
      setUsers(usersData);
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
      const profileData = {
        ...formData.profile,
        height: formData.profile.height ? parseInt(formData.profile.height) : null,
        weight: formData.profile.weight ? parseInt(formData.profile.weight) : null,
      };
      await api.createAgent({
        agent_id: formData.agent_id.trim(),
        provider: formData.provider,
        model: formData.model,
        profile: profileData,
        user_id: formData.user_id || undefined,
        relation: formData.relation || undefined,
      });
      setFormData({ agent_id: '', provider: '', model: '', profile: { ...defaultProfile }, user_id: '', relation: '' });
      setShowForm(false);
      loadData();
      showToast('创建成功');
    } catch (e: unknown) {
      const error = e as Error;
      showToast(translateError(error.message), 'error');
    }
  };

  const handleView = async (agent: Agent) => {
    try {
      const detail = await api.getAgent(agent.agent_id);
      setSelectedAgent(detail);
      setShowDetail(true);
      setIsEditing(false);
      setEditData({ profile: null, user_id: '', relation: '' });

      // Fetch heartbeat config
      const heartbeatStatus = await api.getAgentHeartbeat(agent.agent_id);
      if (heartbeatStatus.heartbeat) {
        setHeartbeatConfig(heartbeatStatus.heartbeat);
      } else {
        setHeartbeatConfig({
          enabled: false,
          interval_minutes: 30,
          prompt: '根据你的记忆内容，思考是否有需要主动做的事情。如果有，说明是什么以及为什么；如果没有，说明当前状态良好。',
        });
      }
      setHeartbeatRunning(heartbeatStatus.is_running);
      setHeartbeatLogs([]);
      setShowHeartbeatLogs(false);
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    }
  };

  const handleEdit = () => {
    if (selectedAgent?.profile) {
      setEditData({
        profile: {
          ...defaultProfile,
          ...selectedAgent.profile,
          height: selectedAgent.profile.height?.toString() || '',
          weight: selectedAgent.profile.weight?.toString() || '',
        },
        user_id: selectedAgent.user_id || '',
        relation: selectedAgent.relation || '',
      });
      setIsEditing(true);
    }
  };

  const handleUpdate = async () => {
    if (!selectedAgent || !editData.profile) return;
    try {
      const profileData = {
        ...editData.profile,
        height: editData.profile.height ? parseInt(editData.profile.height) : null,
        weight: editData.profile.weight ? parseInt(editData.profile.weight) : null,
      };
      await api.updateAgent(selectedAgent.agent_id, {
        profile: profileData,
        user_id: editData.user_id || undefined,
        relation: editData.relation || undefined,
      });
      const detail = await api.getAgent(selectedAgent.agent_id);
      setSelectedAgent(detail);
      setIsEditing(false);
      setEditData({ profile: null, user_id: '', relation: '' });
      loadData();
      showToast('更新成功');
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    }
  };

  const updateEditProfile = (key: string, value: string) => {
    if (!editData.profile) return;
    setEditData({
      ...editData,
      profile: { ...editData.profile, [key]: value },
    });
  };

  const updateProfile = (key: string, value: string) => {
    setFormData({
      ...formData,
      profile: { ...formData.profile, [key]: value },
    });
  };

  const handleUpdateHeartbeat = async () => {
    if (!selectedAgent) return;
    setHeartbeatLoading(true);
    try {
      const status = await api.updateAgentHeartbeat(selectedAgent.agent_id, heartbeatConfig);
      setHeartbeatRunning(status.is_running);
      showToast(heartbeatConfig.enabled ? '心跳已启用' : '心跳已禁用');
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    } finally {
      setHeartbeatLoading(false);
    }
  };

  const handleTriggerHeartbeat = async () => {
    if (!selectedAgent) return;
    setHeartbeatLoading(true);
    try {
      await api.triggerHeartbeat(selectedAgent.agent_id);
      showToast('心跳触发成功');
      // Refresh logs
      const logsData = await api.getHeartbeatLogs(selectedAgent.agent_id);
      setHeartbeatLogs(logsData.logs);
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    } finally {
      setHeartbeatLoading(false);
    }
  };

  const handleFetchHeartbeatLogs = async () => {
    if (!selectedAgent) return;
    try {
      const logsData = await api.getHeartbeatLogs(selectedAgent.agent_id);
      setHeartbeatLogs(logsData.logs);
      setShowHeartbeatLogs(true);
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    }
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
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 space-y-6">
          <h3 className="text-base font-semibold text-[var(--color-accent)]">创建新 Agent</h3>
          
          {/* Basic Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]">
              <IdentificationBadge className="w-4 h-4" />
              基本设置
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  Agent ID <span className="text-red-500">*</span>
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
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  Provider <span className="text-red-500">*</span>
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
                  模型 <span className="text-red-500">*</span>
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

          {/* User Relation Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]">
              <Users className="w-4 h-4" />
              用户关系
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  关联用户
                </label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value, relation: '' })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                >
                  <option value="">不关联用户</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.profile?.name || u.user_id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  与用户的关系
                </label>
                <select
                  value={formData.relation}
                  onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
                  disabled={!formData.user_id}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!formData.user_id ? '请先选择用户' : '请选择关系'}
                  </option>
                  {relationOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Profile Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]">
              <User className="w-4 h-4" />
              人物档案
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 姓名 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  姓名
                </label>
                <input
                  type="text"
                  placeholder="真实姓名"
                  value={formData.profile.name}
                  onChange={(e) => updateProfile('name', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 昵称 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  昵称
                </label>
                <input
                  type="text"
                  placeholder="常用称呼"
                  value={formData.profile.nickname}
                  onChange={(e) => updateProfile('nickname', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 性别 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  性别
                </label>
                <select
                  value={formData.profile.gender}
                  onChange={(e) => updateProfile('gender', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                >
                  <option value="">请选择</option>
                  {genderOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              {/* 生日 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  生日
                </label>
                <input
                  type="date"
                  value={formData.profile.birthday}
                  onChange={(e) => updateProfile('birthday', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 身高 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  身高
                </label>
                <div className="flex">
                  <input
                    type="number"
                    placeholder="170"
                    value={formData.profile.height}
                    onChange={(e) => updateProfile('height', e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-l-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                      focus:border-[var(--color-accent)] transition-all"
                  />
                  <span className="px-3 py-2.5 bg-[var(--color-border)] text-[var(--color-accent-muted)] 
                    text-sm rounded-r-xl border border-l-0 border-[var(--color-border)]">cm</span>
                </div>
              </div>
              
              {/* 体重 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  体重
                </label>
                <div className="flex">
                  <input
                    type="number"
                    placeholder="60"
                    value={formData.profile.weight}
                    onChange={(e) => updateProfile('weight', e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-l-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                      focus:border-[var(--color-accent)] transition-all"
                  />
                  <span className="px-3 py-2.5 bg-[var(--color-border)] text-[var(--color-accent-muted)] 
                    text-sm rounded-r-xl border border-l-0 border-[var(--color-border)]">kg</span>
                </div>
              </div>
              
              {/* 血型 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  血型
                </label>
                <select
                  value={formData.profile.blood_type}
                  onChange={(e) => updateProfile('blood_type', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                >
                  <option value="">请选择</option>
                  {bloodTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              {/* 邮箱 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  邮箱
                </label>
                <input
                  type="email"
                  placeholder="电子邮箱"
                  value={formData.profile.email}
                  onChange={(e) => updateProfile('email', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 住址 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  住址
                </label>
                <input
                  type="text"
                  placeholder="详细地址"
                  value={formData.profile.address}
                  onChange={(e) => updateProfile('address', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 学校 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  学校
                </label>
                <input
                  type="text"
                  placeholder="就读学校"
                  value={formData.profile.school}
                  onChange={(e) => updateProfile('school', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 学历 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  学历
                </label>
                <select
                  value={formData.profile.education}
                  onChange={(e) => updateProfile('education', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                >
                  <option value="">请选择</option>
                  {educationOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              {/* 国籍 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  国籍
                </label>
                <input
                  type="text"
                  placeholder="国籍"
                  value={formData.profile.nationality}
                  onChange={(e) => updateProfile('nationality', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 性格 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  性格
                </label>
                <input
                  type="text"
                  placeholder="性格特点"
                  value={formData.profile.personality}
                  onChange={(e) => updateProfile('personality', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 爱好 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  爱好
                </label>
                <input
                  type="text"
                  placeholder="兴趣爱好"
                  value={formData.profile.hobbies}
                  onChange={(e) => updateProfile('hobbies', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
              
              {/* 技能 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  技能
                </label>
                <input
                  type="text"
                  placeholder="专业技能"
                  value={formData.profile.skills}
                  onChange={(e) => updateProfile('skills', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
            </div>
            
            {/* MBTI - Full width with description */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                MBTI 人格类型
              </label>
              <select
                value={formData.profile.mbti}
                onChange={(e) => updateProfile('mbti', e.target.value)}
                className="w-full md:w-1/2 px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                  rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
              >
                <option value="">请选择</option>
                {mbtiOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label} - {opt.desc}</option>
                ))}
              </select>
            </div>
            
            {/* Background - Full width textarea */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                背景故事
              </label>
              <textarea
                placeholder="人物背景、经历、故事等详细描述..."
                value={formData.profile.background}
                onChange={(e) => updateProfile('background', e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                  rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                  focus:border-[var(--color-accent)] transition-all resize-none"
              />
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
              onClick={() => handleView(a)}
              className="group bg-white rounded-2xl border border-[var(--color-border)] p-5
                hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] 
                    flex items-center justify-center">
                    <User className="w-5 h-5 text-[var(--color-accent)]" weight="duotone" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--color-accent)]">
                      {a.profile?.name || a.agent_id}
                    </h3>
                    {a.profile?.name && (
                      <p className="text-xs text-[var(--color-accent-muted)]">{a.agent_id}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Circle 
                          className="w-2 h-2 text-emerald-500" 
                          weight="fill" 
                        />
                        <span className="text-xs text-[var(--color-accent-muted)]">{a.status}</span>
                      </div>
                      {a.profile?.school && (
                        <span className="text-xs text-[var(--color-accent-muted)]">· {a.profile.school}</span>
                      )}
                      {a.user_id && a.relation && (
                        <span className="text-xs text-[var(--color-accent-muted)]">
                          · {relationOptions.find(r => r.value === a.relation)?.label || a.relation}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Agent Detail Modal */}
      {showDetail && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-surface)] 
                    flex items-center justify-center overflow-hidden">
                    {selectedAgent.profile?.avatar ? (
                      <img 
                        src={selectedAgent.profile.avatar} 
                        alt={selectedAgent.profile?.name || selectedAgent.agent_id}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-[var(--color-accent)]" weight="duotone" />
                    )}
                  </div>
                  {isEditing && (
                    <label className="absolute -bottom-1 -right-1 w-5 h-5 bg-[var(--color-accent)] 
                      rounded-full flex items-center justify-center cursor-pointer hover:bg-[var(--color-accent)]/80">
                      <Camera className="w-3 h-3 text-white" weight="fill" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && selectedAgent) {
                            try {
                              const result = await api.uploadAvatar('agent', selectedAgent.agent_id, file);
                              const updated = await api.getAgent(selectedAgent.agent_id);
                              setSelectedAgent(updated);
                              if (editData.profile) {
                                setEditData({
                                  ...editData,
                                  profile: { ...editData.profile, avatar: result.avatar }
                                });
                              }
                              loadData();
                            } catch (err) {
                              showToast('头像上传失败', 'error');
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--color-accent)]">
                    {isEditing ? '编辑 Agent' : (selectedAgent.profile?.name || selectedAgent.agent_id)}
                  </h2>
                  <p className="text-sm text-[var(--color-accent-muted)]">{selectedAgent.agent_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white 
                      rounded-lg font-medium text-sm"
                  >
                    <PencilSimple className="w-4 h-4" weight="bold" />
                    编辑
                  </motion.button>
                )}
                <button
                  onClick={() => {
                    setShowDetail(false);
                    setIsEditing(false);
                    setEditData({ profile: null, user_id: '', relation: '' });
                  }}
                  className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {!isEditing ? (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-[var(--color-surface)] rounded-xl p-4">
                    <label className="text-xs text-[var(--color-accent-muted)]">Provider</label>
                    <p className="text-sm font-medium text-[var(--color-accent)]">{selectedAgent.provider}</p>
                  </div>
                  <div className="bg-[var(--color-surface)] rounded-xl p-4">
                    <label className="text-xs text-[var(--color-accent-muted)]">Model</label>
                    <p className="text-sm font-medium text-[var(--color-accent)]">{selectedAgent.model}</p>
                  </div>
                  <div className="bg-[var(--color-surface)] rounded-xl p-4">
                    <label className="text-xs text-[var(--color-accent-muted)]">Status</label>
                    <p className="text-sm font-medium text-[var(--color-accent)] flex items-center gap-1">
                      <Circle className="w-2 h-2 text-emerald-500" weight="fill" />
                      {selectedAgent.status}
                    </p>
                  </div>
                </div>

                {/* Profile Info */}
                {selectedAgent.profile && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-3">人物档案</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedAgent.profile.name && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">姓名</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.name}</p>
                        </div>
                      )}
                      {selectedAgent.profile.nickname && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">昵称</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.nickname}</p>
                        </div>
                      )}
                      {selectedAgent.profile.gender && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">性别</label>
                          <p className="text-sm text-[var(--color-accent)]">
                            {genderOptions.find(g => g.value === selectedAgent.profile?.gender)?.label || selectedAgent.profile.gender}
                          </p>
                        </div>
                      )}
                      {selectedAgent.profile.birthday && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">生日</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.birthday}</p>
                        </div>
                      )}
                      {selectedAgent.profile.height && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">身高</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.height} cm</p>
                        </div>
                      )}
                      {selectedAgent.profile.weight && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">体重</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.weight} kg</p>
                        </div>
                      )}
                      {selectedAgent.profile.blood_type && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">血型</label>
                          <p className="text-sm text-[var(--color-accent)]">
                            {bloodTypeOptions.find(b => b.value === selectedAgent.profile?.blood_type)?.label || selectedAgent.profile.blood_type}
                          </p>
                        </div>
                      )}
                      {selectedAgent.profile.email && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">邮箱</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.email}</p>
                        </div>
                      )}
                      {selectedAgent.profile.address && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">住址</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.address}</p>
                        </div>
                      )}
                      {selectedAgent.profile.school && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">学校</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.school}</p>
                        </div>
                      )}
                      {selectedAgent.profile.education && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">学历</label>
                          <p className="text-sm text-[var(--color-accent)]">
                            {educationOptions.find(e => e.value === selectedAgent.profile?.education)?.label || selectedAgent.profile.education}
                          </p>
                        </div>
                      )}
                      {selectedAgent.profile.nationality && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">国籍</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.nationality}</p>
                        </div>
                      )}
                      {selectedAgent.profile.personality && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">性格</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.personality}</p>
                        </div>
                      )}
                      {selectedAgent.profile.hobbies && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">爱好</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.hobbies}</p>
                        </div>
                      )}
                      {selectedAgent.profile.skills && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">技能</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedAgent.profile.skills}</p>
                        </div>
                      )}
                      {selectedAgent.profile.mbti && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">MBTI</label>
                          <p className="text-sm text-[var(--color-accent)]">
                            {mbtiOptions.find(m => m.value === selectedAgent.profile?.mbti)?.desc || selectedAgent.profile.mbti}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedAgent.profile.background && (
                      <div className="mt-4">
                      <label className="text-xs text-[var(--color-accent-muted)]">背景故事</label>
                      <p className="text-sm text-[var(--color-accent)] mt-1">{selectedAgent.profile.background}</p>
                    </div>
                    )}
                  </div>
                )}

                {/* User Relation */}
                {selectedAgent.user_id && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-3">用户关系</h3>
                    <div className="bg-[var(--color-surface)] rounded-xl p-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--color-accent-muted)]" />
                        <span className="text-sm text-[var(--color-accent)]">
                          关联用户: {selectedAgent.user_id}
                        </span>
                        {selectedAgent.relation && (
                          <span className="text-sm text-[var(--color-accent-muted)]">
                            · {relationOptions.find(r => r.value === selectedAgent.relation)?.label || selectedAgent.relation}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Heartbeat Config */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[var(--color-accent)] flex items-center gap-2">
                      <Heart className="w-4 h-4" weight="duotone" />
                      心跳机制
                    </h3>
                    <div className="flex items-center gap-1">
                      {heartbeatRunning && (
                        <span className="text-xs text-emerald-500 flex items-center gap-1">
                          <Circle className="w-2 h-2" weight="fill" /> 运行中
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-[var(--color-surface)] rounded-xl p-4 space-y-4">
                    {/* Enable/Disable */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-[var(--color-accent)]">启用心跳</label>
                        <p className="text-xs text-[var(--color-accent-muted)]">定时执行系统提示词</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={heartbeatConfig.enabled}
                          onChange={(e) => setHeartbeatConfig({ ...heartbeatConfig, enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-white border border-[var(--color-border)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]"></div>
                      </label>
                    </div>

                    {/* Interval */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        间隔时间 (分钟)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={heartbeatConfig.interval_minutes}
                        onChange={(e) => setHeartbeatConfig({ ...heartbeatConfig, interval_minutes: parseInt(e.target.value) || 30 })}
                        className="w-24 px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm"
                      />
                    </div>

                    {/* Prompt */}
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                        系统提示词
                      </label>
                      <textarea
                        value={heartbeatConfig.prompt}
                        onChange={(e) => setHeartbeatConfig({ ...heartbeatConfig, prompt: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm resize-none"
                        placeholder="心跳时执行的提示词..."
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleUpdateHeartbeat}
                        disabled={heartbeatLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-lg text-sm"
                      >
                        <Check className="w-4 h-4" />
                        保存配置
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleTriggerHeartbeat}
                        disabled={heartbeatLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[var(--color-border)] rounded-lg text-sm"
                      >
                        <Play className="w-4 h-4" />
                        立即触发
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleFetchHeartbeatLogs}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[var(--color-border)] rounded-lg text-sm"
                      >
                        <Scroll className="w-4 h-4" />
                        日志
                      </motion.button>
                    </div>

                    {/* Logs */}
                    {showHeartbeatLogs && heartbeatLogs.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                        <h4 className="text-sm font-medium text-[var(--color-accent)] mb-2">心跳日志</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {heartbeatLogs.map((log) => (
                            <div key={log.id} className="p-3 bg-white rounded-lg border border-[var(--color-border)]">
                              <div className="text-xs text-[var(--color-accent-muted)] mb-1">
                                {new Date(log.created_at).toLocaleString()}
                              </div>
                              {log.response && (
                                <div className="text-sm text-[var(--color-accent)]">{log.response}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                </div>
            ) : (
              <div className="space-y-4">
                {/* Profile Edit Form */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">姓名</label>
                    <input
                      type="text"
                      value={editData.profile?.name || ''}
                      onChange={(e) => updateEditProfile('name', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">昵称</label>
                    <input
                      type="text"
                      value={editData.profile?.nickname || ''}
                      onChange={(e) => updateEditProfile('nickname', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">性别</label>
                    <select
                      value={editData.profile?.gender || ''}
                      onChange={(e) => updateEditProfile('gender', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    >
                      <option value="">请选择</option>
                      {genderOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">生日</label>
                    <input
                      type="date"
                      value={editData.profile?.birthday || ''}
                      onChange={(e) => updateEditProfile('birthday', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">身高 (cm)</label>
                    <input
                      type="number"
                      value={editData.profile?.height || ''}
                      onChange={(e) => updateEditProfile('height', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">体重 (kg)</label>
                    <input
                      type="number"
                      value={editData.profile?.weight || ''}
                      onChange={(e) => updateEditProfile('weight', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">血型</label>
                    <select
                      value={editData.profile?.blood_type || ''}
                      onChange={(e) => updateEditProfile('blood_type', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    >
                      <option value="">请选择</option>
                      {bloodTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">邮箱</label>
                    <input
                      type="email"
                      value={editData.profile?.email || ''}
                      onChange={(e) => updateEditProfile('email', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">住址</label>
                    <input
                      type="text"
                      value={editData.profile?.address || ''}
                      onChange={(e) => updateEditProfile('address', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">学校</label>
                    <input
                      type="text"
                      value={editData.profile?.school || ''}
                      onChange={(e) => updateEditProfile('school', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">学历</label>
                    <select
                      value={editData.profile?.education || ''}
                      onChange={(e) => updateEditProfile('education', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    >
                      <option value="">请选择</option>
                      {educationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">国籍</label>
                    <input
                      type="text"
                      value={editData.profile?.nationality || ''}
                      onChange={(e) => updateEditProfile('nationality', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">性格</label>
                    <input
                      type="text"
                      value={editData.profile?.personality || ''}
                      onChange={(e) => updateEditProfile('personality', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">爱好</label>
                    <input
                      type="text"
                      value={editData.profile?.hobbies || ''}
                      onChange={(e) => updateEditProfile('hobbies', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">技能</label>
                    <input
                      type="text"
                      value={editData.profile?.skills || ''}
                      onChange={(e) => updateEditProfile('skills', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">MBTI</label>
                    <select
                      value={editData.profile?.mbti || ''}
                      onChange={(e) => updateEditProfile('mbti', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    >
                      <option value="">请选择</option>
                      {mbtiOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label} - {opt.desc}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">背景故事</label>
                  <textarea
                    value={editData.profile?.background || ''}
                    onChange={(e) => updateEditProfile('background', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 resize-none"
                  />
                </div>

                {/* User Relation Edit */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">关联用户</label>
                    <select
                      value={editData.user_id}
                      onChange={(e) => setEditData({ ...editData, user_id: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    >
                      <option value="">不关联用户</option>
                      {users.map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.profile?.name || u.user_id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">与用户的关系</label>
                    <select
                      value={editData.relation}
                      onChange={(e) => setEditData({ ...editData, relation: e.target.value })}
                      disabled={!editData.user_id}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{!editData.user_id ? '请先选择用户' : '请选择关系'}</option>
                      {relationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-[var(--color-border)]">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUpdate}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white 
                      rounded-lg font-medium text-sm"
                  >
                    <Check className="w-4 h-4" weight="bold" />
                    保存
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({ profile: null, user_id: '', relation: '' });
                    }}
                    className="px-4 py-2 rounded-lg bg-[var(--color-surface)] text-[var(--color-accent-muted)]
                      font-medium text-sm"
                  >
                    取消
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}