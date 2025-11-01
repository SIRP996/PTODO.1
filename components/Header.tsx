


import React, { useState, useRef, useEffect } from 'react';
import { Download, CheckSquare, LogOut, KeyRound, UserCircle, Palette, UserPlus, BookOpen } from 'lucide-react';
import { Task, Theme } from '../types';
import { User } from 'firebase/auth';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
    tasks: Task[];
    user: User | null;
    onLogout: () => void;
    hasApiKey: boolean;
    onManageApiKey: () => void;
    onOpenSettings: () => void;
    onToggleLogViewer: () => void;
}

const themes: { id: Theme; name: string; color: string; }[] = [
    { id: 'default', name: 'Mặc định', color: 'bg-indigo-500' },
    { id: 'azure', name: 'Thiên thanh', color: 'bg-sky-500' },
    { id: 'teal', name: 'Xanh ngọc', color: 'bg-teal-500' },
    { id: 'sunset', name: 'Hoàng hôn', color: 'bg-amber-500' },
    { id: 'ocean', name: 'Đại dương', color: 'bg-cyan-500' },
];

const Header: React.FC<HeaderProps> = ({ tasks, user, onLogout, hasApiKey, onManageApiKey, onOpenSettings, onToggleLogViewer }) => {
    const { addToast } = useToast();
    const { userSettings, updateUserSettings, isGuestMode, exitGuestMode } = useAuth();
    const [isThemePopoverOpen, setIsThemePopoverOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const themePopoverRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (themePopoverRef.current && !themePopoverRef.current.contains(event.target as Node)) {
                setIsThemePopoverOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const exportToCSV = () => {
        if (tasks.length === 0) {
            addToast("Không có công việc nào để xuất.", "info");
            return;
        }

        const headers = "ID,Text,Status,CreatedAt,DueDate,Hashtags,IsUrgent,Note\n";
        const rows = tasks.map(task => 
            [
                task.id,
                `"${task.text.replace(/"/g, '""')}"`,
                task.status,
                task.createdAt,
                task.dueDate || '',
                `"${task.hashtags.join(',')}"`,
                task.isUrgent,
                `"${(task.note || '').replace(/"/g, '""')}"`
            ].join(',')
        ).join('\n');

        const csvContent = "\uFEFF" + headers + rows; // Add BOM for Excel compatibility
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `tasks_export_${new Date().toISOString().slice(0,10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast("Đã xuất công việc ra tệp CSV.", "success");
        }
    };

    const handleThemeChange = async (theme: Theme) => {
        if (!updateUserSettings) return;
        try {
          await updateUserSettings({ theme });
          addToast('Đã đổi chủ đề!', 'success');
          setIsThemePopoverOpen(false);
        } catch (err) {
            addToast('Không thể đổi chủ đề.', 'error');
        }
    }
    
    const userAvatarUrl = userSettings?.avatarUrl || user?.photoURL;

    const handleAuthAction = () => {
        if (isGuestMode) {
            exitGuestMode();
        } else {
            onLogout();
        }
        setIsUserMenuOpen(false);
    }
    
    return (
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="flex items-center mb-4 sm:mb-0">
                <div className="bg-primary-600 p-3 rounded-xl mr-4">
                    <CheckSquare className="h-8 w-8 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">PTODO</h1>
                    <p className="text-slate-400">Trình quản lý công việc cá nhân của bạn</p>
                </div>
            </div>
             <div className="w-full sm:w-auto flex items-center justify-end gap-2">
                <button
                    onClick={onToggleLogViewer}
                    className="flex items-center justify-center font-semibold p-2.5 rounded-lg transition-colors duration-200 bg-slate-700 hover:bg-slate-600 text-slate-300"
                    title="Nhật ký Đồng bộ"
                >
                    <BookOpen className="h-4 w-4" />
                </button>
                <div className="relative">
                    <button
                        onClick={() => setIsThemePopoverOpen(prev => !prev)}
                        className="flex items-center justify-center font-semibold p-2.5 rounded-lg transition-colors duration-200 bg-slate-700 hover:bg-slate-600 text-slate-300"
                        title="Đổi chủ đề"
                    >
                        <Palette className="h-4 w-4" />
                    </button>
                    {isThemePopoverOpen && (
                        <div
                            ref={themePopoverRef}
                            className="absolute top-full right-0 mt-2 w-48 bg-[#1E293B] border border-slate-700 rounded-lg shadow-xl z-50 p-2"
                        >
                            <p className="text-xs font-semibold text-slate-400 px-2 pb-2">Chọn chủ đề</p>
                            <div className="space-y-1">
                                {themes.map(theme => (
                                    <button
                                        key={theme.id}
                                        onClick={() => handleThemeChange(theme.id)}
                                        className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                                            (userSettings?.theme === theme.id || (!userSettings?.theme && theme.id === 'default'))
                                            ? 'bg-primary-600 text-white'
                                            : 'text-slate-300 hover:bg-slate-700'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded-full ${theme.color}`}></div>
                                        <span>{theme.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={exportToCSV}
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200"
                    title="Xuất tất cả công việc ra tệp CSV, tương thích với Google Sheets."
                >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Xuất CSV</span>
                </button>

                {/* User Dropdown Menu */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        onClick={() => setIsUserMenuOpen(prev => !prev)}
                        className="flex items-center gap-2 p-1.5 rounded-lg transition-colors duration-200 bg-slate-700 hover:bg-slate-600 text-slate-300"
                        title="Tài khoản"
                    >
                        <span className="font-semibold hidden sm:inline px-1">{user?.displayName || (isGuestMode ? 'Khách' : 'Tài khoản')}</span>
                        <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center overflow-hidden">
                            {userAvatarUrl ? (
                                <img src={userAvatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <UserCircle className="h-5 w-5 text-slate-400" />
                            )}
                        </div>
                    </button>
                    {isUserMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-[#1E293B] border border-slate-700 rounded-lg shadow-xl z-50">
                            <div className="px-4 py-3 border-b border-slate-700">
                                <p className="text-sm font-semibold text-white truncate">{user?.displayName || (isGuestMode ? 'Chế độ khách' : 'Chào bạn')}</p>
                                <p className="text-xs text-slate-400 truncate">{user?.email || 'Dữ liệu được lưu trên trình duyệt'}</p>
                            </div>
                           
                            {isGuestMode ? (
                                <div className="p-2">
                                    <button
                                        onClick={() => { exitGuestMode(); setIsUserMenuOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-white bg-primary-600 hover:bg-primary-700"
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        <span>Đăng ký để lưu dữ liệu</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="p-2">
                                    <button
                                        onClick={() => { onOpenSettings(); setIsUserMenuOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-slate-700"
                                    >
                                        <UserCircle className="h-4 w-4 text-slate-400" />
                                        <span>Cài đặt tài khoản</span>
                                    </button>
                                    <button
                                        onClick={() => { onManageApiKey(); setIsUserMenuOpen(false); }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-slate-700"
                                    >
                                        <KeyRound className="h-4 w-4 text-slate-400" />
                                        <span>Quản lý API Key</span>
                                        {hasApiKey ? (
                                            <span className="ml-auto h-2 w-2 rounded-full bg-green-500" title="API Key đang hoạt động"></span>
                                        ) : (
                                            <span className="ml-auto h-2 w-2 rounded-full bg-red-500" title="Chưa có API Key"></span>
                                        )}
                                    </button>
                                </div>
                            )}

                            <div className="p-2 border-t border-slate-700">
                                <button
                                    onClick={handleAuthAction}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-red-400 hover:bg-red-900/50 hover:text-red-300"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>{isGuestMode ? 'Thoát chế độ khách' : 'Đăng xuất'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;