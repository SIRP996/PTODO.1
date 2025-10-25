import React from 'react';
import { Task } from '../types';
import { Play, Pause, X, CheckCircle } from 'lucide-react';

interface FocusModeOverlayProps {
  task: Task;
  timeLeft: number;
  isTimerRunning: boolean;
  onToggleTimer: () => void;
  onStop: () => void;
  onComplete: () => void;
}

const FocusModeOverlay: React.FC<FocusModeOverlayProps> = ({ 
  task, 
  timeLeft, 
  isTimerRunning,
  onToggleTimer,
  onStop,
  onComplete
}) => {
  const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const seconds = String(timeLeft % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 bg-[#0F172A]/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4">
      <div className="text-center">
        <p className="text-slate-400 text-lg">Đang tập trung vào:</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white max-w-2xl my-4">{task.text}</h1>
      </div>
      
      <div className="my-10 font-mono text-8xl sm:text-9xl text-white tracking-widest">
        <span>{minutes}</span>
        <span className="animate-pulse">:</span>
        <span>{seconds}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onStop}
          className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          title="Dừng chế độ tập trung"
        >
          <X size={24} />
          <span>Dừng</span>
        </button>

        <button
          onClick={onToggleTimer}
          className="w-20 h-20 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full transition-all duration-200 shadow-lg"
          title={isTimerRunning ? 'Tạm dừng' : 'Tiếp tục'}
          disabled={timeLeft === 0}
        >
          {isTimerRunning ? <Pause size={32} /> : <Play size={32} />}
        </button>
        
        <button
          onClick={onComplete}
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          title="Đánh dấu hoàn thành & Dừng"
        >
          <CheckCircle size={24} />
          <span>Hoàn tất</span>
        </button>
      </div>

      {timeLeft === 0 && (
          <div className="mt-8 text-center bg-emerald-900/50 border border-emerald-700 p-4 rounded-xl">
              <p className="text-lg font-semibold text-emerald-300">Làm tốt lắm! Đã đến lúc nghỉ ngơi.</p>
          </div>
      )}
    </div>
  );
};

export default FocusModeOverlay;
