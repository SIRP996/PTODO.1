import React, { useState, useMemo, KeyboardEvent, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Task, Project, Filter, SectionKey } from '../types';
import { useAuth } from '../context/AuthContext';
import { Download, LogOut, KeyRound, UserCircle, Users, BookOpen, Calendar, Sun, AlertTriangle, Layers3, ChevronDown, BellRing, ShieldOff, Link as LinkIcon, Folder, Plus, Tag, Pencil, Trash2, ChevronRight, EyeOff, Eye, Palette, ClipboardList, MoreVertical } from 'lucide-react';
import SearchBar from './SearchBar';
import Dashboard from './Dashboard';
import AdvancedDashboard from './AdvancedDashboard';
import UtilitiesSection from './UtilitiesSection';

interface SourceSidebarProps {
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
    onOpenWeeklyReview: () => void;
    hasApiKey: boolean;
    notificationPermissionStatus: string;
    onRequestNotificationPermission: () => void;
    onOpenExtensionGuide: () => void;
    onOpenMemberManager: (project: Project) => void;
    onAddProject: (name: string) => void;
    onDeleteProject: (id: string) => void;
    onUpdateProject: (id: string, data: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>) => void;
}

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    return (
        <details open={defaultOpen} className="bg-slate-800/20 backdrop-blur-lg rounded-2xl border border-white/10 shadow-lg group">
            <summary className="p-4 font-semibold text-slate-100 cursor-pointer list-none flex justify-between items-center">
                {title}
                <div className="colorful-chevron-wrapper">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="colorful-chevron-arrow text-glow-green transition-transform duration-300 group-open:rotate-180"
                    >
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </summary>
            <div className="p-4 pt-0">
                {children}
            </div>
        </details>
    )
}

const PROJECT_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#a855f7', '#14b8a6', '#3b82f6',
];


const SourceSidebar: React.FC<SourceSidebarProps> = ({ 
    user, tasks, projects, searchTerm, onSearchChange, activeFilter, onFilterChange, 
    onLogout, onManageApiKey, onOpenSettings, onToggleLogViewer, onOpenTemplateManager, onOpenWeeklyReview, hasApiKey,
    notificationPermissionStatus, onRequestNotificationPermission, onOpenExtensionGuide, onOpenMemberManager,
    onAddProject, onDeleteProject, onUpdateProject
}) => {
    const { userSettings, isGuestMode, exitGuestMode, updateUserSettings } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const componentMap: Record<SectionKey, { title: string; component: React.ReactNode }> = {
        dashboard: { title: "Bảng điều khiển", component: <Dashboard tasks={tasks} /> },
        advancedDashboard: { title: "Phân tích chi tiết", component: <AdvancedDashboard tasks={tasks} /> },
        utilities: { title: "Tiện ích", component: <UtilitiesSection tasks={tasks} onOpenTemplateManager={onOpenTemplateManager} onOpenWeeklyReview={onOpenWeeklyReview} /> },
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

    const [isAddingProject, setIsAddingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editingProjectName, setEditingProjectName] = useState('');
    const [colorPickerProjectId, setColorPickerProjectId] = useState<string | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const taskCounts = useMemo(() => {
        const counts: { [projectId: string]: number } = {};
        projects.forEach(p => counts[p.id] = 0);
        tasks.forEach(task => {
            if (task.projectId && counts.hasOwnProperty(task.projectId)) {
                counts[task.projectId]++;
            }
        });
        return counts;
    }, [tasks, projects]);

    useEffect(() => {
        if (editingProjectId && editInputRef.current) {
        editInputRef.current.focus();
        }
    }, [editingProjectId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (colorPickerRef.current && !colorPickerRef.current.contains(target)) {
                setColorPickerProjectId(null);
            }
             if (menuRef.current && !menuRef.current.contains(target)) {
                setMenuProjectId(null);
                setConfirmingDeleteId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const visibleProjects = useMemo(() => projects.filter(p => p.isVisible !== false), [projects]);
    const hiddenProjects = useMemo(() => projects.filter(p => p.isVisible === false), [projects]);

    const handleAddProject = () => {
        if (newProjectName.trim()) {
        onAddProject(newProjectName.trim());
        setNewProjectName('');
        setIsAddingProject(false);
        }
    };

    const handleProjectInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
        handleAddProject();
        }
        if (e.key === 'Escape') {
        setIsAddingProject(false);
        setNewProjectName('');
        }
    };

    const handleStartEditing = (project: Project) => {
        setConfirmingDeleteId(null);
        setEditingProjectId(project.id);
        setEditingProjectName(project.name);
    };
    
    const handleCancelEditing = () => {
        setEditingProjectId(null);
        setEditingProjectName('');
        setColorPickerProjectId(null);
    };

    const handleConfirmEdit = () => {
        if (editingProjectId && editingProjectName.trim() && projects.find(p=>p.id === editingProjectId)?.name !== editingProjectName.trim()) {
        onUpdateProject(editingProjectId, { name: editingProjectName.trim() });
        }
        handleCancelEditing();
    };
    
    const handleColorUpdate = (projectId: string, color: string) => {
        onUpdateProject(projectId, { color });
        setColorPickerProjectId(null);
    }

    const handleEditInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
        handleConfirmEdit();
        } else if (e.key === 'Escape') {
        handleCancelEditing();
        }
    };
    
    const isAnyMenuOpen = !!menuProjectId;

    return (
        <aside className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 space-y-6 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-primary-600 scrollbar-track-slate-800/50">
            <div className="relative z-10 bg-black/10 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-lg flex justify-between items-center">
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
                    <button onClick={() => setIsUserMenuOpen(p => !p)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                        <div className="colorful-chevron-wrapper">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`colorful-chevron-arrow text-glow-green transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                            >
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </button>
                    {isUserMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800/80 backdrop-blur-md border border-white/20 rounded-lg shadow-xl z-50">
                             {isGuestMode ? (
                                <div className="p-2"><button onClick={() => { exitGuestMode(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-white bg-primary-600 hover:bg-primary-700"><Users className="h-4 w-4" /><span>Đăng ký để lưu dữ liệu</span></button></div>
                            ) : (
                                <div className="p-2">
                                    <button onClick={() => { onOpenSettings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-white/10"><UserCircle className="h-4 w-4" /><span>Cài đặt tài khoản</span></button>
                                    <button onClick={() => { onManageApiKey(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-white/10"><KeyRound className="h-4 w-4" /><span>Quản lý API Key</span></button>
                                    <button onClick={() => { onOpenExtensionGuide(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-white/10"><LinkIcon className="h-4 w-4" /><span>Tích hợp Trình duyệt</span></button>
                                    <button onClick={() => { onToggleLogViewer(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-slate-300 hover:bg-white/10"><BookOpen className="h-4 w-4" /><span>Xem Log đồng bộ</span></button>
                                </div>
                            )}
                            <div className="p-2 border-t border-white/10">
                                <button onClick={handleAuthAction} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-red-400 hover:bg-red-900/50 hover:text-red-300"><LogOut className="h-4 w-4" /><span>{isGuestMode ? 'Thoát' : 'Đăng xuất'}</span></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <SearchBar searchTerm={searchTerm} onSearchChange={onSearchChange} />

            <div className="space-y-1">
                {quickFilters.map(filter => (
                     <button key={filter.type} onClick={() => onFilterChange({ type: filter.type })} className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors border border-transparent ${activeFilter.type === filter.type ? 'bg-primary-600/80 text-white font-semibold border-primary-500/50' : 'text-slate-300 hover:bg-white/5'}`}>
                        {filter.icon}
                        <span>{filter.label}</span>
                    </button>
                ))}
            </div>

            <div className={isAnyMenuOpen ? 'relative z-10' : ''}>
                <CollapsibleSection title="Dự án" defaultOpen>
                  <ul className="space-y-1 list-none">
                    <li>
                      <button
                        onClick={() => onFilterChange({ type: 'all' })}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                          activeFilter.type === 'all' ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Layers3 size={16} />
                          <span>Tất cả công việc</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeFilter.type === 'all' ? 'bg-primary-500' : 'bg-slate-700'}`}>{tasks.length}</span>
                      </button>
                    </li>
                    {visibleProjects.map(project => (
                      <li key={project.id}>
                        {editingProjectId === project.id ? (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <div className="relative">
                              <button
                                onClick={() => setColorPickerProjectId(project.id === colorPickerProjectId ? null : project.id)}
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: project.color }}
                                title="Đổi màu dự án"
                              />
                              {colorPickerProjectId === project.id && (
                                <div ref={colorPickerRef} className="absolute top-full left-0 mt-2 z-10 bg-[#293548] p-2 rounded-lg border border-slate-600 grid grid-cols-4 gap-2">
                                  {PROJECT_COLORS.map(color => (
                                    <button
                                      key={color}
                                      onClick={() => handleColorUpdate(project.id, color)}
                                      className="w-5 h-5 rounded-full"
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingProjectName}
                              onChange={(e) => setEditingProjectName(e.target.value)}
                              onKeyDown={handleEditInputKeyDown}
                              onBlur={handleConfirmEdit}
                              className="w-full bg-[#293548] text-sm text-slate-200 border border-primary-600 focus:border-primary-500 focus:ring-0 rounded-md px-2 py-1 transition"
                            />
                          </div>
                        ) : (
                          <div
                            onClick={() => onFilterChange({ type: 'project', id: project.id })}
                            className={`group w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors cursor-pointer ${
                              activeFilter.type === 'project' && activeFilter.id === project.id
                                ? 'bg-primary-600 text-white'
                                : 'text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-grow truncate">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }}></div>
                              <span className="truncate">{project.name}</span>
                            </div>
                            
                            <div className={`flex items-center gap-2 text-xs font-semibold ${activeFilter.type === 'project' && activeFilter.id === project.id ? 'text-primary-200' : 'text-slate-400'}`}>
                                <div className="flex items-center gap-1" title="Số công việc"><ClipboardList size={14} /><span>{taskCounts[project.id] || 0}</span></div>
                                <div className="flex items-center gap-1" title="Số thành viên"><Users size={14} /><span>{project.memberIds.length}</span></div>
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setMenuProjectId(menuProjectId === project.id ? null : project.id); setConfirmingDeleteId(null); }}
                                        className={`p-1 rounded-full ${activeFilter.type === 'project' && activeFilter.id === project.id ? 'hover:bg-primary-500' : 'hover:bg-slate-600'}`}
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                    {menuProjectId === project.id && (
                                        <div ref={menuRef} className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 p-1">
                                            {confirmingDeleteId === project.id ? (
                                                <div className="p-2 text-center">
                                                    <p className="text-xs text-slate-300 mb-2">Chắc chắn xóa?</p>
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setMenuProjectId(null); setConfirmingDeleteId(null); }} className="px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-900/50 rounded">Xóa</button>
                                                        <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }} className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 rounded">Hủy</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <ul className="space-y-1 list-none">
                                                    <li><button onClick={(e) => { e.stopPropagation(); onOpenMemberManager(project); setMenuProjectId(null); }} className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700"><Users size={14} /> Quản lý thành viên</button></li>
                                                    <li><button onClick={(e) => { e.stopPropagation(); onUpdateProject(project.id, { isVisible: false }); setMenuProjectId(null); }} className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700"><EyeOff size={14} /> Ẩn dự án</button></li>
                                                    <li><button onClick={(e) => { e.stopPropagation(); handleStartEditing(project); setMenuProjectId(null); }} className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700"><Pencil size={14} /> Sửa tên</button></li>
                                                    <li><button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(project.id); }} className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-red-400 hover:bg-red-900/50"><Trash2 size={14} /> Xóa dự án</button></li>
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                    {isAddingProject && (
                      <li>
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={handleProjectInputKeyDown}
                          onBlur={handleAddProject}
                          placeholder="Tên dự án mới..."
                          className="w-full bg-[#293548] text-sm text-slate-200 border border-primary-600 focus:border-primary-500 focus:ring-0 rounded-lg px-3 py-2 transition"
                          autoFocus
                        />
                      </li>
                    )}
                  </ul>
                </CollapsibleSection>
            </div>

            {hiddenProjects.length > 0 && (
            <details className="bg-slate-800/20 backdrop-blur-lg rounded-2xl border border-white/10 shadow-lg group">
                <summary className="p-4 font-semibold text-slate-400 cursor-pointer list-none flex justify-between items-center text-sm">
                    Dự án đã ẩn
                </summary>
                <div className="px-4 pb-4 pt-0">
                    <ul className="space-y-1 list-none">
                        {hiddenProjects.map(project => (
                        <li key={project.id} className="group w-full flex items-center justify-between px-3 py-2 text-sm rounded-md text-slate-400 hover:bg-slate-700">
                            <div className="flex items-center gap-3 flex-grow truncate">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }}></div>
                                <span className="truncate">{project.name}</span>
                            </div>
                             <div className="flex-shrink-0 flex items-center gap-2 text-xs text-slate-500">
                                <div className="flex items-center gap-1" title="Số công việc"><ClipboardList size={14} /><span>{taskCounts[project.id] || 0}</span></div>
                                <div className="flex items-center gap-1" title="Số thành viên"><Users size={14} /><span>{project.memberIds.length}</span></div>
                                <div className="relative">
                                    <button onClick={(e) => { e.stopPropagation(); setMenuProjectId(menuProjectId === project.id ? null : project.id); }} className="p-1 rounded-full hover:bg-slate-600"><MoreVertical size={16} /></button>
                                    {menuProjectId === project.id && (
                                        <div ref={menuRef} className="absolute top-full right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 p-1">
                                            <button onClick={(e) => { e.stopPropagation(); onUpdateProject(project.id, { isVisible: true }); setMenuProjectId(null); }} className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-slate-300 hover:bg-slate-700"><Eye size={14} /> Hiện lại dự án</button>
                                        </div>
                                    )}
                                </div>
                             </div>
                        </li>
                        ))}
                    </ul>
                </div>
            </details>
            )}

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
              <div className="bg-red-900/40 backdrop-blur-md p-4 rounded-2xl border border-red-700/50 flex items-start gap-3">
                <ShieldOff size={24} className="text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-semibold text-red-300">Thông báo đã bị chặn</h4>
                  <p className="text-sm text-red-300/80">Bạn đã chặn thông báo. Vui lòng bật lại trong cài đặt trình duyệt để nhận nhắc nhở.</p>
                </div>
              </div>
            )}
            <div className="bg-primary-900/30 backdrop-blur-md p-4 rounded-2xl border border-primary-700/50 flex items-start gap-3">
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

export default SourceSidebar;