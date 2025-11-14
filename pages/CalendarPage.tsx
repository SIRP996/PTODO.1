
import React, { useState, useMemo, useRef } from 'react';
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
  parseISO,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  isSameDay,
  getHours,
  getMinutes,
  set
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import Sidebar from '../components/Sidebar';
import { isPast } from 'date-fns';


interface CalendarPageProps {
  tasks: Task[];
  onUpdateTaskDueDate: (id: string, newDueDate: string | null) => void;
  onStartFocus: (task: Task) => void;
  onSwitchToMain: () => void;
}

type ViewMode = 'day' | 'week' | 'month';

const HOUR_HEIGHT = 50; // height in pixels for one hour

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

const CalendarPage: React.FC<CalendarPageProps> = ({ tasks, onUpdateTaskDueDate, onStartFocus, onSwitchToMain }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const { projects, addProject, deleteProject, updateProject } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  
  const allHashtags = useMemo(() => {
    const tags = new Set<string>();
    tasks.forEach(task => {
      task.hashtags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [tasks]);

  const hashtagStatuses = useMemo(() => {
    const statuses: { [key: string]: 'overdue' | 'pending' | 'completed' } = {};
    const tasksByTag: { [key:string]: Task[] } = {};

    tasks.forEach(task => {
      task.hashtags.forEach(tag => {
        if (!tasksByTag[tag]) tasksByTag[tag] = [];
        tasksByTag[tag].push(task);
      });
    });

    Object.keys(tasksByTag).forEach(tag => {
      const associatedTasks = tasksByTag[tag];
      if (associatedTasks.some(t => t.dueDate && t.status !== 'completed' && isPast(new Date(t.dueDate)))) {
        statuses[tag] = 'overdue';
      } else if (associatedTasks.some(t => t.status !== 'completed')) {
        statuses[tag] = 'pending';
      } else {
        statuses[tag] = 'completed';
      }
    });
    return statuses;
  }, [tasks]);


  const filteredTasks = useMemo(() => {
    let results = tasks;
    if (selectedProjectId) {
      results = results.filter(task => task.projectId === selectedProjectId);
    }
    if (activeHashtag) {
      results = results.filter(task => task.hashtags.includes(activeHashtag));
    }
    return results;
  }, [tasks, selectedProjectId, activeHashtag]);

  const tasksWithTime = useMemo(() => filteredTasks.filter(t => t.dueDate), [filteredTasks]);

  const { interval, headerText } = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return {
          interval: { start: currentDate, end: currentDate },
          headerText: format(currentDate, 'dd MMMM, yyyy', { locale: vi }),
        };
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1, locale: vi });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1, locale: vi });
        return {
          interval: { start: weekStart, end: weekEnd },
          headerText: `${format(weekStart, 'd MMM', { locale: vi })} - ${format(weekEnd, 'd MMM, yyyy', { locale: vi })}`,
        };
      case 'month':
      default:
        const monthStart = startOfMonth(currentDate);
        return {
          interval: { start: monthStart, end: endOfMonth(currentDate) },
          headerText: format(currentDate, 'MMMM yyyy', { locale: vi }),
        };
    }
  }, [currentDate, viewMode]);

  const navigate = (direction: number) => {
    if (viewMode === 'day') {
        setCurrentDate(d => direction > 0 ? addDays(d, 1) : subDays(d, 1));
    } else if (viewMode === 'week') {
        setCurrentDate(d => direction > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    } else {
        setCurrentDate(d => direction > 0 ? addMonths(d, 1) : subMonths(d, 1));
    }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };
  
  const handleDrop = (date: Date, hour: number, minute: number) => {
    if (!draggedTask) return;
    const newDate = set(date, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });
    onUpdateTaskDueDate(draggedTask.id, newDate.toISOString());
    setDraggedTask(null);
  };

  return (
    <div className="bg-[#0F172A] text-slate-100 h-screen flex flex-col">
        <header className="flex-shrink-0 p-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onSwitchToMain} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-2 px-4 rounded-lg transition-colors duration-200">
                    <ArrowLeft size={16} />
                    <span>Quay lại</span>
                </button>
                <div className="flex items-center gap-2">
                     <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-700 transition-colors"><ChevronLeft size={20} /></button>
                     <button onClick={() => setCurrentDate(new Date())} className="text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors border border-slate-600">Hôm nay</button>
                     <button onClick={() => navigate(1)} className="p-2 rounded-full hover:bg-slate-700 transition-colors"><ChevronRight size={20} /></button>
                </div>
                 <h2 className="text-xl font-bold text-white capitalize w-48 text-center sm:text-left">{headerText}</h2>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-800 border border-slate-700 rounded-lg">
                {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                            viewMode === mode ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        {mode === 'day' ? 'Ngày' : mode === 'week' ? 'Tuần' : 'Tháng'}
                    </button>
                ))}
            </div>
        </header>
      
        <div className="flex-grow flex overflow-hidden p-4 gap-4">
            <Sidebar
                tasks={tasks}
                projects={projects}
                onAddProject={addProject}
                onDeleteProject={deleteProject}
                onUpdateProject={updateProject}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                hashtags={allHashtags}
                activeHashtag={activeHashtag}
                onSelectHashtag={setActiveHashtag}
                hashtagStatuses={hashtagStatuses}
            />
            <main className="flex-grow flex flex-col overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl">
                {viewMode === 'month' && (
                    <MonthView currentDate={currentDate} tasks={tasksWithTime} onTaskClick={onStartFocus} />
                )}
                {(viewMode === 'week' || viewMode === 'day') && (
                    <TimeGridView 
                        key={viewMode + interval.start.toISOString()}
                        tasks={tasksWithTime}
                        interval={interval}
                        onDragStart={handleDragStart}
                        onDrop={handleDrop}
                        draggedTask={draggedTask}
                        onTaskClick={onStartFocus}
                    />
                )}
            </main>
        </div>
    </div>
  );
};

// --- TIME GRID VIEW (DAY/WEEK) ---

interface TimeGridViewProps {
    tasks: Task[];
    interval: { start: Date; end: Date };
    onDragStart: (task: Task) => void;
    onDrop: (date: Date, hour: number, minute: number) => void;
    draggedTask: Task | null;
    onTaskClick: (task: Task) => void;
}
const TimeGridView: React.FC<TimeGridViewProps> = ({ tasks, interval, onDragStart, onDrop, draggedTask, onTaskClick }) => {
    const days = eachDayOfInterval(interval);
    const containerRef = useRef<HTMLDivElement>(null);

    const { timedTasks, allDayTasks, taskLayouts } = useMemo(() => {
        const timed: Task[] = [];
        const allDay: Task[] = [];
        tasks.forEach(task => {
            if(!task.dueDate) return;
            const dueDate = parseISO(task.dueDate);
            if (getHours(dueDate) === 0 && getMinutes(dueDate) === 0) {
                allDay.push(task);
            } else {
                timed.push(task);
            }
        });

        // Calculate layout for overlapping timed events
        const layouts: { [key: string]: { top: number; height: number; left: number; width: number; task: Task }[] } = {};
        days.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const tasksOnDay = timed
                .filter(t => isSameDay(parseISO(t.dueDate!), day))
                .sort((a, b) => parseISO(a.dueDate!).getTime() - parseISO(b.dueDate!).getTime());
            
            const columns: Task[][] = [];
            tasksOnDay.forEach(task => {
                let placed = false;
                for (const col of columns) {
                    const lastTask = col[col.length - 1];
                    // Assume 1 hour duration
                    if (parseISO(lastTask.dueDate!).getTime() + 60*60*1000 <= parseISO(task.dueDate!).getTime()) {
                        col.push(task);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    columns.push([task]);
                }
            });

            layouts[dayKey] = [];
            columns.forEach((col, colIndex) => {
                col.forEach(task => {
                    const startTime = parseISO(task.dueDate!);
                    const top = (getHours(startTime) + getMinutes(startTime) / 60) * HOUR_HEIGHT;
                    layouts[dayKey].push({
                        task,
                        top,
                        height: HOUR_HEIGHT, // Assume 1 hour
                        left: (100 / columns.length) * colIndex,
                        width: 100 / columns.length,
                    });
                });
            });
        });

        return { timedTasks: timed, allDayTasks: allDay, taskLayouts: layouts };
    }, [tasks, days]);


    return (
        <div className="flex flex-col flex-grow overflow-hidden">
            {/* Day Headers */}
            <div className="flex flex-shrink-0">
                <div className="w-14 flex-shrink-0 border-r border-white/10"></div>
                <div className="grid flex-grow" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                    {days.map(day => (
                        <div key={day.toISOString()} className="text-center py-2 border-r border-white/10 last:border-r-0">
                            <span className="text-xs text-slate-400">{format(day, 'EEE', { locale: vi })}</span>
                            <p className={`text-2xl font-bold ${isToday(day) ? 'text-primary-400' : 'text-white'}`}>{format(day, 'd')}</p>
                        </div>
                    ))}
                </div>
            </div>
            {/* All Day Section */}
            <div className="flex flex-shrink-0 border-t border-b border-white/10">
                 <div className="w-14 text-xs font-semibold text-slate-400 flex-shrink-0 border-r border-white/10 flex items-center justify-center">Cả ngày</div>
                 <div className="grid flex-grow" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                    {days.map(day => {
                        const tasksForDay = allDayTasks.filter(t => isSameDay(parseISO(t.dueDate!), day));
                        return (
                             <div key={day.toISOString()} className="p-1 border-r border-white/10 last:border-r-0 min-h-[32px] space-y-1">
                                {tasksForDay.map(task => (
                                    <div key={task.id} 
                                        draggable
                                        onDragStart={() => onDragStart(task)}
                                        onClick={() => onTaskClick(task)}
                                        className={`text-xs p-1 rounded text-white truncate cursor-pointer ${getColorForTask(task.id)}`}
                                    >
                                        {task.text}
                                    </div>
                                ))}
                             </div>
                        )
                    })}
                </div>
            </div>

            {/* Main Grid */}
            <div ref={containerRef} className="flex-grow overflow-y-auto">
                <div className="flex h-full">
                    {/* Time Gutter */}
                    <div className="w-14 flex-shrink-0 -mt-3">
                        {Array.from({ length: 24 }).map((_, hour) => (
                            <div key={hour} style={{ height: `${HOUR_HEIGHT}px` }} className="text-right pr-2 text-xs text-slate-500 relative">
                                <span className="absolute -top-2 right-2">{format(new Date(2000, 0, 1, hour), 'ha', { locale: vi })}</span>
                            </div>
                        ))}
                    </div>
                    {/* Grid Content */}
                    <div className="grid flex-grow" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                        {days.map(day => {
                             const dayKey = format(day, 'yyyy-MM-dd');
                             const dayLayout = taskLayouts[dayKey] || [];
                             return (
                                <div key={day.toISOString()} className="relative border-r border-white/10 last:border-r-0">
                                    {Array.from({ length: 48 }).map((_, i) => ( // 30-min slots
                                        <div key={i}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={() => onDrop(day, Math.floor(i/2), (i % 2) * 30)}
                                            style={{ height: `${HOUR_HEIGHT / 2}px` }} 
                                            className={`border-t border-white/10 ${i%2 === 0 ? '' : 'border-dashed'}`}
                                        />
                                    ))}
                                    {dayLayout.map(({ task, top, height, left, width }) => (
                                        <div key={task.id}
                                            draggable
                                            onDragStart={() => onDragStart(task)}
                                            onClick={() => onTaskClick(task)}
                                            style={{ top: `${top}px`, height: `${height}px`, left: `${left}%`, width: `${width}%`}}
                                            className={`absolute p-2 rounded-lg text-white flex flex-col justify-between cursor-pointer transition-all duration-200 ${getColorForTask(task.id)} ${draggedTask?.id === task.id ? 'opacity-30' : ''}`}
                                        >
                                            <p className="font-bold text-xs leading-tight">{task.text}</p>
                                            <p className="text-xs opacity-80">{format(parseISO(task.dueDate!), 'h:mm a')}</p>
                                        </div>
                                    ))}
                                </div>
                             )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MONTH VIEW ---

interface MonthViewProps {
    currentDate: Date;
    tasks: Task[];
    onTaskClick: (task: Task) => void;
}
const MonthView: React.FC<MonthViewProps> = ({ currentDate, tasks, onTaskClick }) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { locale: vi, weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { locale: vi, weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    const tasksByDate = useMemo(() => {
        const grouped: { [key: string]: Task[] } = {};
        tasks.forEach(task => {
            if (task.dueDate) {
                const dateKey = format(parseISO(task.dueDate), 'yyyy-MM-dd');
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(task);
            }
        });
        return grouped;
    }, [tasks]);

    return (
        <div className="grid grid-cols-7 flex-grow">
            {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map(day => (
                <div key={day} className="text-center font-semibold text-slate-400 text-xs py-2 border-b border-r border-white/10">{day}</div>
            ))}
            {days.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const tasksForDay = tasksByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, currentDate);
                return (
                    <div key={day.toString()} className={`relative border-b border-r border-white/10 p-2 flex flex-col ${!isCurrentMonth ? 'bg-black/20' : ''}`}>
                        <span className={`font-semibold text-sm ${isToday(day) ? 'bg-primary-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>{format(day, 'd')}</span>
                        <div className="mt-1 space-y-1 overflow-y-auto flex-grow">
                            {tasksForDay.map(task => (
                                <button
                                    key={task.id}
                                    onClick={() => onTaskClick(task)}
                                    className={`w-full text-left text-xs p-1 rounded flex items-center gap-1.5 truncate text-white ${getColorForTask(task.id)}`}
                                >
                                   <span className="truncate">{task.text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};


export default CalendarPage;