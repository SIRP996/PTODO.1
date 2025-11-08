import React from 'react';
import { Task } from '../types';
import GoogleSheetSync from './GoogleSheetSync';
import { ClipboardList, Sparkles } from 'lucide-react';

interface UtilitiesSectionProps {
  tasks: Task[];
  onOpenTemplateManager: () => void;
  onOpenWeeklyReview: () => void;
}

const UtilitiesSection: React.FC<UtilitiesSectionProps> = ({ tasks, onOpenTemplateManager, onOpenWeeklyReview }) => {
  return (
    <div className="space-y-6">
      <GoogleSheetSync tasks={tasks} />
      
      <div>
        <h2 className="text-xl font-semibold mb-4 text-slate-100 flex items-center gap-2">
            <ClipboardList className="text-primary-400" />
            Mẫu Công việc
        </h2>
        <p className="text-sm text-slate-400 mb-3">Tăng tốc quy trình làm việc bằng cách sử dụng các mẫu được định sẵn.</p>
        <button
            onClick={onOpenTemplateManager}
            className="w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all duration-300 bg-slate-700/50 hover:bg-slate-700/80 border border-slate-600/50 text-slate-200"
        >
            Quản lý Mẫu
        </button>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 text-slate-100 flex items-center gap-2">
            <Sparkles className="text-primary-400" />
            Trợ lý AI
        </h2>
        <p className="text-sm text-slate-400 mb-3">Để AI phân tích hiệu suất tuần qua và đề xuất kế hoạch cho tuần tới.</p>
        <button
            onClick={onOpenWeeklyReview}
            className="w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all duration-300 bg-slate-700/50 hover:bg-slate-700/80 border border-slate-600/50 text-slate-200"
        >
            Tổng kết Tuần với AI
        </button>
      </div>

    </div>
  );
};

export default UtilitiesSection;