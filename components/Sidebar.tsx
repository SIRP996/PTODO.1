import React, { useState, useMemo, KeyboardEvent, useEffect, useRef } from 'react';
import { Project, Task } from '../types';
import { Folder, Plus, Tag, Layers, Pencil, Trash2, ChevronDown, ChevronRight, EyeOff, Eye, Palette } from 'lucide-react';

interface SidebarProps {
  tasks: Task[];
  projects: Project[];
  onAddProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProject: (id: string, data: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>) => void;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  hashtags: string[];
  activeHashtag: string | null;
  onSelectHashtag: (hashtag: string | null) => void;
  hashtagStatuses: { [key: string]: 'overdue' | 'pending' | 'completed' };
}

const PROJECT_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#a855f7', '#14b8a6', '#3b82f6',
];


const Sidebar: React.FC<SidebarProps> = ({
  tasks,
  projects,
  onAddProject,
  onDeleteProject,
  onUpdateProject,
  selectedProjectId,
  onSelectProject,
  hashtags,
  activeHashtag,
  onSelectHashtag,
  hashtagStatuses
}) => {
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [colorPickerProjectId, setColorPickerProjectId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [isHiddenProjectsExpanded, setIsHiddenProjectsExpanded] = useState(false);
  
  const taskCounts = useMemo(() => {
    const counts: { [projectId: string]: number } = {};
    projects.forEach(p => counts[p.id] = 0); // Initialize all projects with 0
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
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setColorPickerProjectId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
  
   const sortedHashtags = useMemo(() => {
    const statusPriority = {
      'overdue': 1,
      'pending': 2,
      'completed': 3,
    };
    return [...hashtags].sort((a, b) => {
      const statusA = hashtagStatuses[a] || 'completed';
      const statusB = hashtagStatuses[b] || 'completed';
      if ((statusPriority[statusA] || 4) !== (statusPriority[statusB] || 4)) {
        return (statusPriority[statusA] || 4) - (statusPriority[statusB] || 4);
      }
      return a.localeCompare(b);
    });
  }, [hashtags, hashtagStatuses]);

  const getTagClasses = (tag: string, isActive: boolean) => {
    if (isActive) {
      return 'bg-primary-500 text-white';
    }
    const status = hashtagStatuses[tag];
    switch (status) {
      case 'overdue': return 'bg-red-800/80 text-red-200 hover:bg-red-700 blinking';
      case 'pending': return 'bg-amber-800/80 text-amber-200 hover:bg-amber-700';
      case 'completed': return 'bg-emerald-800/80 text-emerald-200 hover:bg-emerald-700';
      default: return 'bg-slate-700 text-slate-300 hover:bg-slate-600';
    }
  };

  return (
    <aside className="w-64 bg-slate-800/30 flex-shrink-0 p-4 space-y-6 overflow-y-auto hidden lg:block">
      {/* Projects Section */}
      <div>
        <div 
          className="flex justify-between items-center mb-2 cursor-pointer group"
          onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
        >
          <div className="flex items-center gap-2">
            {isProjectsExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
            <h3 className="text-xs font-bold uppercase text-slate-500">Dự án</h3>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setIsAddingProject(true); setIsProjectsExpanded(true); }}
            className="text-slate-400 hover:text-white"
            title="Thêm dự án mới"
          >
            <Plus size={16} />
          </button>
        </div>
        {isProjectsExpanded && (
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => onSelectProject(null)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                selectedProjectId === null ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers size={16} />
                <span>Tất cả công việc</span>
              </div>
               <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedProjectId === null ? 'bg-primary-500' : 'bg-slate-700'}`}>{tasks.length}</span>
            </button>
          </li>
          {visibleProjects.map(project => (
            <li key={project.id} className="relative">
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
                  onClick={() => onSelectProject(project.id)}
                  className={`group w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors cursor-pointer ${
                    selectedProjectId === project.id
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <div
                    className="flex items-center gap-3 flex-grow truncate"
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }}></div>
                    <Folder size={16} />
                    <span className="truncate">{project.name}</span>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-opacity duration-200 group-hover:opacity-0 ${selectedProjectId === project.id ? 'bg-primary-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                      {taskCounts[project.id] || 0}
                    </span>
                     <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity duration-200 ${confirmingDeleteId === project.id ? 'opacity-100 bg-slate-900/80 backdrop-blur-sm p-1 rounded-md' : 'opacity-0 group-hover:opacity-100'}`}>
                        {confirmingDeleteId === project.id ? (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setConfirmingDeleteId(null); }} className="px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-900/50 rounded">Xóa</button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }} className="px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 rounded">Hủy</button>
                            </>
                        ) : (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onUpdateProject(project.id, { isVisible: false }); }} className={`p-1 ${selectedProjectId === project.id ? 'hover:text-primary-200' : 'hover:text-white'}`} title="Ẩn dự án"><EyeOff size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleStartEditing(project); }} className={`p-1 ${selectedProjectId === project.id ? 'hover:text-primary-200' : 'hover:text-white'}`} title="Sửa tên dự án"><Pencil size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(project.id); }} className={`p-1 ${selectedProjectId === project.id ? 'hover:text-red-300' : 'hover:text-red-400'}`} title="Xóa dự án"><Trash2 size={14} /></button>
                            </>
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
        )}
      </div>

      {isProjectsExpanded && hiddenProjects.length > 0 && (
         <div>
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setIsHiddenProjectsExpanded(!isHiddenProjectsExpanded)}
            >
              {isHiddenProjectsExpanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
              <h4 className="text-xs font-semibold text-slate-500">Dự án đã ẩn</h4>
            </div>
            {isHiddenProjectsExpanded && (
              <ul className="space-y-1 mt-2">
                {hiddenProjects.map(project => (
                  <li key={project.id} className="relative group w-full flex items-center justify-between px-3 py-2 text-sm rounded-md text-slate-400 hover:bg-slate-700">
                    <div className="flex items-center gap-3 flex-grow truncate">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }}></div>
                        <span className="truncate">{project.name}</span>
                    </div>
                     <div className="flex-shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-600 text-slate-300 group-hover:opacity-0 transition-opacity">
                          {taskCounts[project.id] || 0}
                        </span>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); onUpdateProject(project.id, { isVisible: true }); }} className="p-1 hover:text-white" title="Hiện lại dự án"><Eye size={14} /></button>
                        </div>
                     </div>
                  </li>
                ))}
              </ul>
            )}
         </div>
      )}

      {/* Tags Section */}
      <div>
        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Thẻ</h3>
         <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onSelectHashtag(null)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors self-start ${
                activeHashtag === null
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Tất cả
            </button>
            {sortedHashtags.map(tag => (
              <button
                key={tag}
                onClick={() => onSelectHashtag(tag)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${getTagClasses(tag, activeHashtag === tag)}`}
              >
                #{tag}
              </button>
            ))}
         </div>
      </div>
    </aside>
  );
};

export default Sidebar;