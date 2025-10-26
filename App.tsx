

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTasks } from './hooks/useTasks';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AdvancedDashboard from './components/AdvancedDashboard';
import TaskInput from './components/TaskInput';
import FilterTags from './components/FilterTags';
import TaskList from './components/TaskList';
import { BellRing, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { Task } from './types';
import { isPast } from 'date-fns';
import GoogleSheetSync from './components/GoogleSheetSync';
import FocusModeOverlay from './components/FocusModeOverlay';
import AuthPage from './components/auth/AuthPage';
import { useAuth } from './context/AuthContext';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import SettingsModal from './components/SettingsModal';
import LandingPage from './components/LandingPage';
import SearchBar from './components/SearchBar';

const App: React.FC = () => {
  const { currentUser, logout, updateUserProfile, userSettings, updateUserSettings, loading } = useAuth();
  
  const { 
    tasks, 
    addTask, 
    toggleTask, 
    deleteTask,
    markReminderSent,
    updateTaskDueDate,
    toggleTaskUrgency,
    addSubtasksBatch,
    updateTaskText,
  } = useTasks();
  
  // State to control view before login
  const [showAuthPage, setShowAuthPage] = useState(false);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [view, setView] = useState<'incomplete' | 'completed'>('incomplete');
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState('default');
  const [searchTerm, setSearchTerm] = useState('');
  const workerRef = useRef<Worker | null>(null);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isStudioEnv, setIsStudioEnv] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeySkipped, setApiKeySkipped] = useState(() => sessionStorage.getItem('apiKeySkipped') === 'true');
  const [isUpdateKeyModalOpen, setUpdateKeyModalOpen] = useState(false);

  // Settings Modal State
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);

  // Focus Mode State
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  // Fix: Use `number` for timer ID in browser environments instead of `NodeJS.Timeout`.
  const timerRef = useRef<number | null>(null);
  
  const focusCompletionSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTguNzYuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);

  const notificationSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);

  useEffect(() => {
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
  }, [userSettings]);
  
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
          if (!task.completed && !task.reminderSent && task.dueDate && new Date(task.dueDate) < now) {
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
      if (associatedTasks.some(t => t.dueDate && !t.completed && isPast(new Date(t.dueDate)))) {
        statuses[tag] = 'overdue';
      } else if (associatedTasks.some(t => !t.completed)) {
        statuses[tag] = 'pending';
      } else {
        statuses[tag] = 'completed';
      }
    });
    return statuses;
  }, [tasks]);

  const handleSelectHashtag = useCallback((hashtag: string | null) => {
    setActiveHashtag(hashtag);
    if (hashtag) {
      const status = hashtagStatuses[hashtag];
      if (status === 'overdue' || status === 'pending') {
        setView('incomplete');
      } else if (status === 'completed') {
        setView('completed');
      }
    }
  }, [hashtagStatuses]);

  // --- START: Refactored Task Filtering and Counting Logic ---
  const parentTasks = useMemo(() => tasks.filter(task => !task.parentId), [tasks]);

  const subtasksByParentId = useMemo(() => {
    return tasks.reduce((acc, task) => {
      if (task.parentId) {
        if (!acc[task.parentId]) {
          acc[task.parentId] = [];
        }
        acc[task.parentId].push(task);
      }
      return acc;
    }, {} as { [key: string]: Task[] });
  }, [tasks]);

  const filteredParentTasks = useMemo(() => {
    let parents = parentTasks;

    // 1. Filter by active hashtag
    if (activeHashtag) {
        parents = parents.filter(p =>
            p.hashtags.includes(activeHashtag) ||
            (subtasksByParentId[p.id] || []).some(s => s.hashtags.includes(activeHashtag))
        );
    }

    // 2. Filter by search term
    if (searchTerm.trim()) {
        const lowercasedSearchTerm = searchTerm.trim().toLowerCase();
        parents = parents.filter(p =>
            p.text.toLowerCase().includes(lowercasedSearchTerm) ||
            (subtasksByParentId[p.id] || []).some(s => s.text.toLowerCase().includes(lowercasedSearchTerm))
        );
    }
    
    return parents;
  }, [parentTasks, subtasksByParentId, activeHashtag, searchTerm]);

  const incompleteCount = useMemo(() => filteredParentTasks.filter(t => !t.completed).length, [filteredParentTasks]);
  const completedCount = useMemo(() => filteredParentTasks.filter(t => t.completed).length, [filteredParentTasks]);

  const filteredTasks = useMemo(() => {
    const viewFilteredParents = filteredParentTasks.filter(p => view === 'completed' ? p.completed : !p.completed);

    const tasksToShow: Task[] = [];
    viewFilteredParents.forEach(parent => {
      tasksToShow.push(parent);
      if (subtasksByParentId[parent.id]) {
        tasksToShow.push(...subtasksByParentId[parent.id]);
      }
    });
    return tasksToShow;
  }, [filteredParentTasks, subtasksByParentId, view]);
  
  const allHashtags = useMemo(() => Array.from(new Set(tasks.flatMap(task => task.hashtags.map(tag => tag.toLowerCase())))), [tasks]);
  // --- END: Refactored Task Filtering and Counting Logic ---

  if (!currentUser) {
    if (!showAuthPage) {
      return <LandingPage onNavigateToAuth={() => setShowAuthPage(true)} />;
    }
    return <AuthPage />;
  }

  if (loading) {
    return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-indigo-400 animate-spin" />
        </div>
    );
  }

  if (!hasApiKey && !apiKeySkipped) {
    return <ApiKeyPrompt 
        isStudioEnv={isStudioEnv}
        onSelectKey={handleSelectStudioKey}
        onSaveManualKey={handleSaveManualKey}
        onSkip={handleSkip}
        error={apiKeyError}
    />;
  }

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200 bg-[#0F172A] p-4 sm:p-6 lg:p-8">
      {isUpdateKeyModalOpen && (
        <ApiKeyPrompt
            isModal={true}
            isStudioEnv={isStudioEnv}
            onSelectKey={handleSelectStudioKey}
            onSaveManualKey={handleSaveManualKey}
            onClose={() => setUpdateKeyModalOpen(false)}
            error={apiKeyError}
        />
      )}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          user={currentUser}
          onUpdateProfile={updateUserProfile}
        />
      )}
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
      <div className="max-w-7xl mx-auto">
        <Header 
            tasks={tasks} 
            user={currentUser}
            onLogout={logout} 
            hasApiKey={hasApiKey}
            onManageApiKey={() => setUpdateKeyModalOpen(true)}
            onOpenSettings={() => setSettingsModalOpen(true)}
        />
        
        <main className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-[#1E293B]/60 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-semibold mb-4 text-slate-100">Thêm công việc mới</h2>
              <TaskInput 
                onAddTask={addTask} 
                onApiKeyError={onApiKeyError} 
                hasApiKey={hasApiKey}
              />
            </div>
            
            <div className="bg-[#1E293B]/60 p-6 rounded-2xl shadow-lg">
              <div className="mb-4">
                <SearchBar 
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                />
              </div>
              <FilterTags 
                hashtags={allHashtags}
                activeHashtag={activeHashtag}
                onSelectHashtag={handleSelectHashtag}
                hashtagStatuses={hashtagStatuses}
              />
              <div className="flex justify-end my-4">
                <div className="flex items-center gap-1 p-1 bg-slate-900/50 border border-slate-700 rounded-lg">
                    <button 
                        onClick={() => setView('incomplete')} 
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors w-36 text-center ${
                            view === 'incomplete' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        Cần làm ({incompleteCount})
                    </button>
                    <button 
                        onClick={() => setView('completed')} 
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors w-36 text-center ${
                            view === 'completed' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        Hoàn thành ({completedCount})
                    </button>
                </div>
              </div>
              <TaskList 
                tasks={filteredTasks} 
                onToggleTask={toggleTask}
                onDeleteTask={deleteTask}
                onUpdateTaskDueDate={updateTaskDueDate}
                onToggleTaskUrgency={toggleTaskUrgency}
                onStartFocus={handleStartFocus}
                onAddSubtasksBatch={addSubtasksBatch}
                onApiKeyError={onApiKeyError}
                hasApiKey={hasApiKey}
                onUpdateTaskText={updateTaskText}
              />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#1E293B]/60 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-semibold mb-4 text-slate-100">Bảng điều khiển</h2>
              <Dashboard tasks={tasks} />
            </div>

            <div className="bg-[#1E293B]/60 p-6 rounded-2xl shadow-lg">
              <AdvancedDashboard tasks={tasks} />
            </div>

            <div className="bg-[#1E293B]/60 p-6 rounded-2xl shadow-lg">
                <GoogleSheetSync tasks={tasks} />
            </div>
            
            {notificationPermissionStatus === 'default' && (
              <div className="bg-blue-900/50 border border-blue-700 text-blue-200 p-4 rounded-xl shadow-lg" role="alert">
                <div className="flex">
                  <div className="py-1"><ShieldCheck className="h-6 w-6 text-blue-400 mr-4" /></div>
                  <div>
                    <p className="font-bold">Kích hoạt thông báo</p>
                    <p className="text-sm text-blue-300">Cho phép thông báo để nhận nhắc nhở cho công việc quá hạn.</p>
                    <button onClick={handleRequestPermission} className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-3 rounded-lg text-sm transition-colors">Cho phép</button>
                  </div>
                </div>
              </div>
            )}

            {notificationPermissionStatus === 'denied' && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-xl shadow-lg" role="alert">
                <div className="flex">
                  <div className="py-1"><ShieldOff className="h-6 w-6 text-red-400 mr-4" /></div>
                  <div>
                    <p className="font-bold">Thông báo đã bị chặn</p>
                    <p className="text-sm text-red-300">Bạn đã chặn thông báo. Vui lòng bật lại trong cài đặt trình duyệt để nhận nhắc nhở.</p>
                  </div>
                </div>
              </div>
            )}
            
             <div className="bg-indigo-900/50 border border-indigo-700 text-indigo-200 p-4 rounded-xl shadow-lg" role="alert">
              <div className="flex items-center">
                <BellRing className="h-5 w-5 mr-3 text-indigo-400" />
                <div>
                  <p className="font-bold">Nhắc nhở thông minh</p>
                  <p className="text-sm text-indigo-300">Khi được cho phép, bạn sẽ nhận được thông báo và âm thanh cho các công việc quá hạn.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;