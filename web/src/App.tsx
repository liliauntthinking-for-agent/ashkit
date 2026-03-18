import { useState } from 'react';
import { Providers } from './components/Providers';
import { Agents } from './components/Agents';
import { Chat } from './components/Chat';
import { Memory } from './components/Memory';
import './App.css';

type Tab = 'providers' | 'agents' | 'chat' | 'memory';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('providers');

  return (
    <div className="app">
      <header className="header">
        <h1>Ashkit 管理后台</h1>
        <nav className="nav">
          <a
            className={activeTab === 'providers' ? 'active' : ''}
            onClick={() => setActiveTab('providers')}
          >
            Provider 管理
          </a>
          <a
            className={activeTab === 'agents' ? 'active' : ''}
            onClick={() => setActiveTab('agents')}
          >
            Agent 管理
          </a>
          <a
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            对话测试
          </a>
          <a
            className={activeTab === 'memory' ? 'active' : ''}
            onClick={() => setActiveTab('memory')}
          >
            记忆查看
          </a>
        </nav>
      </header>

      <main className="container">
        {activeTab === 'providers' && <Providers />}
        {activeTab === 'agents' && <Agents />}
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'memory' && <Memory />}
      </main>
    </div>
  );
}

export default App;