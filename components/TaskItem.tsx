import React, { useState, useRef, MouseEvent, TouchEvent } from 'react';
import { Task } from '../types';
import { Trash2, Calendar, CheckCircle2, Flag, Repeat, Play } from 'lucide-react';
import { format, isPast } from 'date-fns';

interface TaskItemProps {
  task: Task;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id:string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onToggleTaskUrgency: (id: string) => void;
  onStartFocus: (task: Task) => void;
}

const SWIPE_THRESHOLD = 80;

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggleTask, onDeleteTask, onUpdateTaskDueDate, onToggleTaskUrgency, onStartFocus }) => {
  const isOverdue = task.dueDate && !task.completed && isPast(new Date(task.dueDate));
  const [isEditingDate, setIsEditingDate] = useState(false);

  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const taskRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const currentTranslateXRef = useRef(0);

  const handleDragStart = (clientX: number) => {
    if (isEditingDate) return;
    startXRef.current = clientX;
    setIsSwiping(true);
    if(taskRef.current) {
        taskRef.current.style.transition = 'none';
    }
  };

  const handleDragMove = (clientX: number) => {
    if (!isSwiping || isEditingDate) return;
    const deltaX = clientX - startXRef.current;
    const newTranslateX = !task.completed ? Math.max(0, deltaX) : 0;
    setTranslateX(newTranslateX);
    currentTranslateXRef.current = newTranslateX;
  };

  const handleDragEnd = () => {
    if (!isSwiping || isEditingDate) return;
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
  
  const dueDateForInput = task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm") : '';

  return (
    <div className="relative overflow-hidden border-b border-slate-700/50 last:border-b-0">
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
          <p className={`${task.completed ? 'text-slate-500' : 'text-slate-200'}`}>
            {task.text}
          </p>

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
        </div>
        <div className="ml-4 flex-shrink-0 flex items-center gap-4">
          {!task.completed && (
            <button 
              onClick={() => onToggleTaskUrgency(task.id)}
              className={`transition-colors duration-200 z-10 ${task.isUrgent ? 'text-red-500 hover:text-red-400' : 'text-slate-500 hover:text-red-500'}`}
              aria-label={task.isUrgent ? "Bỏ đánh dấu GẤP" : "Đánh dấu là GẤP"}
              title={task.isUrgent ? "Bỏ đánh dấu GẤP" : "Đánh dấu là GẤP"}
            >
              <Flag size={18} />
            </button>
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

export default TaskItem;