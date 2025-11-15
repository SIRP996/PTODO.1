
import React, { useState, useRef, MouseEvent, TouchEvent, useEffect, KeyboardEvent, useMemo } from 'react';
import { Task, TaskStatus, Project, UserProfile } from '../types';
import { Trash2, Calendar, CheckCircle2, Flag, Repeat, Play, ListTree, Loader2, Circle, ChevronDown, ChevronRight, Pencil, Pickaxe, StickyNote, Plus, Save, X, UserPlus, Check, UserCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { Type } from '@google/genai';
import { getGoogleGenAI } from '../utils/gemini';
import { useToast } from '../context/ToastContext';
import type { User as FirebaseUser } from 'firebase/auth';

interface TaskItemProps {
  task: Task;
  subtasks: Task[];
  projects: Project[];
  profiles: Map<string, UserProfile>;
  currentUser: FirebaseUser | null;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id:string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onToggleTaskUrgency: (id: string) => void;
  onStartFocus: (task: Task) => void;
  onAddSubtasksBatch: (parentId: string, subtaskTexts: string[]) => Promise<void>;
  onApiKeyError: () => void;
  hasApiKey: boolean;
  onUpdateTaskText: (id: string, newText: string) => void;
  onUpdateTaskStatus: (id: string, status: TaskStatus) => void;
  onUpdateTaskNote: (id: string, note: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  style?: React.CSSProperties;
}

const SWIPE_THRESHOLD = 80;

const TaskItem: React.FC<TaskItemProps> = ({ task, subtasks, projects, profiles, currentUser, onToggleTask, onDeleteTask, onUpdateTaskDueDate, onToggleTaskUrgency, onStartFocus, onAddSubtasksBatch, onApiKeyError, hasApiKey, onUpdateTaskText, onUpdateTaskStatus, onUpdateTaskNote, onUpdateTask, style }) => {
  const isOverdue = task.dueDate && task.status !== 'completed' && isPast(new Date(task.dueDate));
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
  const [areSubtasksVisible, setAreSubtasksVisible] = useState(true);
  const { addToast } = useToast();

  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const taskRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentTranslateXRef = useRef(0);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<Task | null>(null);

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState(task.note || '');
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  
  const [currentEditTag, setCurrentEditTag] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const assignButtonRef = useRef<HTMLButtonElement>(null);
  const assignPopoverRef = useRef<HTMLDivElement>(null);

  const isOwner = useMemo(() => {
    if (!currentUser) return false;
    // Personal tasks (no project) belong to the user who created them
    if (!task.projectId) {
      return task.userId === currentUser.uid;
    }
    // For project tasks, only the project owner has full rights
    const project = projects.find(p => p.id === task.projectId);
    return project ? project.ownerId === currentUser.uid : false;
  }, [currentUser, task, projects]);

  const projectMembers = useMemo(() => {
    if (!task.projectId) return [];
    const project = projects.find(p => p.id === task.projectId);
    if (!project) return [];
    return project.memberIds.map(id => profiles.get(id)).filter(Boolean) as UserProfile[];
  }, [task.projectId, projects, profiles]);

  const assignees = useMemo(() => 
    task.assigneeIds.map(id => profiles.get(id)).filter(Boolean) as UserProfile[],
    [task.assigneeIds, profiles]
  );

  const handleAssignClick = () => {
    setIsAssigning(p => !p);
  };

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (isAssigning && assignPopoverRef.current && !assignPopoverRef.current.contains(event.target as Node) && !assignButtonRef.current?.contains(event.target as Node)) {
        setIsAssigning(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAssigning]);

  const handleToggleAssignee = (memberId: string) => {
    const newAssigneeIds = task.assigneeIds.includes(memberId)
      ? task.assigneeIds.filter(id => id !== memberId)
      : [...task.assigneeIds, memberId];
    onUpdateTask(task.id, { assigneeIds: newAssigneeIds });
  };


  useEffect(() => {
    if (isEditingNote && noteTextareaRef.current) {
        noteTextareaRef.current.focus();
        noteTextareaRef.current.style.height = 'auto';
        noteTextareaRef.current.style.height = `${noteTextareaRef.current.scrollHeight}px`;
    }
  }, [isEditingNote]);
  
  useEffect(() => {
    if (editingSubtaskId && subtaskInputRef.current) {
        subtaskInputRef.current.focus();
    }
  }, [editingSubtaskId]);

  const startEditing = () => {
    if (task.status === 'completed' || isGeneratingSubtasks) return;
    setEditState({ ...task });
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setEditState(null);
  };

  const handleSaveEditing = () => {
    if (!editState) return;
    const updates: Partial<Task> = {};
    const originalTask = task;

    (Object.keys(editState) as Array<keyof Task>).forEach(key => {
        if (key === 'hashtags' || key === 'assigneeIds') {
            if (JSON.stringify(editState[key]) !== JSON.stringify(originalTask[key])) {
                updates[key] = editState[key];
            }
        } else if (editState[key] !== originalTask[key]) {
            (updates as any)[key] = editState[key];
        }
    });
    
    if(updates.projectId === '') {
        updates.projectId = undefined;
    }

    if (Object.keys(updates).length > 0) {
      onUpdateTask(task.id, updates);
    }
    setIsEditing(false);
    setEditState(null);
  };
  
  const handleEditChange = (updates: Partial<Task>) => {
    if (editState) {
      setEditState({ ...editState, ...updates });
    }
  };

  const handleEditTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentEditTag.trim() && editState) {
      e.preventDefault();
      const newTag = currentEditTag.trim().toLowerCase();
      if (!editState.hashtags.includes(newTag)) {
        handleEditChange({ hashtags: [...editState.hashtags, newTag] });
      }
      setCurrentEditTag('');
    }
  };

  const removeEditTag = (tagToRemove: string) => {
    if (editState) {
      handleEditChange({ hashtags: editState.hashtags.filter(tag => tag !== tagToRemove) });
    }
  };

  const recurrenceOptions: Array<{id: 'none' | 'daily' | 'weekly' | 'monthly', label: string}> = [
      { id: 'none', label: 'Không lặp lại'},
      { id: 'daily', label: 'Hàng ngày'},
      { id: 'weekly', label: 'Hàng tuần'},
      { id: 'monthly', label: 'Hàng tháng'},
  ];


  const handleSaveNote = () => {
    if (editNoteText.trim() !== (task.note || '').trim()) {
        onUpdateTaskNote(task.id, editNoteText.trim());
    }
    setIsEditingNote(false);
  };

  const handleDragStart = (clientX: number) => {
    if (isEditingDate || isEditing) return;
    startXRef.current = clientX;
    setIsSwiping(true);
    if(taskRef.current) {
        taskRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (clientX: number) => {
    if (!isSwiping || isEditingDate || isEditing) return;
    const deltaX = clientX - startXRef.current;
    const newTranslateX = task.status !== 'completed' ? Math.max(0, deltaX) : 0;
    setTranslateX(newTranslateX);
    currentTranslateXRef.current = newTranslateX;
  };

  const handleDragEnd = () => {
    if (!isSwiping || isEditingDate || isEditing) return;
    setIsSwiping(false);
    if(taskRef.current) {
        taskRef.current.style.transition = 'transform 0.3s ease';
    }
    if (currentTranslateXRef.current > SWIPE_THRESHOLD) {
      onToggleTask(task.id);
    }
    setTranslateX(0);
    currentTranslateXRef.current = 0;
  };

  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => handleDragStart(e.clientX);
  const onMouseMove = (e: MouseEvent<HTMLDivElement>) => handleDragMove(e.clientX);
  const onMouseUp = () => handleDragEnd();
  const onMouseLeave = () => handleDragEnd();
  
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => handleDragStart(e.touches[0].clientX);
  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => handleDragMove(e.touches[0].clientX);
  const onTouchEnd = () => handleDragEnd();

  const handleDateUpdate = (newDateValue: string) => {
    const newDate = newDateValue ? new Date(newDateValue).toISOString() : null;
    onUpdateTaskDueDate(task.id, newDate);
    setIsEditingDate(false);
  };
  
  const handleGenerateSubtasks = async () => {
    setIsGeneratingSubtasks(true);
    try {
        const ai = getGoogleGenAI();
        if (!ai) {
          addToast("Vui lòng thiết lập API Key để sử dụng tính năng AI.", "info");
          setIsGeneratingSubtasks(false);
          return;
        }
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are an expert project manager AI. Your task is to break down a large, complex task into smaller, actionable sub-tasks.
            
            Instructions:
            1.  The user's request is in Vietnamese.
            2.  Analyze the task: "${task.text}".
            3.  Generate a list of 3 to 5 concise sub-tasks.
            4.  Each sub-task should be a clear, actionable item, also in Vietnamese.
            5.  Return ONLY the JSON array, without any surrounding text or markdown formatting.
            
            Example:
            User Task: "Lên kế hoạch cho chiến dịch marketing Q4"
            Your Output: ["Nghiên cứu đối thủ cạnh tranh", "Xác định đối tượng khách hàng mục tiêu", "Lên ý tưởng thông điệp chính", "Soạn thảo nội dung cho email & mạng xã hội", "Thiết lập ngân sách và KPI"]
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                    },
                },
            },
        });
        
        const jsonStr = response.text.trim();
        if (!jsonStr) {
            throw new Error("AI returned an empty response. This might be due to a content filter or an API issue.");
        }

        const parsedSubtasks = JSON.parse(jsonStr);

        if (Array.isArray(parsedSubtasks) && parsedSubtasks.every(item => typeof item === 'string')) {
            await onAddSubtasksBatch(task.id, parsedSubtasks);
        } else {
            throw new Error("AI returned data in an unexpected format.");
        }

    } catch (error: any) {
        console.error("AI sub-task generation failed:", error);
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('api key not valid') || errorMessage.includes('permission_denied')) {
            onApiKeyError();
        } else {
            addToast("AI không thể tạo công việc con. Vui lòng thử lại.", "error");
        }
    } finally {
        setIsGeneratingSubtasks(false);
    }
  };
  
  const handleAddSubtaskKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newSubtaskText.trim()) {
      await onAddSubtasksBatch(task.id, [newSubtaskText.trim()]);
      setNewSubtaskText('');
    }
  };

  const handleStartEditSubtask = (subtask: Task) => {
    if (subtask.status === 'completed') return;
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskText(subtask.text);
  };
  
  const handleSaveSubtask = () => {
    if (editingSubtaskId && editingSubtaskText.trim()) {
        const originalSubtask = subtasks.find(st => st.id === editingSubtaskId);
        if (originalSubtask && originalSubtask.text !== editingSubtaskText.trim()) {
            onUpdateTaskText(editingSubtaskId, editingSubtaskText.trim());
        }
    }
    setEditingSubtaskId(null);
    setEditingSubtaskText('');
  };

  const handleSubtaskKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleSaveSubtask();
    }
    if (e.key === 'Escape') {
        setEditingSubtaskId(null);
        setEditingSubtaskText('');
    }
  };

  const dueDateForInput = task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm") : '';

  return (
    <div
      className={`relative border-b border-slate-700/50 last:border-b-0 animate-fadeIn ${isAssigning ? 'overflow-visible z-10' : 'overflow-hidden'}`}
      style={style}
    >
       {isGeneratingSubtasks && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-20">
              <Loader2 size={24} className="animate-spin text-primary-400" />
              <span className="ml-3 text-slate-300">AI đang chia nhỏ công việc...</span>
          </div>
      )}
      <div 
        className="absolute inset-0 bg-green-600 flex items-center justify-start px-6"
        style={{ opacity: Math.min(translateX / SWIPE_THRESHOLD, 1), zIndex: 0 }}
        aria-hidden="true"
      >
        <CheckCircle2 size={24} className="text-white" />
      </div>
      <div
        ref={taskRef}
        className={`relative flex items-start p-4 transition-colors duration-200 ${
          task.status === 'completed' ? 'bg-slate-800/40' : 'bg-slate-800/80'
        } ${task.isUrgent && task.status !== 'completed' ? 'border-l-4 border-red-500 pl-3' : ''} ${task.status === 'inprogress' ? 'border-l-4 border-primary-500 pl-3' : ''}`}
        style={{ transform: `translateX(${translateX}px)`, zIndex: 1, touchAction: 'pan-y' }}
        onMouseDown={onMouseDown}
        onMouseMove={isSwiping ? onMouseMove : undefined}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex-shrink-0 mt-1">
            {!isEditing && task.status !== 'completed' && (
                <button 
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => onStartFocus(task)}
                    className="mr-3 text-slate-500 hover:text-primary-400 transition-colors"
                    title="Bắt đầu tập trung"
                >
                    <Play size={18} />
                </button>
            )}
        </div>
        
        <div className="ml-0 flex-grow">
            {isEditing && editState ? (
                <div className="space-y-4" onMouseDown={e => e.stopPropagation()}>
                    <textarea
                        value={editState.text}
                        onChange={(e) => handleEditChange({ text: e.target.value })}
                        className="w-full bg-[#293548] text-slate-200 border border-primary-600 focus:ring-1 focus:ring-primary-500 rounded-md p-2 text-sm resize-y"
                        rows={2}
                        autoFocus
                    />
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Giao cho</label>
                        {isOwner ? (
                            task.projectId && projectMembers.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#293548] border border-slate-600 rounded-lg">
                                    {projectMembers.map(member => (
                                        <button
                                            key={member.uid}
                                            type="button"
                                            onClick={() => handleEditChange({ assigneeIds: editState.assigneeIds.includes(member.uid) ? editState.assigneeIds.filter(id => id !== member.uid) : [...editState.assigneeIds, member.uid] })}
                                            className={`flex items-center gap-2 p-1 rounded-md transition-colors ${editState.assigneeIds.includes(member.uid) ? 'bg-primary-600/80 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
                                            title={member.displayName}
                                        >
                                            <div className="w-5 h-5 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                                                {member.photoURL ? <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" /> : <UserCircle size={14} className="text-slate-400 m-auto" />}
                                            </div>
                                            <span className="text-xs truncate max-w-[100px]">{member.displayName}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-xs text-slate-500 p-1 italic">
                                    {task.projectId ? 'Chưa có thành viên trong dự án.' : 'Công việc không thuộc dự án nào.'}
                                </span>
                            )
                        ) : (
                            assignees.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#293548] border border-slate-600 rounded-lg">
                                    {assignees.map(member => (
                                        <div key={member.uid} className="flex items-center gap-2 p-1 rounded-md bg-slate-700 text-slate-300" title={member.displayName}>
                                            <div className="w-5 h-5 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                                                {member.photoURL ? <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" /> : <UserCircle size={14} className="text-slate-400 m-auto" />}
                                            </div>
                                            <span className="text-xs truncate max-w-[100px]">{member.displayName}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-xs text-slate-500 p-1 italic">Chưa giao cho ai.</span>
                            )
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Dự án</label>
                        <select value={editState.projectId || ''} onChange={(e) => handleEditChange({ projectId: e.target.value || undefined })} className="w-full bg-[#293548] text-slate-200 border border-slate-600 rounded-lg px-2 py-1 text-sm">
                            <option value="">Không thuộc dự án nào</option>
                            {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Thẻ</label>
                        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#293548] border border-slate-600 rounded-lg">
                            {editState.hashtags.map(tag => (
                                <span key={tag} className="flex items-center bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
                                    #{tag}
                                    <button type="button" onClick={() => removeEditTag(tag)} className="ml-1.5"><X size={12} /></button>
                                </span>
                            ))}
                            <input type="text" value={currentEditTag} onChange={(e) => setCurrentEditTag(e.target.value)} onKeyDown={handleEditTagKeyDown} placeholder="Thêm thẻ..." className="flex-grow bg-transparent focus:ring-0 border-0 p-1 text-xs"/>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Thời hạn</label>
                            <input type="datetime-local" value={editState.dueDate ? format(new Date(editState.dueDate), "yyyy-MM-dd'T'HH:mm") : ''} onChange={(e) => handleEditChange({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })} className="w-full bg-[#293548] text-slate-200 border border-slate-600 rounded-lg px-2 py-1 text-sm"/>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Lặp lại</label>
                            <select value={editState.recurrenceRule || 'none'} onChange={(e) => handleEditChange({ recurrenceRule: e.target.value as Task['recurrenceRule'] })} disabled={!editState.dueDate} className="w-full bg-[#293548] text-slate-200 border border-slate-600 rounded-lg px-2 py-1 text-sm disabled:opacity-50">
                                {recurrenceOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" id={`urgent-edit-${task.id}`} checked={editState.isUrgent} onChange={(e) => handleEditChange({ isUrgent: e.target.checked })} className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-primary-600 focus:ring-primary-500"/>
                        <label htmlFor={`urgent-edit-${task.id}`} className="ml-2 text-sm text-slate-300">Công việc khẩn cấp</label>
                    </div>
                </div>
            ) : (
                <>
                    <p className={`${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{task.text}</p>
                    {task.hashtags && task.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                        {task.hashtags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 text-xs font-medium text-primary-200 bg-primary-900/50 rounded-full">#{tag}</span>
                        ))}
                        </div>
                    )}
                    {assignees.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex -space-x-2">
                            {assignees.map(assignee => (
                              <div key={assignee.uid} className="relative group">
                                <div className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden ring-2 ring-slate-800/80">
                                  {assignee.photoURL ? <img src={assignee.photoURL} alt={assignee.displayName} className="w-full h-full object-cover" /> : <UserCircle size={16} className="text-slate-400 m-auto" />}
                                </div>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-slate-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                  {assignee.displayName}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                    )}
                    <div className="flex items-center gap-4">
                        {!isEditingDate && (
                        <div onMouseDown={e => e.stopPropagation()} className={`flex items-center text-xs mt-2 ${isOverdue ? 'text-red-400' : task.dueDate ? 'text-slate-400' : 'text-slate-500'} ${task.status === 'completed' ? '' : 'cursor-pointer'}`} onClick={() => task.status !== 'completed' && setIsEditingDate(true)} title={task.status !== 'completed' ? (task.dueDate ? "Chỉnh sửa ngày hết hạn" : "Thêm ngày hết hạn") : ""}>
                            <Calendar size={14} className="mr-1.5" />
                            {task.dueDate ? (
                                <>
                                    <span>{format(new Date(task.dueDate), "dd/MM/yyyy 'lúc' h:mm a")}</span>
                                    {isOverdue && <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-md font-bold text-[10px]">(Quá hạn)</span>}
                                </>
                            ) : (<span>Thêm ngày hết hạn</span>)}
                        </div>
                        )}
                        {task.recurrenceRule && task.recurrenceRule !== 'none' && task.status !== 'completed' && (
                        <div className="flex items-center text-xs mt-2 text-slate-400" title={`Lặp lại ${task.recurrenceRule === 'daily' ? 'hàng ngày' : task.recurrenceRule === 'weekly' ? 'hàng tuần' : 'hàng tháng'}`}><Repeat size={14} className="mr-1.5" /></div>
                        )}
                    </div>
                    {isEditingDate && (<div className="mt-2" onMouseDown={e => e.stopPropagation()}><input type="datetime-local" defaultValue={dueDateForInput} autoFocus onBlur={(e) => handleDateUpdate(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter') handleDateUpdate(e.currentTarget.value); if (e.key === 'Escape') setIsEditingDate(false);}} className="w-full sm:w-auto bg-[#293548] text-slate-200 border border-primary-600 rounded-lg px-2 py-1 text-xs"/></div>)}
                </>
            )}

          {(task.note || isEditingNote) && !isEditing && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              {isEditingNote ? (
                <textarea
                  ref={noteTextareaRef}
                  value={editNoteText}
                  onChange={(e) => {
                    setEditNoteText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  onBlur={handleSaveNote}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveNote();
                    }
                    if (e.key === 'Escape') {
                      setIsEditingNote(false);
                      setEditNoteText(task.note || '');
                    }
                  }}
                  placeholder="Thêm ghi chú..."
                  className="w-full bg-[#293548] text-slate-300 border border-primary-600 focus:ring-1 focus:ring-primary-500 rounded-md p-2 text-sm resize-none overflow-hidden block"
                />
              ) : (
                <p className="text-sm text-slate-400 whitespace-pre-wrap bg-slate-700/40 p-2 rounded-md">{task.note}</p>
              )}
            </div>
          )}

          <div className="mt-4 pt-3 pl-4 border-t border-slate-700/50">
              {subtasks.length > 0 && (
                  <button onMouseDown={e => e.stopPropagation()} onClick={() => setAreSubtasksVisible(!areSubtasksVisible)} className="flex items-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 hover:text-slate-200 transition-colors w-full">
                  {areSubtasksVisible ? <ChevronDown size={16} className="mr-1" /> : <ChevronRight size={16} className="mr-1" />}
                  <span>Công việc con ({subtasks.length})</span>
                  </button>
              )}
              {(areSubtasksVisible || subtasks.length === 0) && (
              <div className="space-y-2">
                  {subtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-center justify-between gap-3 group min-h-[28px]">
                        {editingSubtaskId === subtask.id ? (
                            <div className="flex items-center gap-3 flex-grow">
                                <span className="flex-shrink-0 w-4 h-4" /> {/* Spacer to align with checkbox */}
                                <input ref={subtaskInputRef} type="text" value={editingSubtaskText} onChange={(e) => setEditingSubtaskText(e.target.value)} onBlur={handleSaveSubtask} onKeyDown={handleSubtaskKeyDown} className="w-full bg-slate-700 text-slate-200 text-sm focus:ring-0 border-0 p-0 rounded"/>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <button onMouseDown={e => e.stopPropagation()} onClick={() => onToggleTask(subtask.id)} className="flex-shrink-0">
                                        {subtask.status === 'completed' ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-slate-500 group-hover:text-slate-300" />}
                                    </button>
                                    <p className={`text-sm ${subtask.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{subtask.text}</p>
                                </div>
                                <div className="flex items-center" onMouseDown={e => e.stopPropagation()}>
                                    <button onClick={() => handleStartEditSubtask(subtask)} className="text-slate-500 hover:text-primary-400 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-full disabled:opacity-0 disabled:cursor-not-allowed" title="Sửa công việc con" disabled={subtask.status === 'completed'}><Pencil size={14} /></button>
                                    {isOwner && <button onClick={() => onDeleteTask(subtask.id)} className="text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-full" title="Xóa công việc con"><Trash2 size={14} /></button>}
                                </div>
                            </>
                        )}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 group">
                      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center ml-px"><Plus size={16} className="text-slate-500" /></span>
                      <input type="text" value={newSubtaskText} onChange={(e) => setNewSubtaskText(e.target.value)} onKeyDown={handleAddSubtaskKeyDown} placeholder="Thêm công việc con và nhấn Enter" className="w-full bg-transparent text-slate-300 placeholder:text-slate-500 text-sm focus:ring-0 border-0 p-0" disabled={isGeneratingSubtasks || task.status === 'completed'}/>
                  </div>
              </div>
              )}
          </div>
        </div>
        <div className="ml-4 flex-shrink-0 flex items-center gap-2" onMouseDown={e => e.stopPropagation()}>
          {isEditing ? (
            <>
              <button onClick={handleCancelEditing} title="Hủy" className="p-2 text-slate-400 hover:text-white transition-colors duration-200 z-10"><X size={20} /></button>
              <button onClick={handleSaveEditing} title="Lưu" className="p-2 text-primary-400 hover:text-primary-300 transition-colors duration-200 z-10"><Save size={20} /></button>
            </>
          ) : (
            <>
              {task.status !== 'completed' && (
                <>
                  {!task.parentId && (
                    <button onClick={handleGenerateSubtasks} disabled={isGeneratingSubtasks || !hasApiKey} className="p-2 text-slate-500 hover:text-primary-400 transition-colors duration-200 z-10 disabled:text-slate-600 disabled:hover:text-slate-600 disabled:cursor-not-allowed" title={hasApiKey ? "Chia nhỏ công việc bằng AI" : "Thêm API Key để sử dụng tính năng AI"}><ListTree size={18} /></button>
                  )}
                  <button onClick={() => { setIsEditingNote(prev => !prev); if(!isEditingNote) setEditNoteText(task.note || '') }} className="p-2 text-slate-500 hover:text-primary-400 transition-colors duration-200 z-10" aria-label="Thêm/Sửa ghi chú" title="Thêm/Sửa ghi chú"><StickyNote size={18} /></button>
                  <button onClick={startEditing} className="p-2 text-slate-500 hover:text-primary-400 transition-colors duration-200 z-10" aria-label="Chỉnh sửa nội dung" title="Chỉnh sửa nội dung"><Pencil size={18} /></button>
                  {isOwner && task.projectId && (
                    <div className="relative">
                        <button
                            ref={assignButtonRef}
                            onClick={handleAssignClick}
                            className="p-2 text-slate-500 hover:text-primary-400 transition-colors duration-200 z-10"
                            title="Giao việc"
                        >
                            <UserPlus size={18} />
                        </button>
                        {isAssigning && (
                            <div ref={assignPopoverRef} className="absolute right-0 w-64 bg-[#293548] border border-slate-600 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto top-full mt-2">
                                <div className="p-2 text-xs font-semibold text-slate-400 border-b border-slate-600">Giao cho</div>
                                {projectMembers.length > 0 ? projectMembers.map(member => (
                                    <button
                                        key={member.uid}
                                        onClick={() => handleToggleAssignee(member.uid)}
                                        className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-700 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                                                {member.photoURL ? <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" /> : <UserCircle size={16} className="text-slate-400 m-auto" />}
                                            </div>
                                            <span className="text-sm text-slate-200 truncate">{member.displayName}</span>
                                        </div>
                                        {task.assigneeIds.includes(member.uid) && <Check size={16} className="text-primary-400" />}
                                    </button>
                                )) : (
                                    <p className="p-3 text-sm text-slate-500">Dự án này chưa có thành viên.</p>
                                )}
                            </div>
                        )}
                    </div>
                  )}
                  <button onClick={() => onUpdateTaskStatus(task.id, task.status === 'inprogress' ? 'todo' : 'inprogress')} className={`p-2 transition-colors duration-200 z-10 ${task.status === 'inprogress' ? 'text-primary-400 hover:text-primary-300' : 'text-slate-500 hover:text-primary-400'}`} title={task.status === 'inprogress' ? 'Dừng làm' : 'Bắt đầu làm'}><Pickaxe size={18} className={task.status === 'inprogress' ? 'digging-animation' : ''} /></button>
                  <button onClick={() => onToggleTaskUrgency(task.id)} className={`p-2 transition-colors duration-200 z-10 ${task.isUrgent ? 'text-red-500 hover:text-red-400' : 'text-slate-500 hover:text-red-500'}`} aria-label={task.isUrgent ? "Bỏ đánh dấu GẤP" : "Đánh dấu là GẤP"} title={task.isUrgent ? "Bỏ đánh dấu GẤP" : "Đánh dấu là GẤP"}><Flag size={18} /></button>
                </>
              )}
              <button onClick={() => onToggleTask(task.id)} className="p-2 text-slate-500 hover:text-green-500 transition-colors duration-200 z-10" aria-label={task.status === 'completed' ? "Đánh dấu chưa hoàn thành" : "Đánh dấu đã hoàn thành"} title={task.status === 'completed' ? "Đánh dấu chưa hoàn thành" : "Đánh dấu đã hoàn thành"}><CheckCircle2 size={20} className={task.status === 'completed' ? "text-green-500" : ""} /></button>
              {isOwner && <button onClick={() => onDeleteTask(task.id)} className="p-2 text-slate-500 hover:text-red-500 transition-colors duration-200 z-10" aria-label="Xóa công việc" title="Xóa công việc"><Trash2 size={18} /></button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(TaskItem);
