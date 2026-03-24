import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, IdentificationBadge, PencilSimple, Check, Camera, User as UserIcon } from '@phosphor-icons/react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { zhCN } from 'date-fns/locale/zh-CN';
import 'react-datepicker/dist/react-datepicker.css';
import { useToast } from './Toast';
import * as api from '../api/client';

registerLocale('zh-CN', zhCN);

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }
  return null;
};

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
  occupation: '',
  nationality: '',
  personality: '',
  hobbies: '',
  skills: '',
  mbti: '',
  background: '',
  life_goal: '',
  yearly_goal: '',
  monthly_goal: '',
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

type User = api.User;

export function Users() {
  const showToast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    user_id: '',
    profile: { ...defaultProfile },
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editProfile, setEditProfile] = useState<typeof defaultProfile | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const usersData = await api.getUsers();
      setUsers(usersData);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!formData.user_id.trim()) {
      showToast('请输入用户 ID', 'error');
      return;
    }
    try {
      const profileData = {
        ...formData.profile,
        height: formData.profile.height ? parseInt(formData.profile.height) : null,
        weight: formData.profile.weight ? parseInt(formData.profile.weight) : null,
      };
      await api.createUser({
        user_id: formData.user_id.trim(),
        profile: profileData,
      });
      
      if (avatarFile) {
        try {
          await api.uploadAvatar('user', formData.user_id.trim(), avatarFile);
        } catch {
          showToast('用户已创建，但头像上传失败', 'error');
        }
      }
      
      setFormData({ user_id: '', profile: { ...defaultProfile } });
      setAvatarFile(null);
      setAvatarPreview('');
      setShowForm(false);
      loadData();
      showToast('创建成功');
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    }
  };

  const handleView = async (user: User) => {
    try {
      const detail = await api.getUser(user.user_id);
      setSelectedUser(detail);
      setShowDetail(true);
      setIsEditing(false);
      setEditProfile(null);
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    }
  };

  const handleEdit = () => {
    if (selectedUser?.profile) {
      setEditProfile({
        ...defaultProfile,
        ...selectedUser.profile,
        height: selectedUser.profile.height?.toString() || '',
        weight: selectedUser.profile.weight?.toString() || '',
      });
      setIsEditing(true);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser || !editProfile) return;
    try {
      const profileData = {
        ...editProfile,
        height: editProfile.height ? parseInt(editProfile.height) : null,
        weight: editProfile.weight ? parseInt(editProfile.weight) : null,
      };
      await api.updateUser(selectedUser.user_id, profileData);
      const detail = await api.getUser(selectedUser.user_id);
      setSelectedUser(detail);
      setIsEditing(false);
      setEditProfile(null);
      loadData();
      showToast('更新成功');
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, 'error');
    }
  };

  const updateEditProfile = (key: string, value: string) => {
    if (!editProfile) return;
    setEditProfile({ ...editProfile, [key]: value });
  };

  const updateProfile = (key: string, value: string) => {
    setFormData({
      ...formData,
      profile: { ...formData.profile, [key]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-accent)]">
            用户档案
          </h1>
          <p className="text-sm text-[var(--color-accent-muted)] mt-1">
            创建和管理用户档案信息
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-accent)] text-white 
            rounded-xl font-medium text-sm shadow-lg shadow-[var(--color-accent)]/10"
        >
          <UserPlus className="w-4 h-4" weight="bold" />
          创建用户
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
          <h3 className="text-base font-semibold text-[var(--color-accent)]">创建新用户</h3>
          
          {/* User ID */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]">
              <IdentificationBadge className="w-4 h-4" />
              基本信息
            </div>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  头像
                </label>
                <label className="relative w-20 h-20 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center cursor-pointer hover:border-[var(--color-accent)] transition-colors overflow-hidden group">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="头像预览" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-[var(--color-accent-muted)]" weight="duotone" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" weight="fill" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAvatarFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setAvatarPreview(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex-1 max-w-xs">
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  用户 ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="输入唯一标识符"
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Profile Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]">
              <UserIcon className="w-4 h-4" />
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
                <DatePicker
                  selected={parseDate(formData.profile.birthday)}
                  onChange={(date: Date | null) => updateProfile('birthday', formatDate(date))}
                  locale="zh-CN"
                  dateFormat="yyyy-MM-dd"
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                  placeholderText="选择生日"
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
              
              {/* 职业 */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                  职业
                </label>
                <input
                  type="text"
                  placeholder="当前职业"
                  value={formData.profile.occupation}
                  onChange={(e) => updateProfile('occupation', e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                    rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                    focus:border-[var(--color-accent)] transition-all"
                />
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
            
            {/* MBTI */}
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
            
            {/* Background */}
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

            {/* Goals */}
            <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
              <h4 className="text-sm font-semibold text-[var(--color-accent)]">目标设定</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                    人生目标
                  </label>
                  <textarea
                    placeholder="长远的人生追求..."
                    value={formData.profile.life_goal}
                    onChange={(e) => updateProfile('life_goal', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                      focus:border-[var(--color-accent)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                    年度目标
                  </label>
                  <textarea
                    placeholder="今年想完成的事..."
                    value={formData.profile.yearly_goal}
                    onChange={(e) => updateProfile('yearly_goal', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                      focus:border-[var(--color-accent)] transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">
                    月度目标
                  </label>
                  <textarea
                    placeholder="这个月要完成的事..."
                    value={formData.profile.monthly_goal}
                    onChange={(e) => updateProfile('monthly_goal', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20
                      focus:border-[var(--color-accent)] transition-all resize-none"
                  />
                </div>
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

      {/* User List */}
      {users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] 
              flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-[var(--color-accent-muted)]" weight="duotone" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-accent)] mb-1">暂无用户</h3>
            <p className="text-sm text-[var(--color-accent-muted)]">
              创建你的第一个用户档案
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u, index) => (
            <motion.div
              key={u.user_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleView(u)}
              className="group bg-white rounded-2xl border border-[var(--color-border)] p-5
                hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-surface)] 
                  flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-[var(--color-accent)]" weight="duotone" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-[var(--color-accent)]">
                    {u.profile?.name || u.user_id}
                  </h3>
                  {u.profile?.name && (
                    <p className="text-xs text-[var(--color-accent-muted)]">{u.user_id}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {u.profile?.occupation && (
                      <span className="text-xs text-[var(--color-accent-muted)]">{u.profile.occupation}</span>
                    )}
                    {u.profile?.school && (
                      <span className="text-xs text-[var(--color-accent-muted)]">· {u.profile.school}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* User Detail Modal */}
      {showDetail && selectedUser && (
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
                    {selectedUser.profile?.avatar ? (
                      <img 
                        src={selectedUser.profile.avatar} 
                        alt={selectedUser.profile?.name || selectedUser.user_id}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-6 h-6 text-[var(--color-accent)]" weight="duotone" />
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
                          if (file && selectedUser) {
                            try {
                              const result = await api.uploadAvatar('user', selectedUser.user_id, file);
                              const updated = await api.getUser(selectedUser.user_id);
                              setSelectedUser(updated);
                              if (editProfile) {
                                setEditProfile({ ...editProfile, avatar: result.avatar });
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
                    {isEditing ? '编辑用户' : (selectedUser.profile?.name || selectedUser.user_id)}
                  </h2>
                  <p className="text-sm text-[var(--color-accent-muted)]">{selectedUser.user_id}</p>
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
                    setEditProfile(null);
                  }}
                  className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {!isEditing ? (
              <div className="space-y-6">
                {selectedUser.profile && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-accent)] mb-3">人物档案</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedUser.profile.name && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">姓名</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.name}</p>
                        </div>
                      )}
                      {selectedUser.profile.nickname && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">昵称</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.nickname}</p>
                        </div>
                      )}
                      {selectedUser.profile.gender && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">性别</label>
                          <p className="text-sm text-[var(--color-accent)]">
                            {genderOptions.find(g => g.value === selectedUser.profile?.gender)?.label || selectedUser.profile.gender}
                          </p>
                        </div>
                      )}
                      {selectedUser.profile.birthday && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">生日</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.birthday}</p>
                        </div>
                      )}
                      {selectedUser.profile.height && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">身高</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.height} cm</p>
                        </div>
                      )}
                      {selectedUser.profile.weight && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">体重</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.weight} kg</p>
                        </div>
                      )}
                      {selectedUser.profile.blood_type && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">血型</label>
                          <p className="text-sm text-[var(--color-accent)]">
                            {bloodTypeOptions.find(b => b.value === selectedUser.profile?.blood_type)?.label || selectedUser.profile.blood_type}
                          </p>
                        </div>
                      )}
                      {selectedUser.profile.email && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">邮箱</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.email}</p>
                        </div>
                      )}
                      {selectedUser.profile.address && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">住址</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.address}</p>
                        </div>
                      )}
                      {selectedUser.profile.school && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">学校</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.school}</p>
                        </div>
                      )}
                      {selectedUser.profile.education && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">学历</label>
                          <p className="text-sm text-[var(--color-accent)]">
                            {educationOptions.find(e => e.value === selectedUser.profile?.education)?.label || selectedUser.profile.education}
                          </p>
                        </div>
                      )}
                      {selectedUser.profile.occupation && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">职业</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.occupation}</p>
                        </div>
                      )}
                      {selectedUser.profile.nationality && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">国籍</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.nationality}</p>
                        </div>
                      )}
                      {selectedUser.profile.personality && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">性格</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.personality}</p>
                        </div>
                      )}
                      {selectedUser.profile.hobbies && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">爱好</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.hobbies}</p>
                        </div>
                      )}
                      {selectedUser.profile.skills && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">技能</label>
                          <p className="text-sm text-[var(--color-accent)]">{selectedUser.profile.skills}</p>
                        </div>
                      )}
                      {selectedUser.profile.mbti && (
                        <div>
                          <label className="text-xs text-[var(--color-accent-muted)]">MBTI</label>
                          <p className="text-sm text-[var(--color-accent)]">
                            {mbtiOptions.find(m => m.value === selectedUser.profile?.mbti)?.desc || selectedUser.profile.mbti}
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedUser.profile.background && (
                      <div className="mt-4">
                        <label className="text-xs text-[var(--color-accent-muted)]">背景故事</label>
                        <p className="text-sm text-[var(--color-accent)] mt-1">{selectedUser.profile.background}</p>
                      </div>
                    )}
                    {/* Goals */}
                    {(selectedUser.profile.life_goal || selectedUser.profile.yearly_goal || selectedUser.profile.monthly_goal) && (
                      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                        <h4 className="text-sm font-semibold text-[var(--color-accent)] mb-3">目标设定</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {selectedUser.profile.life_goal && (
                            <div>
                              <label className="text-xs text-[var(--color-accent-muted)]">人生目标</label>
                              <p className="text-sm text-[var(--color-accent)] mt-1">{selectedUser.profile.life_goal}</p>
                            </div>
                          )}
                          {selectedUser.profile.yearly_goal && (
                            <div>
                              <label className="text-xs text-[var(--color-accent-muted)]">年度目标</label>
                              <p className="text-sm text-[var(--color-accent)] mt-1">{selectedUser.profile.yearly_goal}</p>
                            </div>
                          )}
                          {selectedUser.profile.monthly_goal && (
                            <div>
                              <label className="text-xs text-[var(--color-accent-muted)]">月度目标</label>
                              <p className="text-sm text-[var(--color-accent)] mt-1">{selectedUser.profile.monthly_goal}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">姓名</label>
                    <input
                      type="text"
                      value={editProfile?.name || ''}
                      onChange={(e) => updateEditProfile('name', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">昵称</label>
                    <input
                      type="text"
                      value={editProfile?.nickname || ''}
                      onChange={(e) => updateEditProfile('nickname', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">性别</label>
                    <select
                      value={editProfile?.gender || ''}
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
                    <DatePicker
                      selected={parseDate(editProfile?.birthday || '')}
                      onChange={(date: Date | null) => updateEditProfile('birthday', formatDate(date))}
                      locale="zh-CN"
                      dateFormat="yyyy-MM-dd"
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                      placeholderText="选择生日"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">身高 (cm)</label>
                    <input
                      type="number"
                      value={editProfile?.height || ''}
                      onChange={(e) => updateEditProfile('height', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">体重 (kg)</label>
                    <input
                      type="number"
                      value={editProfile?.weight || ''}
                      onChange={(e) => updateEditProfile('weight', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">血型</label>
                    <select
                      value={editProfile?.blood_type || ''}
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
                      value={editProfile?.email || ''}
                      onChange={(e) => updateEditProfile('email', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">住址</label>
                    <input
                      type="text"
                      value={editProfile?.address || ''}
                      onChange={(e) => updateEditProfile('address', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">学校</label>
                    <input
                      type="text"
                      value={editProfile?.school || ''}
                      onChange={(e) => updateEditProfile('school', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">学历</label>
                    <select
                      value={editProfile?.education || ''}
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
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">职业</label>
                    <input
                      type="text"
                      value={editProfile?.occupation || ''}
                      onChange={(e) => updateEditProfile('occupation', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">国籍</label>
                    <input
                      type="text"
                      value={editProfile?.nationality || ''}
                      onChange={(e) => updateEditProfile('nationality', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">性格</label>
                    <input
                      type="text"
                      value={editProfile?.personality || ''}
                      onChange={(e) => updateEditProfile('personality', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">爱好</label>
                    <input
                      type="text"
                      value={editProfile?.hobbies || ''}
                      onChange={(e) => updateEditProfile('hobbies', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">技能</label>
                    <input
                      type="text"
                      value={editProfile?.skills || ''}
                      onChange={(e) => updateEditProfile('skills', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                        rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">MBTI</label>
                    <select
                      value={editProfile?.mbti || ''}
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
                    value={editProfile?.background || ''}
                    onChange={(e) => updateEditProfile('background', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                      rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 resize-none"
                  />
                </div>

                {/* Goals */}
                <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                  <h4 className="text-sm font-semibold text-[var(--color-accent)]">目标设定</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">人生目标</label>
                      <textarea
                        value={editProfile?.life_goal || ''}
                        onChange={(e) => updateEditProfile('life_goal', e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                          rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">年度目标</label>
                      <textarea
                        value={editProfile?.yearly_goal || ''}
                        onChange={(e) => updateEditProfile('yearly_goal', e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                          rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-accent)] mb-2">月度目标</label>
                      <textarea
                        value={editProfile?.monthly_goal || ''}
                        onChange={(e) => updateEditProfile('monthly_goal', e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)]
                          rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 resize-none"
                      />
                    </div>
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
                      setEditProfile(null);
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