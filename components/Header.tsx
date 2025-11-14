
import React from 'react';
import { CalendarDays, Minimize, Maximize } from 'lucide-react';

interface HeaderProps {
    onSwitchToCalendar: () => void;
    onToggleZenMode: () => void;
    isZenMode: boolean;
}

const PtodoLogo: React.FC = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white">
        <path d="M20 7L10 17L5 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M18 2L17.25 4.75L14.5 5.5L17.25 6.25L18 9L18.75 6.25L21.5 5.5L18.75 4.75L18 2Z" fill="white"/>
    </svg>
);


const Header: React.FC<HeaderProps> = ({ onSwitchToCalendar, onToggleZenMode, isZenMode }) => {
    return (
        <header className="flex justify-between items-center">
            <div className="flex items-center">
                <div className="bg-primary-600 p-3 rounded-xl mr-4">
                    <PtodoLogo />
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