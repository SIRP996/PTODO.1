

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTasks } from './hooks/useTasks';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AdvancedDashboard from './components/AdvancedDashboard';
import TaskInput from './components/TaskInput';
import FilterTags from './components/FilterTags';
import TaskList from './components/TaskList';
import { BellRing, ShieldCheck, ShieldOff, Loader2, List, LayoutGrid, Bot, Calendar } from 'lucide-react';
import { Task, TaskStatus } from './types';
import { isPast } from 'date-fns';
import GoogleSheetSync from './components/GoogleSheetSync';
import FocusModeOverlay from './components/FocusModeOverlay';
import AuthPage from './components/auth/AuthPage';
import { useAuth } from './context/AuthContext';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import SettingsModal from './components/SettingsModal';
import LandingPage from './components/LandingPage';
import SearchBar from './components/SearchBar';
import KanbanBoard from './components/KanbanBoard';
import ImportAssistantModal from './components/ImportAssistantModal';
import ChatAssistant from './components/ChatAssistant';
import GuestBanner from './components/GuestBanner';
import CalendarView from './components/CalendarView';

const statusLabels: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  inprogress: 'Đang làm',
  completed: 'Hoàn thành',
};

const App: React.FC = () => {
  const { currentUser, logout, updateUserProfile, userSettings, updateUserSettings, loading, isGuestMode, exitGuestMode } = useAuth();
  
  const { 
    tasks, 
    addTask, 
    toggleTask, 
    deleteTask,
    markReminderSent,
    updateTaskDueDate,
    toggleTaskUrgency,
    addSubtasksBatch,
    addTasksBatch,
    updateTaskText,
    updateTaskStatus,
    updateTaskNote,
  } = useTasks();
  
  // State to control view before login
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [view, setView] = useState<TaskStatus>('todo');
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState('default');
  const [searchTerm, setSearchTerm] = useState('');
  const [displayMode, setDisplayMode] = useState<'list' | 'kanban' | 'calendar'>('kanban');
  const workerRef = useRef<Worker | null>(null);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isStudioEnv, setIsStudioEnv] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySkipped, setApiKeySkipped] = useState(() => sessionStorage.getItem('apiKeySkipped') === 'true');
  const [isUpdateKeyModalOpen, setUpdateKeyModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Settings Modal State
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);

  // Chat Assistant State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Focus Mode State
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  // Fix: Use `number` for timer ID in browser environments instead of `NodeJS.Timeout`.
  const timerRef = useRef<number | null>(null);
  
  const focusCompletionSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTguNzYuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);

  const notificationSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);

  // Vertical Resizing State
  const [taskListHeight, setTaskListHeight] = useState(600);
  const resizeData = useRef<{ initialY: number; initialHeight: number } | null>(null);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
      if (resizeData.current) {
          const deltaY = e.clientY - resizeData.current.initialY;
          const newHeight = resizeData.current.initialHeight + deltaY;
          setTaskListHeight(Math.max(300, Math.min(1200, newHeight))); // Min 300px, Max 1200px
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
      resizeData.current = {
          initialY: e.clientY,
          initialHeight: taskListHeight,
      };
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
    localStorage.removeItem('active_genai_api_key'); // This is used by the gemini util

    // Handle AI Studio environment separately as it's session-based
    if ((window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
        setIsStudioEnv(true);
        (async () => {
            try {
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                if (hasKey && process.env.API_KEY) {
                    localStorage.setItem('active_genai_api_key', process.env.API_KEY);
                }
                setHasApiKey(hasKey);
            } catch (e) {
                console.error("Error checking AI Studio key:", e);
                setHasApiKey(false);
            }
        })();
        return;
    }

    // Handle standard environment with Firestore-backed keys
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
  
  useEffect(() => {
    // Apply theme from user settings
    document.body.dataset.theme = userSettings?.theme || 'default';
  }, [userSettings?.theme]);

  useEffect(() => {
    // Clean up active key on logout
    if (!currentUser) {
        localStorage.removeItem('active_genai_api_key');
    }
  }, [currentUser]);

  const handleSelectStudioKey = async () => {
    setApiKeyError(null);
    if ((window as any).aistudio && typeof (window as any).aistudio.openSelectKey === 'function') {
        try {
            await (window as any).aistudio.openSelectKey();
            setHasApiKey(true);
            if (process.env.API_KEY) {
                localStorage.setItem('active_genai_api_key', process.env.API_KEY);
            }
            setApiKeySkipped(false);
            sessionStorage.removeItem('apiKeySkipped');
            setUpdateKeyModalOpen(false);
        } catch (e) {
            console.error("Could not open API key selection:", e);
            setApiKeyError("Không thể mở hộp thoại chọn API Key. Vui lòng thử làm mới trang.");
        }
    } else {
        setApiKeyError("Lỗi không mong đợi: Chức năng chọn key không tồn tại.");
    }
  };
    
  const handleSaveManualKey = async (key: string) => {
    if (!currentUser || !updateUserSettings) return;
    try {
        await updateUserSettings({ apiKey: key });
        // The UI will update reactively from the Firestore listener in AuthContext
        localStorage.setItem('active_genai_api_key', key);
        setApiKeySkipped(false);
        sessionStorage.removeItem('apiKeySkipped');
        setUpdateKeyModalOpen(false);
    } catch (e) {
        console.error("Failed to save API key:", e);
        setApiKeyError("Không thể lưu API Key của bạn. Vui lòng thử lại.");
    }
  };
    
  const onApiKeyError = useCallback(async () => {
    if (!isStudioEnv && currentUser && updateUserSettings) {
        await updateUserSettings({ apiKey: '' });
    }
    localStorage.removeItem('active_genai_api_key');
    // hasApiKey state will be updated reactively by the useEffect hook watching userSettings
    setApiKeyError("API Key của bạn không hợp lệ hoặc đã hết hạn. Vui lòng chọn lại hoặc nhập một key mới.");
  }, [isStudioEnv, currentUser, updateUserSettings]);

  const handleSkip = () => {
    sessionStorage.setItem('apiKeySkipped', 'true');
    setApiKeySkipped(true);
  };

  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsTimerRunning(false);
      focusCompletionSound?.play();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
    if (focusTask) {
        toggleTask(focusTask.id);
    }
    handleStopFocus();
  };

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermissionStatus(Notification.permission);
    }

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

    return () => {
      workerRef.current?.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, [markReminderSent, notificationSound]);

  useEffect(() => {
    workerRef.current?.postMessage(tasks);
  }, [tasks]);

  const handleRequestPermission = useCallback(async () => {
    if (notificationSound) {
        try {
            await notificationSound.play();
            notificationSound.pause();
            notificationSound.currentTime = 0;
        } catch (e) {
            console.warn("Could not unlock audio context:", e);
        }
    }
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        setNotificationPermissionStatus(permission);
    } else if (Notification.permission === 'granted') {
        setNotificationPermissionStatus('granted');
    }
  }, [notificationSound]);

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

  const allHashtags = useMemo(() => {
    const tags = new Set<string>();
    tasks.forEach(task => {
      task.hashtags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let results = tasks;
    if (activeHashtag) {
      results = results.filter(task => task.hashtags.includes(activeHashtag));
    }
    if (searchTerm) {
      results = results.filter(task => task.text.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return results;
  }, [tasks, activeHashtag, searchTerm]);

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
            if (!subtasksMap[task.parentId]) {
                subtasksMap[task.parentId] = [];
            }
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

  const handleNavigateToAuth = () => {
    exitGuestMode();
    setShowAuthPage(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary-500" />
      </div>
    );
  }
  
  if (!currentUser && !isGuestMode) {
      if (showAuthPage) {
        return <AuthPage />;
      }
      return <LandingPage onNavigateToAuth={() => setShowAuthPage(true)} />;
  }

  if (currentUser && !hasApiKey && !apiKeySkipped) {
      return <ApiKeyPrompt 
          isStudioEnv={isStudioEnv}
          onSelectKey={handleSelectStudioKey}
          onSaveManualKey={handleSaveManualKey}
          onSkip={handleSkip}
          error={apiKeyError}
      />;
  }

  return (
    <>
      {isFocusModeActive && focusTask && (
        <FocusModeOverlay 
          task={focusTask}
          timeLeft={timeLeft}
          isTimerRunning={isTimerRunning}
          onToggleTimer={handleToggleTimer}
          onStop={handleStopFocus}
          onComplete={handleMarkFocusTaskDone}
        />
      )}
      {isSettingsModalOpen && currentUser && (
        <SettingsModal 
          isOpen={isSettingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          user={currentUser}
          onUpdateProfile={updateUserProfile}
        />
      )}
      {isUpdateKeyModalOpen && currentUser && (
          <ApiKeyPrompt 
              isStudioEnv={isStudioEnv}
              onSelectKey={handleSelectStudioKey}
              onSaveManualKey={handleSaveManualKey}
              error={apiKeyError}
              isModal={true}
              onClose={() => setUpdateKeyModalOpen(false)}
          />
      )}
      {isImportModalOpen && currentUser && hasApiKey && (
        <ImportAssistantModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onAddTasksBatch={addTasksBatch}
          onApiKeyError={onApiKeyError}
        />
      )}
      
      {hasApiKey && currentUser && (
        <ChatAssistant
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          tasks={tasks}
          onAddTask={addTask}
          onApiKeyError={onApiKeyError}
          userAvatarUrl={userSettings?.avatarUrl || currentUser?.photoURL || undefined}
        />
      )}

      <div className="min-h-screen bg-[#0F172A] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
        <div className="max-w-7xl mx-auto">
          {isGuestMode && <GuestBanner onSignUp={handleNavigateToAuth} />}
          <Header
            tasks={tasks}
            user={currentUser}
            onLogout={logout}
            hasApiKey={hasApiKey}
            onManageApiKey={() => setUpdateKeyModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
          />

          <main className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-800/50 p-6 rounded-2xl">
                <TaskInput 
                  onAddTask={addTask} 
                  onApiKeyError={onApiKeyError}
                  hasApiKey={hasApiKey}
                  onOpenImportModal={() => setIsImportModalOpen(true)}
                />
              </div>
              
              <div className="bg-slate-800/50 p-6 rounded-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div className="flex-grow w-full sm:w-auto">
                    <FilterTags 
                      hashtags={allHashtags} 
                      activeHashtag={activeHashtag} 
                      onSelectHashtag={setActiveHashtag}
                      hashtagStatuses={hashtagStatuses}
                    />
                  </div>
                  <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
                </div>
                
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-700 rounded-lg">
                        <button
                          onClick={() => setDisplayMode('kanban')}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                            displayMode === 'kanban' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <LayoutGrid size={16} />
                          <span>Bảng</span>
                        </button>
                        <button
                          onClick={() => setDisplayMode('list')}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                            displayMode === 'list' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <List size={16} />
                          <span>Danh sách</span>
                        </button>
                        <button
                          onClick={() => setDisplayMode('calendar')}
                          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                            displayMode === 'calendar' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          <Calendar size={16} />
                          <span>Lịch</span>
                        </button>
                    </div>
                     {displayMode === 'list' && (
                        <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-700 rounded-lg">
                            {(['todo', 'inprogress', 'completed'] as TaskStatus[]).map(status => (
                                <button
                                    key={status}
                                    onClick={() => setView(status)}
                                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                                        view === status ? 'bg-primary-600 text-white' : 'text-slate-400 hover:bg-slate-700'
                                    }`}
                                >
                                    {`${statusLabels[status]} (${taskCounts[status]})`}
                                </button>
                            ))}
                        </div>
                     )}
                </div>
                
                {displayMode === 'list' ? (
                  <div style={{ height: `${taskListHeight}px`, position: 'relative' }}>
                    <div className="overflow-y-auto h-full pr-2">
                        <TaskList
                          tasks={tasksForList}
                          onToggleTask={toggleTask}
                          onDeleteTask={deleteTask}
                          onUpdateTaskDueDate={updateTaskDueDate}
                          onToggleTaskUrgency={toggleTaskUrgency}
                          onStartFocus={handleStartFocus}
                          onAddSubtasksBatch={addSubtasksBatch}
                          onApiKeyError={onApiKeyError}
                          hasApiKey={hasApiKey}
                          onUpdateTaskText={updateTaskText}
                          onUpdateTaskStatus={updateTaskStatus}
                          onUpdateTaskNote={updateTaskNote}
                        />
                    </div>
                     <div 
                        onMouseDown={handleResizeMouseDown}
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-ns-resize flex items-center justify-center group"
                        title="Kéo để thay đổi kích thước"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-600 group-hover:text-slate-400 transition-colors">
                          <path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M12 8L8 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                  </div>
                ) : displayMode === 'kanban' ? (
                  <KanbanBoard 
                    tasks={parentTasks}
                    subtasksByParentId={subtasksByParentId}
                    onUpdateTaskStatus={updateTaskStatus}
                    // Fix: Changed onToggleTaskUrgency to toggleTaskUrgency to match the function from the useTasks hook.
                    toggleTaskUrgency={toggleTaskUrgency}
                    onDeleteTask={deleteTask}
                    onStartFocus={handleStartFocus}
                    onToggleTask={toggleTask}
                    onUpdateTaskNote={updateTaskNote}
                  />
                ) : (
                   <CalendarView 
                    tasks={tasks} 
                    onToggleTask={toggleTask} 
                    onUpdateTaskDueDate={updateTaskDueDate} 
                    onStartFocus={handleStartFocus} 
                   />
                )}
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-800/50 p-6 rounded-2xl">
                <h2 className="text-xl font-semibold mb-4 text-slate-100">Bảng điều khiển</h2>
                <Dashboard tasks={tasks} />
              </div>
              <div className="bg-slate-800/50 p-6 rounded-2xl">
                <AdvancedDashboard tasks={tasks} />
              </div>
              <div className="bg-slate-800/50 p-6 rounded-2xl">
                <GoogleSheetSync tasks={tasks} />
              </div>
              
              {notificationPermissionStatus === 'denied' && (
                <div className="bg-red-900/50 p-4 rounded-2xl border border-red-700 flex items-start gap-3">
                  <ShieldOff size={24} className="text-red-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-red-300">Thông báo đã bị chặn</h4>
                    <p className="text-sm text-red-300/80">Bạn đã chặn thông báo. Vui lòng bật lại trong cài đặt trình duyệt để nhận nhắc nhở.</p>
                  </div>
                </div>
              )}
      
              <div className="bg-primary-900/30 p-4 rounded-2xl border border-primary-700/50 flex items-start gap-3">
                  <BellRing size={24} className="text-primary-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-primary-300">Nhắc nhở thông minh</h4>
                    <p className="text-sm text-primary-300/80">Khi được cho phép, bạn sẽ nhận được thông báo và âm thanh cho các công việc quá hạn.</p>
                     {notificationPermissionStatus === 'default' && (
                       <button onClick={handleRequestPermission} className="mt-2 text-xs bg-primary-600 text-white font-semibold py-1 px-2 rounded-md hover:bg-primary-700">
                          Cho phép thông báo
                       </button>
                     )}
                  </div>
              </div>

            </div>
          </main>
        </div>
      </div>
      
      {hasApiKey && currentUser && (
        <button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-6 right-6 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg z-40 transition-transform hover:scale-110"
            title="Mở Trợ lý AI"
            aria-label="Mở Trợ lý AI"
        >
            <Bot size={24} />
        </button>
      )}

    </>
  );
};

export default App;