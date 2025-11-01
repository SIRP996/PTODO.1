import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Task } from '../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  isSameMonth, 
  isToday,
  parseISO
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, Flag, Play, X, Clock } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onStartFocus: (task: Task) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onToggleTask, onStartFocus }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null); // e.g., '2024-11-21'
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const dayModalRef = useRef<HTMLDivElement>(null);

  const tasksByDate = useMemo(() => {
    const groupedTasks: { [key: string]: Task[] } = {};
    tasks.forEach(task => {
      if (task.dueDate) {
        const dateKey = format(parseISO(task.dueDate), 'yyyy-MM-dd');
        if (!groupedTasks[dateKey]) {
          groupedTasks[dateKey] = [];
        }
        groupedTasks[dateKey].push(task);
      }
    });
    // Sort tasks within each day: urgent first, then by time
    Object.keys(groupedTasks).forEach(dateKey => {
      if (groupedTasks[dateKey]) {
          groupedTasks[dateKey].sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            if (a.dueDate && b.dueDate) {
                 return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
            }
            return 0;
          });
      }
    });
    return groupedTasks;
  }, [tasks]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: vi, weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { locale: vi, weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  
  const handleTaskClick = (task: Task, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const container = (event.currentTarget as HTMLElement).closest('.kanban-wrapper');
    const containerRect = container ? container.getBoundingClientRect() : { top: 0, left: 0, width: window.innerWidth };
    
    let top = rect.bottom - containerRect.top + 8;
    let left = rect.left - containerRect.left;

    // Adjust if popover would go off-screen
    if (left + 288 > containerRect.width) { // 288px is width of popover (w-72)
        left = rect.right - containerRect.left - 288;
    }
     if (top + 200 > window.innerHeight) { 
        top = rect.top - containerRect.top - 210;
    }
    
    setSelectedTask(task);
    setPopoverPosition({ top, left });
  };

  const closePopover = useCallback(() => {
    setSelectedTask(null);
    setPopoverPosition(null);
  }, []);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        closePopover();
      }
      if (dayModalRef.current && !dayModalRef.current.contains(event.target as Node)) {
        setExpandedDay(null);
      }
    };
    if (selectedTask || expandedDay) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedTask, closePopover, expandedDay]);

  return (
    <div className="bg-slate-900/50 p-4 rounded-xl relative kanban-wrapper">
      <div className="flex justify-between items-center mb-4 px-2">
        <button onClick={prevMonth} className="p-2 rounded-full hover:bg-slate-700 transition-colors"><ChevronLeft size={20} /></button>
        <h2 className="text-xl font-bold text-white capitalize">{format(currentDate, 'MMMM yyyy', { locale: vi })}</h2>
        <button onClick={nextMonth} className="p-2 rounded-full hover:bg-slate-700 transition-colors"><ChevronRight size={20} /></button>
      </div>

      <div className="grid grid-cols-7">
        {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map(day => (
          <div key={day} className="text-center font-semibold text-slate-400 text-xs py-2 border-b border-slate-700/50">{day}</div>
        ))}
        
        {days.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const tasksForDay = tasksByDate[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <div 
              key={day.toString()} 
              className={`relative h-32 border-t border-l border-slate-800 p-2 flex flex-col ${!isCurrentMonth ? 'bg-slate-800/30 text-slate-600' : 'text-slate-300'} last:border-r`}
            >
              <span className={`font-semibold text-sm ${isCurrentDay ? 'bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>{format(day, 'd')}</span>
              <div className="mt-1 space-y-1 overflow-y-auto pr-1 flex-grow">
                {tasksForDay.slice(0, 2).map(task => (
                  <button
                    key={task.id}
                    onClick={(e) => handleTaskClick(task, e)}
                    className={`w-full text-left text-xs p-1 rounded transition-colors flex items-center gap-1.5 truncate ${
                      task.status === 'completed' 
                        ? 'bg-emerald-900/70 hover:bg-emerald-800 text-emerald-400' 
                        : task.isUrgent ? 'bg-red-900/70 hover:bg-red-800 text-red-300' : 'bg-primary-900/70 hover:bg-primary-800 text-primary-300'
                    }`}
                  >
                    {task.status === 'completed' && <CheckCircle2 size={12} className="flex-shrink-0" />}
                    <span className={`truncate ${task.status === 'completed' ? 'line-through' : ''}`}>{task.text}</span>
                  </button>
                ))}
                {tasksForDay.length > 2 && (
                  <button 
                    onClick={() => setExpandedDay(dateKey)}
                    className="text-xs text-slate-400 mt-1 hover:text-primary-400 font-semibold text-left w-full p-1 rounded hover:bg-slate-700/50"
                  >
                    +{tasksForDay.length - 2} nữa
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {selectedTask && popoverPosition && (
        <div 
            ref={popoverRef}
            style={{ top: popoverPosition.top, left: popoverPosition.left }}
            className="absolute z-30 w-72 bg-[#1E293B] border border-slate-700 rounded-lg shadow-2xl p-4 animate-fadeIn"
        >
            <button onClick={closePopover} className="absolute top-2 right-2 text-slate-500 hover:text-white"><X size={18} /></button>
            <p className={`font-semibold mb-2 ${selectedTask.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>{selectedTask.text}</p>
            {selectedTask.dueDate && (
                <div className="flex items-center text-sm text-slate-400 mb-3">
                    <Clock size={14} className="mr-2" />
                    <span>{format(parseISO(selectedTask.dueDate), "dd/MM/yyyy 'lúc' h:mm a", { locale: vi })}</span>
                </div>
            )}
             {selectedTask.hashtags && selectedTask.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedTask.hashtags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs font-medium text-primary-200 bg-primary-900/50 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
            )}
            <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onStartFocus(selectedTask); closePopover(); }} className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-primary-400" title="Bắt đầu tập trung"><Play size={16} /></button>
                    {/* FIX: Wrap the Flag icon in a span to apply the title attribute, as Lucide icons do not accept the title prop directly. */}
                    {selectedTask.isUrgent && <span title="Khẩn cấp"><Flag size={16} className="text-red-500" /></span>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); onToggleTask(selectedTask.id); closePopover(); }} className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white font-semibold py-1.5 px-3 rounded-md">
                   <CheckCircle2 size={14} />
                   <span>{selectedTask.status === 'completed' ? 'Mở lại' : 'Hoàn thành'}</span>
                </button>
            </div>
        </div>
      )}

      {expandedDay && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-40 animate-fadeIn">
            <div ref={dayModalRef} className="bg-[#1E293B] max-w-md w-full rounded-2xl shadow-2xl p-6 border border-slate-700 max-h-[70vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-lg font-bold text-white">
                        Công việc ngày {format(parseISO(expandedDay), 'dd MMMM, yyyy', { locale: vi })}
                    </h3>
                    <button onClick={() => setExpandedDay(null)} className="text-slate-400 hover:text-white"><X /></button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2">
                    {tasksByDate[expandedDay]?.map(task => (
                        <div key={task.id} className={`p-3 rounded-lg flex justify-between items-center gap-2 transition-colors ${task.status === 'completed' ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
                            <div>
                                <p className={`text-sm ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.text}</p>
                                {task.dueDate && (
                                    <div className="flex items-center text-xs text-slate-400 mt-1">
                                        <Clock size={12} className="mr-1.5" />
                                        <span>{format(parseISO(task.dueDate), "h:mm a", { locale: vi })}</span>
                                        {task.isUrgent && <Flag size={12} className="ml-3 text-red-500" />}
                                    </div>
                                )}
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1">
                                 <button 
                                    onClick={() => { onStartFocus(task); setExpandedDay(null); }} 
                                    className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-primary-400 disabled:opacity-50" 
                                    title="Bắt đầu tập trung"
                                    disabled={task.status === 'completed'}
                                 >
                                    <Play size={16} />
                                 </button>
                                 <button 
                                    onClick={() => onToggleTask(task.id)} 
                                    className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-green-500" 
                                    title={task.status === 'completed' ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                                >
                                    <CheckCircle2 size={16} className={task.status === 'completed' ? 'text-green-500' : ''} />
                                 </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
