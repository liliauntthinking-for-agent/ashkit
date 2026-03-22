import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface AppState {
  activeTab: string;
  selectedSessionId: string | null;
  setActiveTab: (tab: string) => void;
  setSelectedSessionId: (id: string | null) => void;
  navigateToChat: (sessionId?: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const navigateToChat = (sessionId?: string) => {
    if (sessionId) {
      setSelectedSessionId(sessionId);
    }
    setActiveTab('chat');
  };

  return (
    <AppContext.Provider value={{
      activeTab,
      selectedSessionId,
      setActiveTab,
      setSelectedSessionId,
      navigateToChat,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}