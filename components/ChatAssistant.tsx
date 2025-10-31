import React, { useState, useEffect, useRef, FormEvent, useMemo } from 'react';
import { GoogleGenAI, FunctionDeclaration, Type, Chat } from '@google/genai';
import { Task } from '../types';
import { Bot, Send, X, Loader2, User, Mic, RotateCw, Settings } from 'lucide-react';
import { getGoogleGenAI } from '../utils/gemini';
import { useToast } from '../context/ToastContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onAddTask: (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none') => void;
  onApiKeyError: () => void;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const addTaskFunctionDeclaration: FunctionDeclaration = {
  name: 'addTask',
  description: "Thêm một công việc mới vào danh sách việc cần làm của người dùng.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING, description: 'Nội dung chính của công việc. Ví dụ: "Mua sữa"' },
      tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Danh sách các thẻ liên quan đến công việc, không có dấu "#". Ví dụ: ["muasắm", "nhàcửa"]' },
      dueDate: { type: Type.STRING, description: 'Ngày hết hạn ở định dạng ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ). Sử dụng ngữ cảnh ngày/giờ hiện tại để phân giải các ngày tương đối như "ngày mai lúc 5 giờ chiều". Người dùng ở múi giờ UTC+7. Bạn phải chuyển đổi sang UTC.' },
      isUrgent: { type: Type.BOOLEAN, description: 'Công việc có khẩn cấp hay không.' },
    },
    required: ['text'],
  },
};

const queryTasksFunctionDeclaration: FunctionDeclaration = {
  name: 'queryTasks',
  description: 'Truy vấn và lấy danh sách công việc dựa trên các bộ lọc khác nhau như trạng thái, thẻ, nội dung văn bản, mức độ khẩn cấp hoặc phạm vi ngày hết hạn.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: { type: Type.STRING, description: 'Lọc theo trạng thái công việc: "todo", "inprogress", hoặc "completed".' },
      tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Lọc theo một hoặc nhiều thẻ. Công việc phải có tất cả các thẻ được chỉ định.' },
      containsText: { type: Type.STRING, description: 'Lọc các công việc có văn bản chính chứa chuỗi con này.' },
      isUrgent: { type: Type.BOOLEAN, description: 'Lọc công việc dựa trên trạng thái khẩn cấp của chúng.' },
    },
  },
};

const ChatAssistant: React.FC<ChatAssistantProps> = ({ isOpen, onClose, tasks, onAddTask, onApiKeyError }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    hasSupport: hasSpeechRecognitionSupport,
  } = useSpeechRecognition();
  
  useEffect(() => {
    const savedAvatar = localStorage.getItem('zenAvatarUrl');
    if (savedAvatar) {
      setAvatarUrl(savedAvatar);
    }
  }, []);

  useEffect(() => {
    if (transcript) {
        setInputValue(transcript);
    }
  }, [transcript]);

  const systemInstruction = `Bạn là Em, một trợ lý AI tận tâm và chu đáo cho ứng dụng PTODO. Bạn sẽ xưng là "em" và gọi người dùng là "anh". Vai trò chính của em là giúp anh quản lý công việc. Em có thể thêm công việc mới và trả lời các câu hỏi về công việc hiện có của anh. Em phải sử dụng các công cụ được cung cấp (addTask, queryTasks) để tương tác với dữ liệu của anh. Luôn luôn ngắn gọn, lễ phép và hữu ích. Giao tiếp bằng tiếng Việt.`;

  const welcomeMessage: ChatMessage = { role: 'model', text: 'Dạ em chào anh. Em là Em, trợ lý AI luôn sẵn sàng hỗ trợ. Em có thể giúp gì cho anh hôm nay ạ? Hãy thử ra lệnh "Thêm công việc đi chợ vào chiều nay" hoặc hỏi "Em ơi, anh có bao nhiêu việc khẩn cấp?".' };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([welcomeMessage]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeChat = () => {
    const ai = getGoogleGenAI();
    if (ai) {
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: [addTaskFunctionDeclaration, queryTasksFunctionDeclaration] }],
        },
      });
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (isOpen) {
      initializeChat();
    } else {
      chatSessionRef.current = null;
    }
  }, [isOpen]);
  
  const handleClearChat = () => {
    setMessages([welcomeMessage]);
    if (initializeChat()) {
        addToast("Cuộc trò chuyện đã được làm mới.", "info");
    }
    setIsLoading(false);
    setInputValue('');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatarUrl(base64String);
        localStorage.setItem('zenAvatarUrl', base64String);
        addToast("Đã cập nhật ảnh đại diện cho em!", 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetAvatar = () => {
    setAvatarUrl(null);
    localStorage.removeItem('zenAvatarUrl');
    addToast("Đã khôi phục ảnh đại diện mặc định.", 'info');
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    if (!chatSessionRef.current) {
        addToast("Lỗi khởi tạo AI. Vui lòng kiểm tra API Key và thử lại.", "error");
        onApiKeyError();
        setIsLoading(false);
        return;
    }
    
    try {
        let response = await chatSessionRef.current.sendMessage({ message: userMessage.text });
        
        while (response.functionCalls && response.functionCalls.length > 0) {
            const functionCalls = response.functionCalls;
            const functionResponseParts = [];

            for (const fc of functionCalls) {
                let result;
                if (fc.name === 'addTask') {
                    const args = fc.args as { text: string; tags?: string[]; dueDate?: string | null; isUrgent?: boolean; };
                    const { text, tags = [], dueDate = null, isUrgent = false } = args;
                    onAddTask(text, tags, dueDate, isUrgent, 'none');
                    result = { success: true, task: text };
                } else if (fc.name === 'queryTasks') {
                    const filters = fc.args as { status?: Task['status']; tags?: string[]; containsText?: string; isUrgent?: boolean; };
                    let filteredTasks = [...tasks];
                    if (filters.status) {
                        filteredTasks = filteredTasks.filter(t => t.status === filters.status);
                    }
                    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
                        filteredTasks = filteredTasks.filter(t => filters.tags.every((tag: string) => t.hashtags.includes(tag)));
                    }
                    if (filters.containsText) {
                        filteredTasks = filteredTasks.filter(t => t.text.toLowerCase().includes(filters.containsText.toLowerCase()));
                    }
                    if (typeof filters.isUrgent === 'boolean') {
                        filteredTasks = filteredTasks.filter(t => t.isUrgent === filters.isUrgent);
                    }
                    result = filteredTasks;
                }
                functionResponseParts.push({ 
                    functionResponse: {
                        name: fc.name,
                        response: { result }
                    }
                });
            }
            
            response = await chatSessionRef.current.sendMessage({
                message: functionResponseParts
            });
        }
        
        const modelResponse: ChatMessage = { role: 'model', text: response.text };
        setMessages(prev => [...prev, modelResponse]);

    } catch (error: any) {
        console.error("Lỗi giao tiếp với AI:", error);
        addToast("Đã xảy ra lỗi khi nói chuyện với Em. Vui lòng thử lại.", 'error');
        const errorMessage = error?.message?.toLowerCase() || '';
        if (errorMessage.includes('api key not valid') || errorMessage.includes('permission_denied')) {
            onApiKeyError();
        }
    } finally {
        setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 sm:bottom-24 sm:right-8 w-[calc(100%-3rem)] max-w-sm h-[70vh] max-h-[600px] z-50 flex flex-col bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-700">
        {isSettingsOpen && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 p-4">
                <div className="bg-[#293548] p-6 rounded-lg shadow-xl border border-slate-600 w-full max-w-xs text-center">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-bold text-white">Cài đặt Em</h4>
                        <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">Chọn ảnh đại diện mới cho em nhé anh.</p>
                    <div className="w-24 h-24 rounded-full bg-primary-600 mx-auto mb-4 flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Em Avatar Preview" className="w-full h-full object-cover" />
                        ) : (
                            <Bot size={40} className="text-white"/>
                        )}
                    </div>
                    <div className="space-y-3">
                        <label htmlFor="avatar-upload" className="w-full cursor-pointer bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors block">
                            Tải ảnh lên
                        </label>
                        <input id="avatar-upload" type="file" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
                        <button onClick={handleResetAvatar} className="w-full bg-slate-600 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-4 rounded-lg transition-colors">
                            Dùng ảnh mặc định
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex justify-between items-center p-4 border-b border-slate-700 flex-shrink-0">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bot size={20} className="text-primary-400" /> Trợ lý AI Em</h3>
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Cài đặt trợ lý"
                >
                    <Settings size={16} />
                </button>
                <button 
                    onClick={handleClearChat}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Bắt đầu cuộc trò chuyện mới"
                >
                    <RotateCw size={16} />
                </button>
                <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
            </div>
        </div>
        
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {messages.map((msg, index) => (
                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'model' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center overflow-hidden">
                             {avatarUrl ? (
                                <img src={avatarUrl} alt="Em Avatar" className="w-full h-full object-cover" />
                             ) : (
                                <Bot size={18} className="text-white"/>
                             )}
                        </div>
                    )}
                    <div className={`max-w-[80%] px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-primary-700 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    {msg.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center"><User size={18} className="text-white"/></div>}
                </div>
            ))}
            {isLoading && (
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                           <img src={avatarUrl} alt="Em Avatar" className="w-full h-full object-cover" />
                        ) : (
                           <Bot size={18} className="text-white"/>
                        )}
                    </div>
                    <div className="px-4 py-3 rounded-xl bg-slate-700 flex items-center">
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span>
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse ml-1.5" style={{ animationDelay: '0.2s' }}></span>
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse ml-1.5" style={{ animationDelay: '0.4s' }}></span>
                    </div>
                </div>
            )}
             <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 flex-shrink-0 flex items-center gap-2">
            <div className="relative flex-grow">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Hỏi Em điều gì đó..."
                    className="w-full bg-[#293548] text-slate-200 border border-slate-600 focus:border-primary-500 focus:ring-0 rounded-lg px-4 py-2 transition text-sm pr-12"
                    disabled={isLoading}
                />
                 {hasSpeechRecognitionSupport && (
                    <button
                        type="button"
                        onClick={isListening ? stopListening : startListening}
                        className={`absolute top-1/2 right-3 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                            isListening ? 'bg-red-600 text-white animate-pulse' : 'text-slate-400 hover:text-white'
                        }`}
                        title={isListening ? "Dừng ghi âm" : "Nói chuyện với Em"}
                    >
                        <Mic size={18} />
                    </button>
                )}
            </div>
            <button type="submit" disabled={isLoading || !inputValue.trim()} className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-lg transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
        </form>
    </div>
  );
};

export default ChatAssistant;
