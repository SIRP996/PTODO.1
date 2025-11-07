



import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTasks } from './hooks/useTasks';
import Header from './components/Header';
import RightSidebar from './components/RightSidebar';
import TaskInput from './components/TaskInput';
import TaskList from './components/TaskList';
import { BellRing, ShieldOff, Loader2, List, LayoutGrid, Bot, Clock } from 'lucide-react';
import { Task, TaskStatus, Project, Filter } from './types';
import { isPast, isToday, addDays, isWithinInterval, parseISO } from 'date-fns';
import FocusModeOverlay from './components/FocusModeOverlay';
import AuthPage from './components/auth/AuthPage';
import { useAuth } from './context/AuthContext';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import SettingsModal from './components/SettingsModal';
import LandingPage from './components/LandingPage';
import KanbanBoard from './components/KanbanBoard';
import ImportAssistantModal from './components/ImportAssistantModal';
import ChatAssistant from './components/ChatAssistant';
import GuestBanner from './components/GuestBanner';
import LogViewer from './components/LogViewer';
import CalendarPage from './pages/CalendarPage';
import { useProjects } from './hooks/useProjects';
import TimelineView from './components/TimelineView';
import { useTaskTemplates } from './hooks/useTaskTemplates';
import TemplateManagerModal from './components/TemplateManagerModal';
import WeeklyReviewModal from './components/WeeklyReviewModal';

const statusLabels: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  inprogress: 'Đang làm',
  completed: 'Hoàn thành',
};

const App: React.FC = () => {
  const { currentUser, logout, updateUserProfile, userSettings, updateUserSettings, loading, isGuestMode, exitGuestMode } = useAuth();
  
  const { 
    tasks, addTask, toggleTask, deleteTask, markReminderSent, updateTaskDueDate, toggleTaskUrgency,
    addSubtasksBatch, addTasksBatch, updateTaskText, updateTaskStatus, updateTaskNote, syncExistingTasksToCalendar,
  } = useTasks();

  const { projects } = useProjects();
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTaskTemplates();
  
  const [page, setPage] = useState<'main' | 'calendar'>('main');
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [view, setView] = useState<TaskStatus>('todo');
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState('default');
  const [searchTerm, setSearchTerm] = useState('');
  const [displayMode, setDisplayMode] = useState<'list' | 'kanban' | 'timeline'>('kanban');
  const [timelineDate, setTimelineDate] = useState(new Date());
  const [activeFilter, setActiveFilter] = useState<Filter>({ type: 'all' });
  const workerRef = useRef<Worker | null>(null);

  const [hasApiKey, setHasApiKey] = useState(false);
  const [isStudioEnv, setIsStudioEnv] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySkipped, setApiKeySkipped] = useState(() => sessionStorage.getItem('apiKeySkipped') === 'true');
  const [isUpdateKeyModalOpen, setUpdateKeyModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [isWeeklyReviewModalOpen, setWeeklyReviewModalOpen] = useState(false);

  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  
  const focusCompletionSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTguNzYuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);

  const notificationSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);

  const [taskListHeight, setTaskListHeight] = useState(600);
  const resizeData = useRef<{ initialY: number; initialHeight: number } | null>(null);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
      if (resizeData.current) {
          const deltaY = e.clientY - resizeData.current.initialY;
          const newHeight = resizeData.current.initialHeight + deltaY;
          setTaskListHeight(Math.max(300, Math.min(1200, newHeight)));
      }
  }, []);

  const handleResizeMouseUp = useCallback(() => {
      resizeData.current = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      resizeData.current = { initialY: e.clientY, initialHeight: taskListHeight };
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleResizeMouseMove);
      window.addEventListener('mouseup', handleResizeMouseUp);
  }, [taskListHeight, handleResizeMouseMove, handleResizeMouseUp]);

  useEffect(() => {
    if (isGuestMode) {
        setHasApiKey(false);
        localStorage.removeItem('active_genai_api_key');
        return;
    }
    setApiKeyError(null);
    localStorage.removeItem('active_genai_api_key');
    if ((window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
        setIsStudioEnv(true);
        (async () => {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (hasKey && process.env.API_KEY) localStorage.setItem('active_genai_api_key', process.env.API_KEY);
            setHasApiKey(hasKey);
        })();
        return;
    }
    setIsStudioEnv(false);
    if (userSettings) {
        const storedKey = userSettings.apiKey;
        if (storedKey) {
            localStorage.setItem('active_genai_api_key', storedKey);
            setHasApiKey(true);
        } else {
            setHasApiKey(false);
        }
    }
  }, [userSettings, isGuestMode]);
  
  useEffect(() => { document.body.dataset.theme = userSettings?.theme || 'default'; }, [userSettings?.theme]);
  useEffect(() => { if (!currentUser) localStorage.removeItem('active_genai_api_key'); }, [currentUser]);

  const handleSelectStudioKey = async () => {
    setApiKeyError(null);
    if ((window as any).aistudio?.openSelectKey) {
        try {
            await (window as any).aistudio.openSelectKey();
            setHasApiKey(true);
            if (process.env.API_KEY) localStorage.setItem('active_genai_api_key', process.env.API_KEY);
            setApiKeySkipped(false);
            sessionStorage.removeItem('apiKeySkipped');
            setUpdateKeyModalOpen(false);
        } catch (e) { setApiKeyError("Không thể mở hộp thoại chọn API Key."); }
    } else { setApiKeyError("Chức năng chọn key không tồn tại."); }
  };
    
  const handleSaveManualKey = async (key: string) => {
    if (!currentUser || !updateUserSettings) return;
    try {
        await updateUserSettings({ apiKey: key });
        localStorage.setItem('active_genai_api_key', key);
        setApiKeySkipped(false);
        sessionStorage.removeItem('apiKeySkipped');
        setUpdateKeyModalOpen(false);
    } catch (e) { setApiKeyError("Không thể lưu API Key."); }
  };
    
  const onApiKeyError = useCallback(async () => {
    if (!isStudioEnv && currentUser && updateUserSettings) await updateUserSettings({ apiKey: '' });
    localStorage.removeItem('active_genai_api_key');
    setApiKeyError("API Key của bạn không hợp lệ hoặc đã hết hạn.");
  }, [isStudioEnv, currentUser, updateUserSettings]);

  const handleSkip = () => { sessionStorage.setItem('apiKeySkipped', 'true'); setApiKeySkipped(true); };

  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = window.setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
      focusCompletionSound?.play();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning, timeLeft, focusCompletionSound]);

  const handleStartFocus = (task: Task) => {
    setFocusTask(task);
    setIsFocusModeActive(true);
    setIsTimerRunning(true);
    setTimeLeft(25 * 60);
  };
  
  const handleStopFocus = () => {
    setIsFocusModeActive(false);
    setIsTimerRunning(false);
    setFocusTask(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };
  
  const handleToggleTimer = () => setIsTimerRunning(prev => !prev);
  
  const handleMarkFocusTaskDone = () => {
    if (focusTask) toggleTask(focusTask.id);
    handleStopFocus();
  };

  useEffect(() => {
    if ('Notification' in window) setNotificationPermissionStatus(Notification.permission);
    const workerCode = `
      let tasks = [];
      const CHECK_INTERVAL = 5000;
      setInterval(() => {
        const now = new Date();
        tasks.forEach(task => {
          if (task.status !== 'completed' && !task.reminderSent && task.dueDate && new Date(task.dueDate) < now) {
            self.postMessage(task);
          }
        });
      }, CHECK_INTERVAL);
      self.onmessage = (event) => { tasks = event.data; };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl);
    workerRef.current.onmessage = (event: MessageEvent<Task>) => {
      const overdueTask = event.data;
      if (Notification.permission === 'granted') {
          const notificationBody = overdueTask.hashtags.length > 0
            ? `${overdueTask.text}\n${overdueTask.hashtags.map(tag => `#${tag}`).join(' ')}`
            : overdueTask.text;
          new Notification('Công việc quá hạn!', { body: notificationBody, icon: '/vite.svg' });
          notificationSound?.play().catch(e => console.error("Error playing sound:", e));
          markReminderSent(overdueTask.id);
      }
    };
    return () => { workerRef.current?.terminate(); URL.revokeObjectURL(workerUrl); };
  }, [markReminderSent, notificationSound]);

  useEffect(() => { workerRef.current?.postMessage(tasks); }, [tasks]);

  const handleRequestPermission = useCallback(async () => {
    if (notificationSound) { try { await notificationSound.play(); notificationSound.pause(); notificationSound.currentTime = 0; } catch (e) { console.warn("Could not unlock audio context:", e); } }
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermissionStatus(permission);
  }, [notificationSound]);

  const filteredTasks = useMemo(() => {
    let results: Task[] = tasks;

    if (activeFilter.type === 'project' && activeFilter.id) {
        results = tasks.filter(task => task.projectId === activeFilter.id);
    } else if (activeFilter.type === 'today') {
        results = tasks.filter(task => task.dueDate && isToday(parseISO(task.dueDate)));
    } else if (activeFilter.type === 'next7days') {
        const today = new Date();
        const nextWeek = addDays(today, 7);
        results = tasks.filter(task => task.dueDate && isWithinInterval(parseISO(task.dueDate), { start: today, end: nextWeek }));
    } else if (activeFilter.type === 'urgent') {
        results = tasks.filter(task => task.isUrgent && task.status !== 'completed');
    }

    if (searchTerm) {
        results = results.filter(task => task.text.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return results;
  }, [tasks, searchTerm, activeFilter]);

  const parentTasks = useMemo(() => filteredTasks.filter(t => !t.parentId), [filteredTasks]);

  const taskCounts = useMemo(() => {
    return parentTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
    }, { todo: 0, inprogress: 0, completed: 0 } as Record<TaskStatus, number>);
  }, [parentTasks]);

  const subtasksByParentId = useMemo(() => {
    const subtasksMap: { [key: string]: Task[] } = {};
    tasks.forEach(task => {
        if (task.parentId) {
            if (!subtasksMap[task.parentId]) subtasksMap[task.parentId] = [];
            subtasksMap[task.parentId].push(task);
        }
    });
    return subtasksMap;
  }, [tasks]);

  const tasksForList = useMemo(() => {
    const parentsInView = parentTasks.filter(t => t.status === view);
    const parentIdsInView = new Set(parentsInView.map(t => t.id));
    const subtasksForParentsInView = tasks.filter(t => t.parentId && parentIdsInView.has(t.parentId));
    return [...parentsInView, ...subtasksForParentsInView];
  }, [parentTasks, tasks, view]);

  const handleNavigateToAuth = () => { exitGuestMode(); setShowAuthPage(true); };

  if (loading) { return <div className="min-h-screen bg-[#0F172A] flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary-500" /></div>; }
  if (!currentUser && !isGuestMode) {
      if (showAuthPage) return <AuthPage />;
      return <LandingPage onNavigateToAuth={() => setShowAuthPage(true)} />;
  }
  if (currentUser && !hasApiKey && !apiKeySkipped) {
      return <ApiKeyPrompt isStudioEnv={isStudioEnv} onSelectKey={handleSelectStudioKey} onSaveManualKey={handleSaveManualKey} onSkip={handleSkip} error={apiKeyError} />;
  }
  if (page === 'calendar') {
    return <CalendarPage tasks={tasks} onStartFocus={handleStartFocus} onUpdateTaskDueDate={updateTaskDueDate} onSwitchToMain={() => setPage('main')} />;
  }

  return (
    <>
      <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
      {isFocusModeActive && focusTask && <FocusModeOverlay task={focusTask} timeLeft={timeLeft} isTimerRunning={isTimerRunning} onToggleTimer={handleToggleTimer} onStop={handleStopFocus} onComplete={handleMarkFocusTaskDone} />}
      {isSettingsModalOpen && currentUser && <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} user={currentUser} onUpdateProfile={updateUserProfile} syncExistingTasksToCalendar={syncExistingTasksToCalendar} />}
      {isUpdateKeyModalOpen && currentUser && <ApiKeyPrompt isStudioEnv={isStudioEnv} onSelectKey={handleSelectStudioKey} onSaveManualKey={handleSaveManualKey} error={apiKeyError} isModal={true} onClose={() => setUpdateKeyModalOpen(false)} />}
      {isImportModalOpen && currentUser && hasApiKey && <ImportAssistantModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onAddTasksBatch={addTasksBatch} onApiKeyError={onApiKeyError} />}
      {isTemplateManagerOpen && currentUser && <TemplateManagerModal isOpen={isTemplateManagerOpen} onClose={() => setIsTemplateManagerOpen(false)} templates={templates} onAddTemplate={addTemplate} onUpdateTemplate={updateTemplate} onDeleteTemplate={deleteTemplate} />}
      {isWeeklyReviewModalOpen && currentUser && hasApiKey && <WeeklyReviewModal isOpen={isWeeklyReviewModalOpen} onClose={() => setWeeklyReviewModalOpen(false)} tasks={tasks} onApiKeyError={onApiKeyError} />}
      {hasApiKey && currentUser && <ChatAssistant isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} tasks={tasks} onAddTask={addTask} onApiKeyError={onApiKeyError} userAvatarUrl={userSettings?.avatarUrl || currentUser?.photoURL || undefined} />}

      <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans flex flex-col">
          <div className="max-w-screen-2xl mx-auto w-full flex-grow">
            <div className="p-4 sm:p-6 lg:p-8">
                {isGuestMode && <GuestBanner onSignUp={handleNavigateToAuth} />}
                <Header 
                  onSwitchToCalendar={() => setPage('calendar')} 
                  onToggleZenMode={() => setIsZenMode(prev => !prev)}
                  isZenMode={isZenMode}
                />
            </div>
            
            <main className="px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-4 gap-8 h-full transition-all duration-300">
              <div className={`space-y-6 transition-all duration-300 ${isZenMode ? 'lg:col-span-4' : 'lg:col-span-3'}`}>
                <div className="bg-slate-800/50 p-6 rounded-2xl">
                  <TaskInput onAddTask={addTask} onApiKeyError={onApiKeyError} hasApiKey={hasApiKey} onOpenImportModal={() => setIsImportModalOpen(true)} projects={projects} selectedProjectId={activeFilter.type === 'project' ? activeFilter.id : null} templates={templates} onAddSubtasksBatch={addSubtasksBatch} />
                </div>
                
                <div className="bg-slate-800/50 p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-700 rounded-lg">
                          <button onClick={() => setDisplayMode('kanban')} className={`px-3 py-1 text-sm font-medium rounded-md flex items-center gap-2 ${displayMode === 'kanban' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><LayoutGrid size={16} /><span>Bảng</span></button>
                          <button onClick={() => setDisplayMode('list')} className={`px-3 py-1 text-sm font-medium rounded-md flex items-center gap-2 ${displayMode === 'list' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><List size={16} /><span>Danh sách</span></button>
                          <button onClick={() => setDisplayMode('timeline')} className={`px-3 py-1 text-sm font-medium rounded-md flex items-center gap-2 ${displayMode === 'timeline' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}><Clock size={16} /><span>Dòng thời gian</span></button>
                      </div>
                       {displayMode === 'list' && (
                          <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-700 rounded-lg">
                              {(['todo', 'inprogress', 'completed'] as TaskStatus[]).map(status => (
                                  <button key={status} onClick={() => setView(status)} className={`px-3 py-1 text-sm rounded-md ${view === status ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>{`${statusLabels[status]} (${taskCounts[status]})`}</button>
                              ))}
                          </div>
                       )}
                  </div>
                  
                  {displayMode === 'timeline' ? (
                     <TimelineView
                        tasks={tasks}
                        currentDate={timelineDate}
                        onDateChange={setTimelineDate}
                        onStartFocus={handleStartFocus}
                        onUpdateTaskDueDate={updateTaskDueDate}
                    />
                  ) : displayMode === 'list' ? (
                    <div style={{ position: 'relative' }}>
                      <div className="overflow-y-auto pr-2" style={{ height: `${taskListHeight}px` }}>
                          <TaskList tasks={tasksForList} onToggleTask={toggleTask} onDeleteTask={deleteTask} onUpdateTaskDueDate={updateTaskDueDate} onToggleTaskUrgency={toggleTaskUrgency} onStartFocus={handleStartFocus} onAddSubtasksBatch={addSubtasksBatch} onApiKeyError={onApiKeyError} hasApiKey={hasApiKey} onUpdateTaskText={updateTaskText} onUpdateTaskStatus={updateTaskStatus} onUpdateTaskNote={updateTaskNote} />
                      </div>
                       <div onMouseDown={handleResizeMouseDown} className="absolute bottom-0 right-0 w-6 h-6 cursor-ns-resize flex items-center justify-center group" title="Kéo để thay đổi kích thước"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-600 group-hover:text-slate-400 transition-colors"><path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 8L8 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
                    </div>
                  ) : (
                    <KanbanBoard tasks={parentTasks} subtasksByParentId={subtasksByParentId} onUpdateTaskStatus={updateTaskStatus} toggleTaskUrgency={toggleTaskUrgency} onDeleteTask={deleteTask} onStartFocus={handleStartFocus} onToggleTask={toggleTask} onUpdateTaskNote={updateTaskNote} />
                  )}
                </div>
              </div>

              <div className={`lg:col-span-1 transition-all duration-300 ${isZenMode ? 'hidden' : 'block'}`}>
                  <RightSidebar 
                    user={currentUser}
                    tasks={tasks}
                    projects={projects}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                    onLogout={logout}
                    hasApiKey={hasApiKey}
                    onManageApiKey={() => setUpdateKeyModalOpen(true)}
                    onOpenSettings={() => setSettingsModalOpen(true)}
                    onToggleLogViewer={() => setIsLogViewerOpen(prev => !prev)}
                    onOpenTemplateManager={() => setIsTemplateManagerOpen(true)}
                    onOpenWeeklyReview={() => setWeeklyReviewModalOpen(true)}
                    notificationPermissionStatus={notificationPermissionStatus}
                    onRequestNotificationPermission={handleRequestPermission}
                  />
              </div>
            </main>
          </div>
          {hasApiKey && currentUser && <button onClick={() => setIsChatOpen(true)} className="fixed bottom-6 right-6 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg z-40 transition-transform hover:scale-110" title="Mở Trợ lý AI"><Bot size={24} /></button>}
      </div>
    </>
  );
};

export default App;