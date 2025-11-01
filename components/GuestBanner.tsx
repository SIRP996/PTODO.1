import React from 'react';
import { UserPlus, Info } from 'lucide-react';

interface GuestBannerProps {
  onSignUp: () => void;
}

const GuestBanner: React.FC<GuestBannerProps> = ({ onSignUp }) => {
  return (
    <div className="bg-primary-900/40 border border-primary-700/50 text-primary-200 px-4 py-3 rounded-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Info className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm">
          Bạn đang ở chế độ <span className="font-bold">khách</span>. Công việc của bạn được lưu tạm thời trên trình duyệt này và bị giới hạn 5 công việc.
        </p>
      </div>
      <button
        onClick={onSignUp}
        className="flex-shrink-0 w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 text-sm"
      >
        <UserPlus size={16} />
        <span>Đăng ký để lưu trữ không giới hạn</span>
      </button>
    </div>
  );
};

export default GuestBanner;
