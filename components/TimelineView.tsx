import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task } from '../types';
import { 
  format, 
  isSameDay, 
  isToday,
  parseISO,
  addDays,
  subDays,
  getHours,
  getMinutes,
  isPast,
  set
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Play, ClipboardList } from 'lucide-react';

const HOUR_HEIGHT = 60; // px

const colors = [
    'bg-blue-500/80 border-blue-400', 
    'bg-pink-500/80 border-pink-400', 
    'bg-amber-500/80 border-amber-400', 
    'bg-green-500/80 border-green-400', 
    'bg-purple-500/80 border-purple-400',
    'bg-teal-500/80 border-teal-400',
    'bg-indigo-500/80 border-indigo-400',
];

const getColorForTask = (taskId: string) => {
    let hash = 0;
    for (let i = 0; i < taskId.length; i++) {
        hash = taskId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
};

interface TimelineViewProps {
  tasks: Task[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onStartFocus: (task: Task) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ tasks, currentDate, onDateChange, onStartFocus, onUpdateTaskDueDate }) => {
  const [nowPosition, setNowPosition] = useState<number | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const tasksForDay = useMemo(() => {
    return tasks
      .filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), currentDate))
      .sort((a, b) => parseISO(a.dueDate!).getTime() - parseISO(b.dueDate!).getTime());
  }, [tasks, currentDate]);

  useEffect(() => {
    const updateIndicator = () => {
      if (isToday(currentDate)) {
        const now = new Date();
        const top = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
        setNowPosition(top);
      } else {
        setNowPosition(null);
      }
    };
    updateIndicator();
    const interval = setInterval(updateIndicator, 60000);
    return () => clearInterval(interval);
  }, [currentDate]);

  useEffect(() => {
    if (nowPosition !== null && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = Math.max(0, nowPosition - (HOUR_HEIGHT * 3));
    }
  }, [nowPosition]);
  
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTask(task);
  };

  const handleDrop = (date: Date, hour: number, minute: number) => {
    if (!draggedTask) return;
    const newDate = set(date, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
    onUpdateTaskDueDate(draggedTask.id, newDate.toISOString());
    setDraggedTask(null);
  };

  return (
    <div className="flex flex-col h-full max-h-[75vh]">
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-700/50">
        <h3 className="text-lg font-semibold text-white">
          {format(currentDate, 'EEEE, dd MMMM, yyyy', { locale: vi })}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => onDateChange(subDays(currentDate, 1))} className="p-2 rounded-full hover:bg-slate-700 transition-colors"><ChevronLeft size={20} /></button>
          <button onClick={() => onDateChange(new Date())} className="text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors border border-slate-600">Hôm nay</button>
          <button onClick={() => onDateChange(addDays(currentDate, 1))} className="p-2 rounded-full hover:bg-slate-700 transition-colors"><ChevronRight size={20} /></button>
        </div>
      </div>
      
      <div ref={scrollContainerRef} className="flex-grow overflow-y-auto relative">
        <div className="flex">
          <div className="w-16 flex-shrink-0">
            {Array.from({ length: 24 }).map((_, hour) => (
              <div key={hour} style={{ height: `${HOUR_HEIGHT}px` }} className="text-right pr-2 text-xs text-slate-500 relative border-b border-slate-700/50">
                <span className="absolute -top-2 right-2">{format(new Date(2000, 0, 1, hour), 'HH:mm')}</span>
              </div>
            ))}
          </div>
          
          <div className="flex-grow relative">
            {Array.from({ length: 48 }).map((_, i) => (
              <div 
                key={i}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(currentDate, Math.floor(i / 2), (i % 2) * 30)}
                style={{ height: `${HOUR_HEIGHT / 2}px` }} 
                className={`border-b border-l border-slate-700/50 ${i % 2 === 0 ? '' : 'border-dashed'}`}
              />
            ))}
            
            {nowPosition !== null && (
                <div className="absolute left-0 right-0 z-10" style={{ top: `${nowPosition}px` }}>
                    <div className="relative h-px bg-red-500">
                        <div className="absolute -left-2 -top-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-slate-900"></div>
                    </div>
                </div>
            )}
            
            {tasksForDay.map(task => {
              const startTime = parseISO(task.dueDate!);
              const top = (getHours(startTime) + getMinutes(startTime) / 60) * HOUR_HEIGHT;
              const isOverdue = isPast(startTime) && task.status !== 'completed';
              
              return (
                <div 
                  key={task.id}
                  draggable={task.status !== 'completed'}
                  onDragStart={(e) => handleDragStart(e, task)}
                  className={`absolute left-2 right-2 p-2 rounded-lg text-white flex justify-between items-start border-l-4 transition-all hover:shadow-lg hover:z-20 ${getColorForTask(task.id)} ${task.status === 'completed' ? 'opacity-50 cursor-default' : 'cursor-grab active:cursor-grabbing'} ${draggedTask?.id === task.id ? 'opacity-30 scale-105' : ''}`}
                  style={{ top: `${top}px`, height: `${HOUR_HEIGHT - 4}px` }}
                  title={task.text}
                >
                    <div>
                        <p className={`font-bold text-xs leading-tight ${task.status === 'completed' ? 'line-through' : ''}`}>{task.text}</p>
                        <p className="text-xs opacity-80">{format(startTime, 'h:mm a')}</p>
                         {isOverdue && <span className="text-[10px] font-bold text-red-300">(Quá hạn)</span>}
                    </div>
                    {task.status !== 'completed' && (
                         <button
                            onClick={(e) => { e.stopPropagation(); onStartFocus(task); }}
                            className="p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors flex-shrink-0"
                            title="Bắt đầu tập trung"
                         >
                            <Play size={14}/>
                         </button>
                    )}
                </div>
              );
            })}

             {tasksForDay.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-600">
                    <ClipboardList size={48} />
                    <p className="mt-4">Không có công việc nào cho hôm nay.</p>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
