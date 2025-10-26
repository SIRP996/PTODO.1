

import React, { useState, useRef, MouseEvent, TouchEvent, useEffect, KeyboardEvent } from 'react';
import { Task } from '../types';
import { Trash2, Calendar, CheckCircle2, Flag, Repeat, Play, ListTree, Loader2, Circle, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { Type } from '@google/genai';
import { getGoogleGenAI } from '../utils/gemini';
import { useToast } from '../context/ToastContext';

interface TaskItemProps {
  task: Task;
  subtasks: Task[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id:string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onToggleTaskUrgency: (id: string) => void;
  onStartFocus: (task: Task) => void;
  onAddSubtasksBatch: (parentId: string, subtaskTexts: string[]) => Promise<void>;
  onApiKeyError: () => void;
  hasApiKey: boolean;
  onUpdateTaskText: (id: string, newText: string) => void;
}

const SWIPE_THRESHOLD = 80;

const TaskItem: React.FC<TaskItemProps> = ({ task, subtasks, onToggleTask, onDeleteTask, onUpdateTaskDueDate, onToggleTaskUrgency, onStartFocus, onAddSubtasksBatch, onApiKeyError, hasApiKey, onUpdateTaskText }) => {
  const isOverdue = task.dueDate && !task.completed && isPast(new Date(task.dueDate));
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
  const [editText, setEditText] = useState(task.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }
  }, [isEditing]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleSave = () => {
    if (editText.trim() && editText.trim() !== task.text) {
      onUpdateTaskText(task.id, editText);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(task.text);
    }
  };

  const startEditing = () => {
    if (task.completed || isGeneratingSubtasks) return;
    setEditText(task.text);
    setIsEditing(true);
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
    const newTranslateX = !task.completed ? Math.max(0, deltaX) : 0;
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
  
  const dueDateForInput = task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm") : '';

  return (
    <div className="relative overflow-hidden border-b border-slate-700/50 last:border-b-0">
       {isGeneratingSubtasks && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-20">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
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
          task.completed ? 'bg-slate-800/40' : 'bg-slate-800/80'
        } ${task.isUrgent && !task.completed ? 'border-l-4 border-red-500 pl-3' : ''}`}
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
            {!task.completed && (
                <button 
                    onClick={() => onStartFocus(task)}
                    className="mr-3 text-slate-500 hover:text-indigo-400 transition-colors"
                    title="Bắt đầu tập trung"
                >
                    <Play size={18} />
                </button>
            )}
        </div>
        
        <div className="ml-0 flex-grow">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={handleTextChange}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[#293548] text-slate-200 border border-indigo-600 focus:ring-1 focus:ring-indigo-500 rounded-md p-2 -m-2 text-sm resize-none overflow-hidden block"
              rows={1}
            />
          ) : (
            <p 
                className={`${task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}
            >
                {task.text}
            </p>
          )}

          {task.hashtags && task.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {task.hashtags.map(tag => (
                <span key={tag} className="px-2 py-0.5 text-xs font-medium text-indigo-200 bg-indigo-900/50 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-4">
            {!isEditingDate && (
              <div 
                className={`flex items-center text-xs mt-2 ${isOverdue ? 'text-red-400' : task.dueDate ? 'text-slate-400' : 'text-slate-500'} ${task.completed ? '' : 'cursor-pointer'}`}
                onClick={() => !task.completed && setIsEditingDate(true)}
                title={!task.completed ? (task.dueDate ? "Chỉnh sửa ngày hết hạn" : "Thêm ngày hết hạn") : ""}
              >
                <Calendar size={14} className="mr-1.5" />
                {task.dueDate ? (
                  <>
                    <span>{format(new Date(task.dueDate), "dd/MM/yyyy 'lúc' h:mm a")}</span>
                    {isOverdue && <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-md font-bold text-[10px]">(Quá hạn)</span>}
                  </>
                ) : (
                  <span>Thêm ngày hết hạn</span>
                )}
              </div>
            )}
            
            {task.recurrenceRule && task.recurrenceRule !== 'none' && !task.completed && (
              <div className="flex items-center text-xs mt-2 text-slate-400" title={`Lặp lại ${task.recurrenceRule === 'daily' ? 'hàng ngày' : task.recurrenceRule === 'weekly' ? 'hàng tuần' : 'hàng tháng'}`}>
                <Repeat size={14} className="mr-1.5" />
              </div>
            )}
          </div>

          {isEditingDate && (
            <div className="mt-2">
              <input
                type="datetime-local"
                defaultValue={dueDateForInput}
                autoFocus
                onBlur={(e) => handleDateUpdate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDateUpdate(e.currentTarget.value);
                  if (e.key === 'Escape') setIsEditingDate(false);
                }}
                className="w-full sm:w-auto bg-[#293548] text-slate-200 border border-indigo-600 focus:border-indigo-500 focus:ring-0 rounded-lg px-2 py-1 text-xs transition"
              />
            </div>
          )}

          {subtasks && subtasks.length > 0 && (
            <div className="mt-4 pt-3 pl-4 border-t border-slate-700/50">
              <button 
                onClick={() => setAreSubtasksVisible(!areSubtasksVisible)}
                className="flex items-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 hover:text-slate-200 transition-colors w-full"
              >
                {areSubtasksVisible ? <ChevronDown size={16} className="mr-1" /> : <ChevronRight size={16} className="mr-1" />}
                <span>Công việc con ({subtasks.length})</span>
              </button>
              {areSubtasksVisible && (
                <div className="space-y-2">
                  {subtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-center justify-between gap-3 group">
                        <div className="flex items-center gap-3">
                            <button onClick={() => onToggleTask(subtask.id)} className="flex-shrink-0">
                                {subtask.completed ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-slate-500 group-hover:text-slate-300" />}
                            </button>
                            <p className={`text-sm ${subtask.completed ? 'text-slate-500' : 'text-slate-300'}`}>
                                {subtask.text}
                            </p>
                        </div>
                        <button
                            onClick={() => onDeleteTask(subtask.id)}
                            className="text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-full"
                            title="Xóa công việc con"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
        <div className="ml-4 flex-shrink-0 flex items-center gap-4">
          {!task.completed && (
            <>
              {!task.parentId && (
                <button
                    onClick={handleGenerateSubtasks}
                    disabled={isGeneratingSubtasks || !hasApiKey}
                    className="text-slate-500 hover:text-indigo-400 transition-colors duration-200 z-10 disabled:text-slate-600 disabled:hover:text-slate-600 disabled:cursor-not-allowed"
                    title={hasApiKey ? "Chia nhỏ công việc bằng AI" : "Thêm API Key để sử dụng tính năng AI"}
                >
                    <ListTree size={18} />
                </button>
              )}
               <button
                  onClick={startEditing}
                  className="text-slate-500 hover:text-indigo-400 transition-colors duration-200 z-10"
                  aria-label="Chỉnh sửa nội dung"
                  title="Chỉnh sửa nội dung"
              >
                  <Pencil size={18} />
              </button>
              <button 
                onClick={() => onToggleTaskUrgency(task.id)}
                className={`transition-colors duration-200 z-10 ${task.isUrgent ? 'text-red-500 hover:text-red-400' : 'text-slate-500 hover:text-red-500'}`}
                aria-label={task.isUrgent ? "Bỏ đánh dấu GẤP" : "Đánh dấu là GẤP"}
                title={task.isUrgent ? "Bỏ đánh dấu GẤP" : "Đánh dấu là GẤP"}
              >
                <Flag size={18} />
              </button>
            </>
          )}
          <button 
            onClick={() => onToggleTask(task.id)}
            className="text-slate-500 hover:text-green-500 transition-colors duration-200 z-10"
            aria-label={task.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu đã hoàn thành"}
            title={task.completed ? "Đánh dấu chưa hoàn thành" : "Đánh dấu đã hoàn thành"}
          >
            <CheckCircle2 size={20} className={task.completed ? "text-green-500" : ""} />
          </button>
          <button 
            onClick={() => onDeleteTask(task.id)}
            className="text-slate-500 hover:text-red-500 transition-colors duration-200 z-10"
            aria-label="Xóa công việc"
            title="Xóa công việc"
            >
              <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(TaskItem);