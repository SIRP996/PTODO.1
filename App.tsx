
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

// FIX: Inlined the type definition for `aistudio` to resolve potential declaration conflicts.
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const App: React.FC = () => {
  const { currentUser, logout } = useAuth();
  
  const { 
    tasks, 
    addTask, 
    toggleTask, 
    deleteTask,
    markReminderSent,
    updateTaskDueDate,
    toggleTaskUrgency,
    addSubtasksBatch,
  } = useTasks();
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [view, setView] = useState<'incomplete' | 'completed'>('incomplete');
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState('default');
  const workerRef = useRef<Worker | null>(null);

  // API Key State
  const [isKeySelected, setIsKeySelected] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [apiKeySelectionError, setApiKeySelectionError] = useState<string | null>(null);

  // Focus Mode State
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const focusCompletionSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTguNzYuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);

  const notificationSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);
  
  const checkApiKey = useCallback(async () => {
    setIsCheckingKey(true);
    try {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setIsKeySelected(hasKey);
        } else {
            console.warn('aistudio is not available. Assuming no key.');
            setIsKeySelected(false);
        }
    } catch (e) {
        console.error("Error checking for API key:", e);
        setIsKeySelected(false);
    } finally {
        setIsCheckingKey(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
        checkApiKey();
    }
  }, [currentUser, checkApiKey]);

  const handleSelectKey = async () => {
    setApiKeySelectionError(null);
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        try {
            await window.aistudio.openSelectKey();
            setIsKeySelected(true); // Assume success to handle race condition
        } catch (e) {
            console.error("Could not open API key selection:", e);
            setApiKeySelectionError("Không thể mở hộp thoại chọn API Key. Vui lòng thử làm mới trang.");
        }
    } else {
        setApiKeySelectionError("Tính năng chọn API Key không khả dụng trong môi trường này. Vui lòng chạy ứng dụng trong một môi trường được hỗ trợ, chẳng hạn như Google AI Studio.");
        console.error("window.aistudio.openSelectKey is not available.");
    }
  };
    
  const onApiKeyError = useCallback(() => {
    setIsKeySelected(false);
  }, []);

  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
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

  const filteredTasks = useMemo(() => {
    const hashtagFiltered = activeHashtag
      ? tasks.filter(task => task.hashtags.includes(activeHashtag))
      : tasks;
    return hashtagFiltered.filter(task => view === 'completed' ? task.completed : !task.completed);
  }, [tasks, activeHashtag, view]);
  
  const incompleteCount = useMemo(() => (activeHashtag ? tasks.filter(t => t.hashtags.includes(activeHashtag)) : tasks).filter(t => !t.completed).length, [tasks, activeHashtag]);
  const completedCount = useMemo(() => (activeHashtag ? tasks.filter(t => t.hashtags.includes(activeHashtag)) : tasks).filter(t => t.completed).length, [tasks, activeHashtag]);
  const allHashtags = useMemo(() => Array.from(new Set(tasks.flatMap(task => task.hashtags.map(tag => tag.toLowerCase())))), [tasks]);

  if (!currentUser) {
    return <AuthPage />;
  }

  if (isCheckingKey) {
    return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-indigo-400 animate-spin" />
        </div>
    );
  }

  if (!isKeySelected) {
    return <ApiKeyPrompt onSelectKey={handleSelectKey} error={apiKeySelectionError} />;
  }

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200 bg-[#0F172A] p-4 sm:p-6 lg:p-8">
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
        <Header tasks={tasks} onLogout={logout} />
        
        <main className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-[#1E293B]/60 p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-semibold mb-4 text-slate-100">Thêm công việc mới</h2>
              <TaskInput onAddTask={addTask} onApiKeyError={onApiKeyError} />
            </div>
            
            <div className="bg-[#1E293B]/60 p-6 rounded-2xl shadow-lg">
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
