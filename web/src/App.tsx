import type { Icon } from '@phosphor-icons/react';
import { ToastProvider } from './components/Toast';
import { Providers } from './components/Providers';
import { Agents } from './components/Agents';
import { Users } from './components/Users';
import { Skills } from './components/Skills';
import { Chat } from './components/Chat';
import { Groups } from './components/Groups';
import { MemoryPanel } from './components/Memory';
import { Settings } from './components/Settings';
import { ChatCircle, Cube, Brain, PlugsConnected, Gear, User, Lightning, UsersThree } from '@phosphor-icons/react';
import { AppProvider, useApp } from './AppContext';

type Tab = 'chat' | 'groups' | 'providers' | 'agents' | 'users' | 'skills' | 'memory' | 'settings';

const navItems: { id: Tab; label: string; icon: Icon }[] = [
  { id: 'chat', label: '对话', icon: ChatCircle },
  { id: 'groups', label: '群聊', icon: UsersThree },
  { id: 'providers', label: '提供商', icon: PlugsConnected },
  { id: 'agents', label: 'Agent', icon: Cube },
  { id: 'users', label: '用户', icon: User },
  { id: 'skills', label: '技能', icon: Lightning },
  { id: 'memory', label: '记忆', icon: Brain },
  { id: 'settings', label: '设置', icon: Gear },
];

function AppContent() {
  const { activeTab, setActiveTab } = useApp();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--color-surface)]">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
                <Cube className="w-5 h-5 text-white" weight="duotone" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-[var(--color-accent)]">
                Ashkit
              </span>
            </div>
            
            <nav className="flex items-center gap-1 p-1 bg-[var(--color-surface)] rounded-lg">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
                      transition-all duration-200 ease-out
                      ${isActive 
                        ? 'bg-white text-[var(--color-accent)] shadow-sm' 
                        : 'text-[var(--color-accent-muted)] hover:text-[var(--color-accent)] hover:bg-white/50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" weight={isActive ? 'duotone' : 'regular'} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            
            <div className="w-[120px] hidden sm:block" />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'chat' && <Chat />}
          {activeTab === 'groups' && <Groups />}
          {activeTab === 'providers' && <Providers />}
          {activeTab === 'agents' && <Agents />}
          {activeTab === 'users' && <Users />}
          {activeTab === 'skills' && <Skills />}
          {activeTab === 'memory' && <MemoryPanel />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
}

export default App;