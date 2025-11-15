
import React, { useState, useMemo } from 'react';
import { Task, UserProfile, Project } from '../types';
import { format, isPast } from 'date-fns';
import { Flag, Calendar, ListTree, Trash2, Play, ChevronRight, ChevronDown, Circle, CheckCircle2, StickyNote, UserCircle } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

interface KanbanCardProps {
  task: Task;
  subtasks: Task[];
  profiles: Map<string, UserProfile>;
  currentUser: FirebaseUser | null;
  projects: Project[];
  onDragStart: (taskId: string) => void;
  isDragging: boolean;
  onToggleTaskUrgency: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onStartFocus: (task: Task) => void;
  onToggleTask: (id: string) => void;
  onUpdateTaskNote: (id: string, note: string) => void;
  style?: React.CSSProperties;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ task, subtasks, profiles, currentUser, projects, onDragStart, isDragging, onToggleTaskUrgency, onDeleteTask, onStartFocus, onToggleTask, onUpdateTaskNote, style }) => {
  const isOverdue = task.dueDate && task.status !== 'completed' && isPast(new Date(task.dueDate));
  const [areSubtasksVisible, setAreSubtasksVisible] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState(task.note || '');

  const isOwner = useMemo(() => {
    if (!currentUser) return false;
    if (!task.projectId) { // Personal task
        return task.userId === currentUser.uid;
    }
    const project = projects.find(p => p.id === task.projectId);
    return project ? project.ownerId === currentUser.uid : false;
  }, [currentUser, task, projects]);

  const assignees = useMemo(() => 
    task.assigneeIds.map(id => profiles.get(id)).filter(Boolean) as UserProfile[],
    [task.assigneeIds, profiles]
  );

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSaveNote = () => {
    if (editNoteText.trim() !== (task.note || '').trim()) {
        onUpdateTaskNote(task.id, editNoteText.trim());
    }
    setIsEditingNote(false);
  };


  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`bg-black/20 backdrop-blur-sm p-4 rounded-xl shadow-md cursor-grab active:cursor-grabbing border transition-all duration-200 hover:bg-black/30 hover:border-slate-600 animate-fadeIn ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'} ${task.isUrgent && task.status !== 'completed' ? 'border-red-500' : 'border-slate-700/50'}`}
      style={style}
    >
      <p className={`font-semibold mb-2 ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-100'}`}>{task.text}</p>
      
      {task.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {task.hashtags.map(tag => (
            <span key={tag} className="px-2 py-0.5 text-xs font-medium text-primary-200 bg-primary-900/50 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {task.dueDate && (
        <div className={`flex items-center text-xs mt-3 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
          <Calendar size={14} className="mr-1.5" />
          <span>{format(new Date(task.dueDate), "dd/MM/yyyy")}</span>
          {isOverdue && <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-md font-bold text-[10px]">Quá hạn</span>}
        </div>
      )}

      {(task.note || isEditingNote) && (
        <div className="mt-3">
            {isEditingNote ? (
                <textarea
                    value={editNoteText}
                    onChange={(e) => setEditNoteText(e.target.value)}
                    onBlur={handleSaveNote}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNote(); } if (e.key === 'Escape') { setIsEditingNote(false); setEditNoteText(task.note || ''); } }}
                    placeholder="Thêm ghi chú..."
                    className="w-full bg-[#293548] text-slate-300 border border-primary-600 focus:ring-1 focus:ring-primary-500 rounded-md p-2 text-sm resize-none overflow-hidden block"
                    autoFocus
                />
            ) : (
                <p className="text-sm text-slate-400 whitespace-pre-wrap bg-slate-700/50 p-2 rounded-md">{task.note}</p>
            )}
        </div>
      )}

      {areSubtasksVisible && subtasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-700/50 space-y-2">
            {subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center justify-between gap-3 group text-sm py-1">
                    <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); onToggleTask(subtask.id); }} className="flex-shrink-0">
                            {subtask.status === 'completed' ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-slate-500 group-hover:text-slate-300" />}
                        </button>
                        <p className={`${subtask.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                            {subtask.text}
                        </p>
                    </div>
                    {isOwner && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDeleteTask(subtask.id); }}
                            className="text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-full"
                            title="Xóa công việc con"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            ))}
        </div>
      )}


      <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-4 text-slate-500">
            {assignees.length > 0 && (
                <div className="flex -space-x-2">
                    {assignees.map(assignee => (
                        <div key={assignee.uid} title={assignee.displayName} className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden ring-2 ring-black/20">
                            {assignee.photoURL ? <img src={assignee.photoURL} alt={assignee.displayName} className="w-full h-full object-cover" /> : <UserCircle size={16} className="text-slate-400 m-auto" />}
                        </div>
                    ))}
                </div>
            )}
            {task.isUrgent && task.status !== 'completed' && <span title="Khẩn cấp"><Flag size={16} className="text-red-500" /></span>}
            {subtasks.length > 0 && (
             <button 
                onClick={(e) => { e.stopPropagation(); setAreSubtasksVisible(!areSubtasksVisible); }}
                className="flex items-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                title="Hiển thị/Ẩn công việc con"
            >
                {areSubtasksVisible ? <ChevronDown size={16} className="mr-1" /> : <ChevronRight size={16} className="mr-1" />}
                <ListTree size={14} className="mr-1" />
                <span>{subtasks.length}</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
            {task.status !== 'completed' && (
              <>
                <button 
                    onClick={(e) => { e.stopPropagation(); onStartFocus(task); }}
                    className="text-slate-500 hover:text-primary-400 p-1 rounded-full transition-colors"
                    title="Bắt đầu tập trung"
                >
                    <Play size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditingNote(prev => !prev); if(!isEditingNote) setEditNoteText(task.note || '') }}
                  className="text-slate-500 hover:text-primary-400 p-1 rounded-full transition-colors"
                  title="Thêm/Sửa ghi chú"
                >
                  <StickyNote size={16} />
                </button>
              </>
            )}
             <button
                onClick={(e) => { e.stopPropagation(); onToggleTaskUrgency(task.id); }}
                className={`p-1 rounded-full transition-colors ${task.isUrgent && task.status !== 'completed' ? 'text-red-500' : 'text-slate-500 hover:text-red-500'}`}
                title={task.isUrgent ? "Bỏ đánh dấu GẤP" : "Đánh dấu là GẤP"}
            >
                <Flag size={16} />
            </button>
            {isOwner && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                    className="text-slate-500 hover:text-red-500 p-1 rounded-full transition-colors"
                    title="Xóa công việc"
                >
                    <Trash2 size={16} />
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default KanbanCard;
