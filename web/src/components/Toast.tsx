import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Warning, WarningCircle } from '@phosphor-icons/react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`
                flex items-center gap-2.5 px-4 py-2.5 rounded-full
                text-sm font-medium shadow-lg
                ${toast.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                  : toast.type === 'warning'
                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                  : 'bg-red-50 text-red-700 border border-red-100'
                }
              `}
            >
              {toast.type === 'success' ? (
                <CheckCircle className="w-4 h-4" weight="duotone" />
              ) : toast.type === 'warning' ? (
                <Warning className="w-4 h-4" weight="duotone" />
              ) : (
                <WarningCircle className="w-4 h-4" weight="duotone" />
              )}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context.showToast;
}