import { useState } from 'react';
import { ToastProvider } from './components/Toast';
import { Providers } from './components/Providers';
import { Agents } from './components/Agents';
import { Chat } from './components/Chat';
import { Memory } from './components/Memory';
import './App.css';

type Tab = 'chat' | 'providers' | 'agents' | 'memory';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <ToastProvider>
      <div className="app">
        <header className="header">
          <h1>Ashkit</h1>
          <nav className="nav">
            <a
              className={activeTab === 'chat' ? 'active' : ''}
              onClick={() => setActiveTab('chat')}
            >
              对话
            </a>
            <a
              className={activeTab === 'providers' ? 'active' : ''}
              onClick={() => setActiveTab('providers')}
            >
              Provider
            </a>
            <a
              className={activeTab === 'agents' ? 'active' : ''}
              onClick={() => setActiveTab('agents')}
            >
              Agent
            </a>
            <a
              className={activeTab === 'memory' ? 'active' : ''}
              onClick={() => setActiveTab('memory')}
            >
              记忆
            </a>
          </nav>
        </header>

        <main className="container">
          {activeTab === 'chat' && <Chat />}
          {activeTab === 'providers' && <Providers />}
          {activeTab === 'agents' && <Agents />}
          {activeTab === 'memory' && <Memory />}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;