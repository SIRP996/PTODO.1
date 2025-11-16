

import React, { useState, useMemo, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useTasks } from './hooks/useTasks';
import Header from './components/Header';
import SourceSidebar from './components/SourceSidebar';
import TaskInput from './components/TaskInput';
import TaskList from './components/TaskList';
import { BellRing, ShieldOff, Loader2, List, LayoutGrid, Bot, Clock, Send, User, RotateCw, Settings, Link as LinkIcon, Check, BrainCircuit, X, UserPlus, Users, Mail, Trash2 } from 'lucide-react';
import { Task, TaskStatus, Project, Filter, TaskTemplate, SectionKey, UserProfile, ChatRoom } from './types';
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
import { useProjects, useUserProfiles } from './hooks/useProjects';
import TimelineView from './components/TimelineView';
import { useTaskTemplates } from './hooks/useTaskTemplates';
import TemplateManagerModal from './components/TemplateManagerModal';
import WeeklyReviewModal from './components/WeeklyReviewModal';
import ApplyTemplateModal from './components/ApplyTemplateModal';
import { useToast } from './context/ToastContext';
import { Chat, GoogleGenAI, Type } from '@google/genai';
import { getGoogleGenAI } from './utils/gemini';
import MemberManagerModal from './components/MemberManagerModal';
import { useNotifications } from './hooks/useNotifications';
import type { User as FirebaseUser } from 'firebase/auth';
import ChatPanel from './components/chat/ChatPanel';
import { useChat } from './hooks/useChat';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface ProjectPlan {
  projectName: string;
  phases: {
    phaseName: string;
    subtasks: string[];
  }[];
}


// --- AI PROJECT PLANNER MODAL ---
const AIProjectPlannerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onApiKeyError: () => void;
  addProject: (name: string) => Promise<string | undefined>;
  addTask: (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly', projectId?: string) => Promise<string | undefined>;
  addSubtasksBatch: (parentId: string, subtaskTexts: string[]) => Promise<void>;
}> = ({ isOpen, onClose, initialText, onApiKeyError, addProject, addTask, addSubtasksBatch }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [view, setView] = useState<'chat' | 'review'>('chat');
  const [projectPlan, setProjectPlan] = useState<ProjectPlan | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const systemInstruction = `Bạn là "Em", một chuyên gia lập kế hoạch dự án cho ứng dụng PTODO. Bạn xưng là "em", gọi người dùng là "anh". Nhiệm vụ của bạn là hỏi người dùng các câu hỏi cần thiết để làm rõ một mục tiêu lớn, sau đó chia nhỏ nó thành một kế hoạch chi tiết.
  QUY TRÌNH:
  1.  Bắt đầu bằng cách hỏi các câu hỏi để thu thập thông tin (ví dụ: thời gian, mục tiêu chính, các bên liên quan).
  2.  Sau khi có đủ thông tin, bạn PHẢI trả về một cấu trúc JSON duy nhất chứa toàn bộ kế hoạch. JSON này phải được bao bọc trong cặp thẻ [PLAN]...[/PLAN].
  3.  JSON phải có cấu trúc: { "projectName": string, "phases": [{ "phaseName": string, "subtasks": [string, string, ...] }] }.
  4.  Giọng văn luôn thân thiện, chuyên nghiệp và hữu ích. Giao tiếp bằng tiếng Việt.`;

  const initializeAndStartChat = useCallback(async (text: string) => {
    setIsLoading(true);
    setMessages([]);
    setProjectPlan(null);
    setView('chat');

    const ai = getGoogleGenAI();
    if (!ai) {
      addToast("Vui lòng thiết lập API Key để sử dụng tính năng này.", "error");
      onApiKeyError();
      onClose();
      return;
    }

    chatSessionRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction },
    });

    const initialUserMessage: ChatMessage = { role: 'user', text };
    setMessages([initialUserMessage]);

    try {
      const response = await chatSessionRef.current.sendMessage({ message: initialUserMessage.text });
      handleAIResponse(response.text);
    } catch (error) {
      console.error("AI Planner Error:", error);
      addToast("Có lỗi xảy ra khi bắt đầu lập kế hoạch.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addToast, onApiKeyError, onClose, systemInstruction]);

  useEffect(() => {
    if (isOpen && initialText) {
      initializeAndStartChat(initialText);
    }
  }, [isOpen, initialText, initializeAndStartChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleAIResponse = (responseText: string) => {
    if (responseText.includes('[PLAN]') && responseText.includes('[/PLAN]')) {
      const planRegex = /\[PLAN\]([\s\S]*?)\[\/PLAN\]/;
      const match = responseText.match(planRegex);
      if (match && match[1]) {
        try {
          const parsedPlan = JSON.parse(match[1]);
          setProjectPlan(parsedPlan);
          setView('review');
        } catch (e) {
          console.error("JSON parsing failed:", e);
          setMessages(prev => [...prev, { role: 'model', text: "Em xin lỗi, có lỗi khi tạo kế hoạch. Anh có muốn thử lại không?" }]);
        }
      }
    } else {
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !chatSessionRef.current) return;

    const userMessage: ChatMessage = { role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatSessionRef.current.sendMessage({ message: userMessage.text });
      handleAIResponse(response.text);
    } catch (error) {
      addToast("Có lỗi khi gửi tin nhắn cho AI.", 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateProject = async () => {
    if (!projectPlan) return;
    setIsLoading(true);
    try {
        const projectId = await addProject(projectPlan.projectName);
        if (!projectId) {
            throw new Error("Không thể tạo dự án.");
        }

        for (const phase of projectPlan.phases) {
            const mainTaskId = await addTask(phase.phaseName, [], null, false, 'none', projectId);
            if (mainTaskId && phase.subtasks && phase.subtasks.length > 0) {
                await addSubtasksBatch(mainTaskId, phase.subtasks);
            }
        }
        addToast(`Dự án "${projectPlan.projectName}" đã được tạo thành công!`, 'success');
        onClose();
    } catch (error) {
        addToast("Đã xảy ra lỗi khi tạo dự án chi tiết.", 'error');
    } finally {
        setIsLoading(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#1E293B]/60 backdrop-blur-xl border border-white/10 max-w-2xl w-full rounded-2xl shadow-2xl h-[80vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><BrainCircuit size={20} className="text-primary-400" /> AI Lập Kế hoạch Dự án</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
          </div>

          {view === 'chat' ? (
              <>
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                  {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center"><Bot size={18} className="text-white"/></div>}
                      <div className={`max-w-[80%] px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-primary-700 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      {msg.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center"><User size={18} className="text-white"/></div>}
                    </div>
                  ))}
                  {isLoading && <div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center"><Loader2 className="animate-spin text-white"/></div></div>}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 flex-shrink-0 flex items-center gap-2">
                    <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Trả lời Em..." className="w-full bg-[#293548] text-slate-200 border border-slate-600 rounded-lg px-4 py-2 text-sm" disabled={isLoading} />
                    <button type="submit" disabled={isLoading || !inputValue.trim()} className="bg-primary-600 text-white p-2.5 rounded-lg disabled:bg-slate-700"><Send size={20} /></button>
                </form>
              </>
          ) : projectPlan && (
              <>
                <div className="flex-grow p-6 overflow-y-auto space-y-4 text-white">
                    <h4 className="text-xl font-bold">{projectPlan.projectName}</h4>
                    {projectPlan.phases.map((phase, index) => (
                        <div key={index} className="bg-slate-800/50 p-4 rounded-lg">
                            <p className="font-semibold text-primary-300">{phase.phaseName}</p>
                            <ul className="mt-2 ml-4 list-disc list-outside space-y-1 text-slate-300 text-sm">
                                {phase.subtasks.map((st, i) => <li key={i}>{st}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
                 <div className="p-4 border-t border-slate-700 flex-shrink-0 flex justify-end">
                    <button onClick={handleCreateProject} disabled={isLoading} className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-slate-700">
                        {isLoading ? <Loader2 className="animate-spin"/> : <Check />}
                        Tạo Dự án
                    </button>
                 </div>
              </>
          )}
      </div>
    </div>
  );
};


// --- EXTENSION GUIDE MODAL ---
const ExtensionGuideModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    const manifestCode = `{
  "manifest_version": 3,
  "name": "PTODO Quick Add",
  "version": "1.0",
  "description": "Thêm công việc vào PTODO từ bất kỳ trang web nào.",
  "permissions": ["contextMenus", "storage", "notifications"],
  "host_permissions": ["<URL_CLOUD_FUNCTION_CỦA_BẠN>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon128.png"
  },
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
}`;

const backgroundCode = `// background.js

// QUAN TRỌNG: Thay thế bằng URL Cloud Function 'addTaskFromExtension' của bạn
const CLOUD_FUNCTION_URL = '<URL_CLOUD_FUNCTION_CỦA_BẠN>'; 

// 1. Tạo Context Menu khi cài đặt
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ptodoQuickAdd",
    title: "Thêm vào PTODO",
    contexts: ["selection"]
  });
});

// 2. Xử lý khi bấm vào Context Menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ptodoQuickAdd" && info.selectionText) {
    addTask(info.selectionText);
  }
});

async function addTask(text) {
  try {
    // 3. Lấy token xác thực từ storage
    const { token } = await chrome.storage.local.get('token');
    
    if (!token) {
      chrome.action.openPopup();
      return;
    }

    // 4. Gọi Cloud Function
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ data: { text: text } })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Network response was not ok');
    }
    
    const result = await response.json();
    const taskData = result.result;

    // 5. Hiển thị thông báo thành công
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: 'Đã thêm vào PTODO!',
      message: 'Đã thêm công việc: "' + taskData.taskText + '"'
    });

  } catch (error) {
    console.error('Error adding task:', error);
    // 6. Hiển thị thông báo lỗi
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: 'Lỗi khi thêm công việc',
      message: 'Bạn chưa đăng nhập hoặc có lỗi xảy ra. Vui lòng nhấp vào biểu tượng PTODO để đăng nhập.'
    });
    chrome.action.openPopup();
  }
}`;

const popupHtmlCode = `<!DOCTYPE html>
<html>
<head>
    <title>PTODO Auth</title>
    <style>
        body { font-family: sans-serif; width: 250px; padding: 10px; text-align: center; background-color: #1e293b; color: #e2e8f0; }
        button { cursor: pointer; padding: 8px 12px; border: none; border-radius: 4px; font-weight: bold; }
        #loginBtn { background-color: #4f46e5; color: white; width: 100%; }
        #logoutBtn { background-color: #475569; color: #e2e8f0; width: 100%;}
        #status { margin-top: 10px; font-size: 12px; color: #94a3b8; }
        p { font-size: 12px; }
    </style>
</head>
<body>
    <h3>Xác thực PTODO</h3>
    <p id="userInfo" style="display: none;"></p>
    <button id="loginBtn">Đăng nhập với Google</button>
    <button id="logoutBtn" style="display: none;">Đăng xuất</button>
    <p id="status"></p>
    
    <!-- QUAN TRỌNG: Tải về và đặt các file này cùng thư mục -->
    <script src="./firebase-app.js"></script>
    <script src="./firebase-auth.js"></script>
    <script src="./popup.js"></script>
</body>
</html>`;

const popupJsCode = `// popup.js

// QUAN TRỌNG:
// 1. Dán cấu hình Firebase của bạn vào đây (lấy từ Firebase Console).
// 2. Tải về file firebase-app.js và firebase-auth.js từ CDN và đặt cùng thư mục.
//    - https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js
//    - https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js
const firebaseConfig = {
  // Dán cấu hình của bạn vào đây
  apiKey: "AIza...",
  authDomain: "...",
  projectId: "...",
  // ...
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const statusEl = document.getElementById('status');

// Kiểm tra trạng thái đăng nhập khi mở popup
auth.onAuthStateChanged(user => {
    if (user) {
        userInfo.textContent = 'Đã đăng nhập: ' + user.email;
        userInfo.style.display = 'block';
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';

        // Lấy ID token và lưu lại
        user.getIdToken(true).then(token => { // true to force refresh
            chrome.storage.local.set({ token: token });
        });
    } else {
        userInfo.style.display = 'none';
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        chrome.storage.local.remove('token');
    }
});


loginBtn.addEventListener('click', () => {
    statusEl.textContent = 'Đang mở cửa sổ đăng nhập...';
    auth.signInWithPopup(provider)
        .then(result => {
            statusEl.textContent = 'Đăng nhập thành công!';
        })
        .catch(error => {
            console.error('Login failed:', error);
            statusEl.textContent = 'Lỗi: ' + error.message;
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        statusEl.textContent = 'Đã đăng xuất.';
    });
});
`;

    return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#1E293B]/60 backdrop-blur-xl border border-white/10 max-w-3xl w-full rounded-2xl shadow-2xl h-[80vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><LinkIcon size={20} className="text-primary-400" /> Tích hợp Trình duyệt</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
          </div>
          <div className="flex-grow p-6 overflow-y-auto text-slate-300 text-sm space-y-4">
              <p>Làm theo các bước sau để tạo tiện ích mở rộng giúp bạn thêm công việc vào PTODO từ bất cứ đâu.</p>
              <h4 className="font-bold text-white">Bước 1: Tạo các tệp cần thiết</h4>
              <p>Tạo một thư mục mới trên máy tính. Bên trong, tạo các tệp sau:</p>
              <ul className="list-disc list-inside bg-slate-800/50 p-3 rounded-md font-mono text-xs">
                  <li>manifest.json</li>
                  <li>background.js</li>
                  <li>popup.html</li>
                  <li>popup.js</li>
                  <li>Tải về và thêm <a href="https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js" target="_blank" rel="noopener noreferrer" className="text-primary-400 underline">firebase-app.js</a></li>
                  <li>Tải về và thêm <a href="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js" target="_blank" rel="noopener noreferrer" className="text-primary-400 underline">firebase-auth.js</a></li>
                  <li>(Tải về một icon 128x128 và đặt tên là icon128.png)</li>
              </ul>
              <h4 className="font-bold text-white">Bước 2: Dán mã nguồn</h4>
              <p>Dán các đoạn mã sau vào tệp tương ứng.</p>
              <details className="bg-slate-800/50 p-3 rounded-md transition-all">
                  <summary className="font-semibold cursor-pointer text-base text-slate-200">manifest.json</summary>
                  <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-x-auto"><code>{manifestCode}</code></pre>
                  <p className="mt-2 text-xs text-amber-300"><b>Lưu ý:</b> Thay thế <code>&lt;URL_CLOUD_FUNCTION_CỦA_BẠN&gt;</code> bằng URL của hàm <code>addTaskFromExtension</code> sau khi bạn triển khai Firebase Functions.</p>
              </details>
              <details className="bg-slate-800/50 p-3 rounded-md transition-all">
                  <summary className="font-semibold cursor-pointer text-base text-slate-200">background.js</summary>
                  <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-x-auto"><code>{backgroundCode}</code></pre>
                   <p className="mt-2 text-xs text-amber-300"><b>Lưu ý:</b> Nhớ thay thế URL Cloud Function ở trên cùng.</p>
              </details>
              <details className="bg-slate-800/50 p-3 rounded-md transition-all">
                  <summary className="font-semibold cursor-pointer text-base text-slate-200">popup.html</summary>
                  <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-x-auto"><code>{popupHtmlCode}</code></pre>
              </details>
               <details className="bg-slate-800/50 p-3 rounded-md transition-all">
                  <summary className="font-semibold cursor-pointer text-base text-slate-200">popup.js</summary>
                  <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-x-auto"><code>{popupJsCode}</code></pre>
                  <p className="mt-2 text-xs text-amber-300"><b>Lưu ý quan trọng:</b> Dán đối tượng cấu hình Firebase của dự án bạn vào biến <code>firebaseConfig</code>.</p>
              </details>
              <h4 className="font-bold text-white">Bước 3: Cài đặt tiện ích</h4>
               <ul className="list-decimal list-inside space-y-1">
                    <li>Mở Chrome và truy cập <code>chrome://extensions</code>.</li>
                    <li>Bật "Chế độ dành cho nhà phát triển" (Developer mode).</li>
                    <li>Nhấp vào "Tải tiện ích đã giải nén" (Load unpacked) và chọn thư mục bạn đã tạo ở Bước 1.</li>
                    <li>Sau khi cài đặt, nhấp vào biểu tượng của tiện ích trên thanh công cụ để đăng nhập lần đầu tiên.</li>
               </ul>
          </div>
      </div>
    </div>
    );
};


const statusLabels: Record<TaskStatus, string> = {
  todo: 'Cần làm',
  inprogress: 'Đang làm',
  completed: 'Hoàn thành',
};

const App: React.FC = () => {
  const { currentUser, logout, updateUserProfile, userSettings, updateUserSettings, loading, isGuestMode, exitGuestMode } = useAuth();
  const { addToast } = useToast();
  
  const { projects, addProject, inviteUserToProject, removeUserFromProject, cancelInvitation, deleteProject, updateProject } = useProjects();
  
  const { 
    tasks, addTask, toggleTask, deleteTask, markReminderSent, updateTaskDueDate, toggleTaskUrgency,
    addSubtasksBatch, addTasksBatch, updateTaskText, updateTaskStatus, updateTaskNote, syncExistingTasksToCalendar,
    updateTask,
  } = useTasks(projects);

  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTaskTemplates();
  const { notifications, acceptInvitation, declineInvitation } = useNotifications();
  
  const allMemberIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUser) ids.add(currentUser.uid);
    projects.forEach(p => p.memberIds.forEach(id => ids.add(id)));
    tasks.forEach(t => t.assigneeIds.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [projects, tasks, currentUser]);

  const { profiles } = useUserProfiles(allMemberIds);
  
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
  const [isWeeklyReviewModalOpen, setIsWeeklyReviewModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedTemplateForApply, setSelectedTemplateForApply] = useState<TaskTemplate | null>(null);
  const [isPlannerModalOpen, setIsPlannerModalOpen] = useState(false);
  const [plannerInitialText, setPlannerInitialText] = useState('');
  const [isExtensionGuideOpen, setIsExtensionGuideOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [projectToManage, setProjectToManage] = useState<Project | null>(null);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  
  // --- CHAT STATE ---
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [activeChatRoom, setActiveChatRoom] = useState<ChatRoom | null>(null);
  const chatData = useChat(currentUser, projects, activeChatRoom?.id || null);
  
  const handleSelectChatRoom = (room: ChatRoom) => {
    setActiveChatRoom(room);
    chatData.markRoomAsRead(room.id);
  };
  
  const handleToggleChatPanel = () => {
    setIsChatPanelOpen(prev => !prev);
    if (!isChatPanelOpen && activeChatRoom) {
      chatData.markRoomAsRead(activeChatRoom.id);
    }
  };


  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(350);
  const sidebarResizeData = useRef<{ initialX: number; initialWidth: number } | null>(null);

  // Handle invitation link from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invitationId = urlParams.get('invitationId');
    if (invitationId) {
      sessionStorage.setItem('pendingInvitationId', invitationId);
      // Clean the URL
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  }, []);

  const handleOpenMemberManager = (project: Project) => {
    setProjectToManage(project);
    setIsMemberModalOpen(true);
  };

  const handleOpenApplyTemplateModal = (template: TaskTemplate) => {
    setSelectedTemplateForApply(template);
    setIsApplyModalOpen(true);
  };

  const handleOpenPlannerModal = (text: string) => {
    setPlannerInitialText(text);
    setIsPlannerModalOpen(true);
  };

  const handleCloseApplyTemplateModal = () => {
    setIsApplyModalOpen(false);
    setSelectedTemplateForApply(null);
  };

  const handleApplyTemplate = async (details: { dueDate: string | null; tags: string[]; isUrgent: boolean; projectId: string }) => {
    if (!selectedTemplateForApply) return;

    const newTaskId = await addTask(
        selectedTemplateForApply.name,
        details.tags,
        details.dueDate,
        details.isUrgent,
        'none',
        details.projectId || undefined
    );

    if (newTaskId && selectedTemplateForApply.subtasks.length > 0) {
        const subtaskTexts = selectedTemplateForApply.subtasks.map(st => st.text);
        await addSubtasksBatch(newTaskId, subtaskTexts);
        addToast(`Đã áp dụng mẫu "${selectedTemplateForApply.name}" với các tùy chỉnh của bạn!`, 'success');
    } else if (newTaskId) {
        addToast(`Đã áp dụng mẫu "${selectedTemplateForApply.name}"!`, 'success');
    }

    handleCloseApplyTemplateModal();
  };
  
  const focusCompletionSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTguNzYuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    }
    return null;
  }, []);

  const notificationSound = useMemo(() => {
    if (typeof Audio !== 'undefined') {
        return new Audio("data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBvZmYgU291bmQgRUNAIDIwMTIAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAAMgAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
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

    const handleSidebarResizeMouseMove = useCallback((e: MouseEvent) => {
        if (sidebarResizeData.current) {
            const deltaX = e.clientX - sidebarResizeData.current.initialX;
            const newWidth = sidebarResizeData.current.initialWidth + deltaX;
            setSidebarWidth(Math.max(280, Math.min(600, newWidth)));
        }
    }, []);

    const handleSidebarResizeMouseUp = useCallback(() => {
        sidebarResizeData.current = null;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        window.removeEventListener('mousemove', handleSidebarResizeMouseMove);
        window.removeEventListener('mouseup', handleSidebarResizeMouseUp);
    }, [handleSidebarResizeMouseMove]);

    const handleSidebarResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        sidebarResizeData.current = { initialX: e.clientX, initialWidth: sidebarWidth };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleSidebarResizeMouseMove);
        window.addEventListener('mouseup', handleSidebarResizeMouseUp);
    }, [sidebarWidth, handleSidebarResizeMouseMove, handleSidebarResizeMouseUp]);


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

  const sidebarProps = {
    user: currentUser,
    tasks, projects, searchTerm, onSearchChange: setSearchTerm, activeFilter, onFilterChange: setActiveFilter,
    onLogout: logout, hasApiKey, onManageApiKey: () => setUpdateKeyModalOpen(true), onOpenSettings: () => setSettingsModalOpen(true),
    onToggleLogViewer: () => setIsLogViewerOpen(prev => !prev), onOpenTemplateManager: () => setIsTemplateManagerOpen(true),
    onOpenWeeklyReview: () => setIsWeeklyReviewModalOpen(true), notificationPermissionStatus, onRequestNotificationPermission: handleRequestPermission,
    onOpenExtensionGuide: () => setIsExtensionGuideOpen(true), onOpenMemberManager: handleOpenMemberManager, onAddProject: addProject,
    onDeleteProject: deleteProject, onUpdateProject: updateProject,
    onToggleChatPanel: handleToggleChatPanel,
    unreadChatCount: chatData.unreadRoomIds.size,
  };

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
      {isWeeklyReviewModalOpen && currentUser && hasApiKey && <WeeklyReviewModal isOpen={isWeeklyReviewModalOpen} onClose={() => setIsWeeklyReviewModalOpen(false)} tasks={tasks} onApiKeyError={onApiKeyError} />}
      <AIProjectPlannerModal 
        isOpen={isPlannerModalOpen}
        onClose={() => setIsPlannerModalOpen(false)}
        initialText={plannerInitialText}
        onApiKeyError={onApiKeyError}
        addProject={addProject}
        addTask={addTask}
        addSubtasksBatch={addSubtasksBatch}
      />
      <ExtensionGuideModal isOpen={isExtensionGuideOpen} onClose={() => setIsExtensionGuideOpen(false)} />
      {projectToManage && currentUser && (
        <MemberManagerModal
            isOpen={isMemberModalOpen}
            onClose={() => setIsMemberModalOpen(false)}
            project={projectToManage}
            currentUser={currentUser}
            onInviteUser={inviteUserToProject}
            onRemoveUser={removeUserFromProject}
            onCancelInvitation={cancelInvitation}
            profiles={profiles}
            tasks={tasks}
        />
      )}
      {selectedTemplateForApply && (
        <ApplyTemplateModal
            isOpen={isApplyModalOpen}
            onClose={handleCloseApplyTemplateModal}
            template={selectedTemplateForApply}
            projects={projects}
            onApply={handleApplyTemplate}
        />
      )}
      {hasApiKey && currentUser && <ChatAssistant isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} tasks={tasks} onAddTask={addTask} onApiKeyError={onApiKeyError} userAvatarUrl={userSettings?.avatarUrl || currentUser?.photoURL || undefined} />}
      
      {isChatPanelOpen && currentUser && (
        <ChatPanel 
            isOpen={isChatPanelOpen}
            onClose={() => setIsChatPanelOpen(false)}
            currentUser={currentUser}
            projects={projects}
            tasks={tasks}
            profiles={profiles}
            onUpdateTask={updateTask}
            // Pass chat data from App-level hook
            chatData={chatData}
            activeRoom={activeChatRoom}
            onSelectRoom={handleSelectChatRoom}
        />
      )}

      <div className="min-h-screen bg-[#0F172A] text-slate-100 font-sans flex flex-col">
          <div className="max-w-screen-2xl mx-auto w-full flex-grow flex flex-col">
              <div className="p-4 sm:p-6 lg:p-8 flex-shrink-0">
                  {isGuestMode && <GuestBanner onSignUp={handleNavigateToAuth} />}
                  <Header 
                    onSwitchToCalendar={() => setPage('calendar')} 
                    onToggleZenMode={() => setIsZenMode(prev => !prev)}
                    isZenMode={isZenMode}
                    notificationCount={notifications.length}
                    isNotificationPanelOpen={isNotificationPanelOpen}
                    onToggleNotifications={() => setIsNotificationPanelOpen(p => !p)}
                    onCloseNotifications={() => setIsNotificationPanelOpen(false)}
                    notifications={notifications}
                    onAcceptInvitation={acceptInvitation}
                    onDeclineInvitation={declineInvitation}
                    onToggleMobileSidebar={() => setIsMobileSidebarOpen(true)}
                  />
              </div>
              
              <main className="px-4 sm:px-6 lg:p-8 flex flex-grow transition-all duration-300 overflow-hidden">
                {/* --- MOBILE SIDEBAR --- */}
                {isMobileSidebarOpen && (
                    <div className="lg:hidden" role="dialog" aria-modal="true">
                        <div 
                            className="fixed inset-0 bg-black/60 z-30 animate-simpleFadeIn"
                            onClick={() => setIsMobileSidebarOpen(false)}
                            aria-hidden="true"
                        ></div>
                        <div className="fixed inset-y-0 left-0 w-80 max-w-[calc(100%-3rem)] bg-[#0f172a] z-40 p-4 border-r border-slate-700 animate-slideInLeft">
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 h-full">
                                <SourceSidebar {...sidebarProps} />
                            </div>
                        </div>
                    </div>
                )}
                
                {/* --- DESKTOP SIDEBAR --- */}
                {!isZenMode && (
                    <div className="hidden lg:flex">
                        <div 
                            className="transition-all duration-300"
                            style={{ width: `${sidebarWidth}px` }}
                        >
                           <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 h-full">
                             <SourceSidebar {...sidebarProps} />
                           </div>
                        </div>
                        <div 
                            onMouseDown={handleSidebarResizeMouseDown}
                            className="sidebar-resizer"
                            title="Kéo để thay đổi kích thước"
                        />
                    </div>
                )}

                <div className={`space-y-6 transition-all duration-300 flex-grow w-full`}>
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 animate-fadeIn">
                    <TaskInput onAddTask={addTask} onApiKeyError={onApiKeyError} hasApiKey={hasApiKey} onOpenImportModal={() => setIsImportModalOpen(true)} projects={projects} selectedProjectId={activeFilter.type === 'project' ? activeFilter.id : null} templates={templates} onOpenApplyTemplateModal={handleOpenApplyTemplateModal} onOpenPlannerModal={handleOpenPlannerModal} />
                  </div>
                  
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 animate-fadeIn" style={{ animationDelay: '100ms' }}>
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
                            <TaskList tasks={tasksForList} onToggleTask={toggleTask} onDeleteTask={deleteTask} onUpdateTaskDueDate={updateTaskDueDate} onToggleTaskUrgency={toggleTaskUrgency} onStartFocus={handleStartFocus} onAddSubtasksBatch={addSubtasksBatch} onApiKeyError={onApiKeyError} hasApiKey={hasApiKey} onUpdateTaskText={updateTaskText} onUpdateTaskStatus={updateTaskStatus} onUpdateTaskNote={updateTaskNote} onUpdateTask={updateTask} projects={projects} profiles={profiles} currentUser={currentUser} />
                        </div>
                         <div onMouseDown={handleResizeMouseDown} className="absolute bottom-0 right-0 w-6 h-6 cursor-ns-resize flex items-center justify-center group" title="Kéo để thay đổi kích thước"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-600 group-hover:text-slate-400 transition-colors"><path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 8L8 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
                      </div>
                    ) : (
                      <KanbanBoard tasks={parentTasks} subtasksByParentId={subtasksByParentId} onUpdateTaskStatus={updateTaskStatus} toggleTaskUrgency={toggleTaskUrgency} onDeleteTask={deleteTask} onStartFocus={handleStartFocus} onToggleTask={toggleTask} onUpdateTaskNote={updateTaskNote} profiles={profiles} currentUser={currentUser} projects={projects} />
                    )}
                  </div>
                </div>
              </main>
          </div>
          {hasApiKey && currentUser && <button onClick={() => setIsChatOpen(true)} className="fixed bottom-6 right-6 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg z-40 transition-transform hover:scale-110" title="Mở Trợ lý AI"><Bot size={24} /></button>}
      </div>
    </>
  );
};

export default App;
