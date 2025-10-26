
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

// --- TYPE DEFINITIONS ---
type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}

// --- CONTEXT & HOOK ---
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// --- TOAST COMPONENT (Internal) ---
interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const icons = {
  success: <CheckCircle className="h-6 w-6 text-green-400" />,
  error: <AlertTriangle className="h-6 w-6 text-red-400" />,
  info: <Info className="h-6 w-6 text-blue-400" />,
};

const bgColors = {
  success: 'bg-green-900/80 border-green-700',
  error: 'bg-red-900/80 border-red-700',
  info: 'bg-blue-900/80 border-blue-700',
};

const textColors = {
    success: 'text-green-200',
    error: 'text-red-200',
    info: 'text-blue-200',
};

const ToastComponent: React.FC<ToastProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [toast.id, onRemove]);

  return (
    <div
      className={`max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden border backdrop-blur-md ${bgColors[toast.type]}`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">{icons[toast.type]}</div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className={`text-sm font-medium ${textColors[toast.type]}`}>{toast.message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onRemove(toast.id)}
              className="inline-flex rounded-md text-slate-400 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- TOAST CONTAINER (Internal) ---
interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[100]"
    >
      <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
        {toasts.map(toast => (
          <ToastComponent key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </div>
  );
};


// --- PROVIDER ---
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = uuidv4();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};
