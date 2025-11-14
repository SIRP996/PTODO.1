import React from 'react';
import { useLog, LogType } from '../context/LogContext';
import { X, Trash2, Info, CheckCircle, AlertTriangle, AlertCircle as WarnIcon } from 'lucide-react';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const logConfig: { [key in LogType]: { icon: React.ReactNode; color: string } } = {
  info: { icon: <Info size={14} />, color: 'text-slate-400' },
  success: { icon: <CheckCircle size={14} />, color: 'text-green-400' },
  error: { icon: <AlertTriangle size={14} />, color: 'text-red-400' },
  warn: { icon: <WarnIcon size={14} />, color: 'text-amber-400' },
};

const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const { logs, clearLogs } = useLog();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90]">
      <div className="bg-[#111827]/60 backdrop-blur-xl border border-white/10 w-full max-w-2xl h-[80vh] rounded-2xl shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0">
          <h3 className="text-lg font-bold text-white">Bảng Ghi Chú Đồng Bộ</h3>
          <div className="flex items-center gap-4">
            <button onClick={clearLogs} className="text-slate-400 hover:text-red-400 transition-colors" title="Xóa Log">
              <Trash2 size={18} />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-grow p-4 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
                <p>Chưa có ghi chú nào. Hãy thử thực hiện một hành động đồng bộ.</p>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`flex items-start gap-3 py-1.5 border-b border-slate-800/50 last:border-b-0 ${logConfig[log.type].color}`}>
                <div className="flex-shrink-0 mt-0.5">{logConfig[log.type].icon}</div>
                <div className="flex-grow">
                  <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                  <span className="whitespace-pre-wrap">{log.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LogViewer;