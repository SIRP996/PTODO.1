
import React from 'react';
import { CheckSquare, CalendarDays, Minimize, Maximize } from 'lucide-react';

interface HeaderProps {
    onSwitchToCalendar: () => void;
    onToggleZenMode: () => void;
    isZenMode: boolean;
}

const Header: React.FC<HeaderProps> = ({ onSwitchToCalendar, onToggleZenMode, isZenMode }) => {
    return (
        <header className="flex justify-between items-center">
            <div className="flex items-center">
                <div className="bg-primary-600 p-3 rounded-xl mr-4">
                    <CheckSquare className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">PTODO</h1>
                    <p className="text-slate-400">Trình quản lý công việc cá nhân của bạn</p>
                </div>
            </div>
             <div className="flex items-center justify-end gap-2">
                <button
                    onClick={onSwitchToCalendar}
                    className="flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200"
                    title="Chuyển sang giao diện Lịch"
                >
                    <CalendarDays className="h-4 w-4" />
                    <span className="hidden sm:inline">Xem Lịch</span>
                </button>
                <button
                    onClick={onToggleZenMode}
                    className={`flex items-center justify-center gap-2 font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 ${
                        isZenMode 
                        ? 'bg-primary-600 hover:bg-primary-700 text-white' 
                        : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                    }`}
                    title={isZenMode ? "Thoát chế độ tập trung" : "Bật chế độ tập trung (Zen Mode)"}
                >
                    {isZenMode ? <Maximize className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
                    <span className="hidden sm:inline">{isZenMode ? "Hiển thị Sidebar" : "Zen Mode"}</span>
                </button>
            </div>
        </header>
    );
};

export default Header;
