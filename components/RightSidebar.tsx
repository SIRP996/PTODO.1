import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { Task, Project, Filter, SectionKey } from '../types';
import { useAuth } from '../context/AuthContext';
import { Download, LogOut, KeyRound, UserCircle, UserPlus, BookOpen, Calendar, Sun, AlertTriangle, Layers3, ChevronDown, BellRing, ShieldOff } from 'lucide-react';
import SearchBar from './SearchBar';
import Dashboard from './Dashboard';
import AdvancedDashboard from './AdvancedDashboard';
import UtilitiesSection from './UtilitiesSection';

interface RightSidebarProps {
    user: User | null;
    tasks: Task[];
    projects: Project[];
    searchTerm: string;
    onSearchChange: (term: string) => void;
    activeFilter: Filter;
    onFilterChange: (filter: Filter) => void;
    onLogout: () => void;
    onManageApiKey: () => void;
    onOpenSettings: () => void;
    onToggleLogViewer: () => void;
    onOpenTemplateManager: () => void;
    hasApiKey: boolean;
    notificationPermissionStatus: string;
    onRequestNotificationPermission: () => void;
}

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    return (
        <details open={defaultOpen} className="bg-slate-800/50 rounded-2xl group">
            <summary className="p-4 font-semibold text-slate-100 cursor-pointer list-none flex justify-between items-center">
                {title}
                <ChevronDown className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-0">
                {children}
            </div>
        </details>
    )
}

const RightSidebar: React.FC<RightSidebarProps> = ({ 
    user, tasks, projects, searchTerm, onSearchChange, activeFilter, onFilterChange, 
    onLogout, onManageApiKey, onOpenSettings, onToggleLogViewer, onOpenTemplateManager, hasApiKey,
    notificationPermissionStatus, onRequestNotificationPermission
}) => {
    const { userSettings, isGuestMode, exitGuestMode, updateUserSettings } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const componentMap: Record<SectionKey, { title: string; component: React.ReactNode }> = {
        dashboard: { title: "Bảng điều khiển", component: <Dashboard tasks={tasks} /> },
        advancedDashboard: { title: "Phân tích chi tiết", component: <AdvancedDashboard tasks={tasks} /> },
        utilities: { title: "Tiện ích", component: <UtilitiesSection tasks={tasks} onOpenTemplateManager={onOpenTemplateManager} /> },
    };

    const defaultLayout: SectionKey[] = ['dashboard', 'advancedDashboard', 'utilities'];
    const [layout, setLayout] = useState<SectionKey[]>(defaultLayout);
    const draggedItem = useRef<SectionKey | null>(null);

    useEffect(() => {
        if (userSettings?.sidebarLayout) {
            const validLayout = userSettings.sidebarLayout.filter(key => defaultLayout.includes(key));
            if (validLayout.length === defaultLayout.length) {
                setLayout(validLayout);
            }
        }
    }, [userSettings]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, key: SectionKey) => {
        draggedItem.current = key;
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, targetKey: SectionKey) => {
        e.preventDefault();
        if (draggedItem.current !== targetKey) {
            const newLayout = [...layout];
            const draggedIndex = newLayout.findIndex(item => item === draggedItem.current);
            const targetIndex = newLayout.findIndex(item => item === targetKey);
            const [removed] = newLayout.splice(draggedIndex, 1);
            newLayout.splice(targetIndex, 0, removed);
            setLayout(newLayout);
        }
    };
    
    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
        if (updateUserSettings && JSON.stringify(layout) !== JSON.stringify(userSettings?.sidebarLayout || defaultLayout)) {
            updateUserSettings({ sidebarLayout: layout });
        }
        draggedItem.current = null;
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setIsUserMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const userAvatarUrl = userSettings?.avatarUrl || user?.photoURL;
    const handleAuthAction = () => {
        if (isGuestMode) { exitGuestMode(); } else { onLogout(); }
        setIsUserMenuOpen(false);
    }

    const quickFilters: { label: string; type: 'all' | 'today' | 'next7days' | 'urgent'; icon: React.ReactNode }[] = [
        { label: 'Tất cả công việc', type: 'all', icon: <Layers3 size={18} /> },
        { label: 'Hôm nay', type: 'today', icon: <Sun size={18} /> },
        { label: '7 ngày tới', type: 'next7days', icon: <Calendar size={18} /> },
        { label: 'Khẩn cấp', type: 'urgent', icon: <AlertTriangle size={18} /> },
    ];

    const taskCountsByProject = useMemo(() => {
        const counts: { [projectId: string]: number } = {};
        projects.forEach(p => counts[p.id] = 0);
        tasks.forEach(task => {
            if (task.projectId && counts.hasOwnProperty(task.projectId)) {
                counts[task.projectId]++;
            }
        });
        return counts;
    }, [tasks, projects]);
    
    return (
        <aside className="space-y-6 h-full overflow-y-auto pr-2">
            <div className="bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                        {userAvatarUrl ? ( <img src={userAvatarUrl} alt="User Avatar" className="w-full h-full object-cover" /> ) : ( <UserCircle className="h-6 w-6 text-slate-400" /> )}
                    </div>
                    <div>
                        <p className="font-semibold text-white">{user?.displayName || (isGuestMode ? 'Khách' : 'Tài khoản')}</p>
                        <p className="text-xs text-slate-400">{user?.email || 'Chế độ khách'}</p>
                    </div>
                </div>
                <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setIsUserMenuOpen(p => !p)} className="p-2 rounded-full hover:bg-slate-700 transition-colors"><ChevronDown size={20} /></button>
                    {isUserMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-[#1E293B] border border-slate-700 rounded-lg shadow-xl z-50">
                             {isGuestMode ? (
                                <div className="p-2"><button onClick={() => { exitGuestMode(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-white bg-primary-600 hover:bg-primary-700"><UserPlus className="h-4 w-4" /><span>Đăng ký để lưu dữ liệu</span></button></div>
                            ) : (
                                <div className="p-2">
                                    <button onClick={() => { onOpenSettings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-slate-700"><UserCircle className="h-4 w-4" /><span>Cài đặt tài khoản</span></button>
                                    <button onClick={() => { onManageApiKey(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-slate-700"><KeyRound className="h-4 w-4" /><span>Quản lý API Key</span></button>
                                    <button onClick={() => { onToggleLogViewer(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-slate-700"><BookOpen className="h-4 w-4" /><span>Xem Log đồng bộ</span></button>
                                </div>
                            )}
                            <div className="p-2 border-t border-slate-700">
                                <button onClick={handleAuthAction} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-red-400 hover:bg-red-900/50 hover:text-red-300"><LogOut className="h-4 w-4" /><span>{isGuestMode ? 'Thoát' : 'Đăng xuất'}</span></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <SearchBar searchTerm={searchTerm} onSearchChange={onSearchChange} />

            <div className="space-y-1">
                {quickFilters.map(filter => (
                     <button key={filter.type} onClick={() => onFilterChange({ type: filter.type })} className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors ${activeFilter.type === filter.type ? 'bg-primary-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-700'}`}>
                        {filter.icon}
                        <span>{filter.label}</span>
                    </button>
                ))}
            </div>

            <CollapsibleSection title="Dự án" defaultOpen>
                <div className="space-y-1">
                    {projects.map(project => (
                        <button
                            key={project.id}
                            onClick={() => onFilterChange({ type: 'project', id: project.id })}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                                activeFilter.type === 'project' && activeFilter.id === project.id
                                ? 'bg-primary-600 text-white font-semibold'
                                : 'text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            <div className="flex items-center gap-3 truncate">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }}></div>
                                <span className="truncate">{project.name}</span>
                            </div>
                            <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full ${activeFilter.type === 'project' && activeFilter.id === project.id ? 'bg-primary-500' : 'bg-slate-700'}`}>
                                {taskCountsByProject[project.id] || 0}
                            </span>
                        </button>
                    ))}
                </div>
            </CollapsibleSection>

             <div className="space-y-6">
                {layout.map((key) => {
                    const section = componentMap[key];
                    if (!section) return null;

                    return (
                        <div
                            key={key}
                            draggable
                            onDragStart={(e) => handleDragStart(e, key)}
                            onDragEnter={(e) => handleDragEnter(e, key)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className="cursor-move"
                            title="Kéo để sắp xếp lại"
                        >
                            <CollapsibleSection title={section.title} defaultOpen>
                                {section.component}
                            </CollapsibleSection>
                        </div>
                    );
                })}
            </div>
            
            {notificationPermissionStatus === 'denied' && (
              <div className="bg-red-900/50 p-4 rounded-2xl border border-red-700 flex items-start gap-3">
                <ShieldOff size={24} className="text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-red-300">Thông báo đã bị chặn</h4>
                  <p className="text-sm text-red-300/80">Bạn đã chặn thông báo. Vui lòng bật lại trong cài đặt trình duyệt để nhận nhắc nhở.</p>
                </div>
              </div>
            )}
            <div className="bg-primary-900/30 p-4 rounded-2xl border border-primary-700/50 flex items-start gap-3">
                <BellRing size={24} className="text-primary-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-primary-300">Nhắc nhở thông minh</h4>
                  <p className="text-sm text-primary-300/80">Khi được cho phép, bạn sẽ nhận được thông báo và âm thanh cho các công việc quá hạn.</p>
                   {notificationPermissionStatus === 'default' && (
                     <button onClick={onRequestNotificationPermission} className="mt-2 text-xs bg-primary-600 text-white font-semibold py-1 px-2 rounded-md hover:bg-primary-700">
                        Cho phép thông báo
                     </button>
                   )}
                </div>
            </div>
            
        </aside>
    );
};

export default RightSidebar;