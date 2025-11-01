import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// --- TYPE DEFINITIONS ---
export type LogType = 'info' | 'success' | 'error' | 'warn';

export interface Log {
  id: string;
  message: string;
  type: LogType;
  timestamp: string;
}

interface LogContextType {
  logs: Log[];
  addLog: (message: string, type: LogType) => void;
  clearLogs: () => void;
}

// --- CONTEXT & HOOK ---
const LogContext = createContext<LogContextType | undefined>(undefined);

export const useLog = (): LogContextType => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLog must be used within a LogProvider');
  }
  return context;
};

// --- PROVIDER ---
export const LogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<Log[]>([]);

  const addLog = useCallback((message: string, type: LogType) => {
    const newLog: Log = {
      id: uuidv4(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    };
    setLogs(prevLogs => [newLog, ...prevLogs]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const value: LogContextType = {
    logs,
    addLog,
    clearLogs,
  };

  return (
    <LogContext.Provider value={value}>
      {children}
    </LogContext.Provider>
  );
};
