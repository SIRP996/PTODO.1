import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Task, Project, UserProfile, ChatRoom } from '../types';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { MessageSquare, Loader2, X, PanelLeft, Minus, Maximize2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface ChatPageProps {
  onClose: () => void;
  tasks: Task[];
  projects: Project[];
  profiles: Map<string, UserProfile>;
  currentUser: User | null;
  allUsers: UserProfile[];
  notificationSound: HTMLAudioElement | null;
  onAddTask: (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly', projectId?: string) => Promise<string | undefined>;
  chatRooms: ChatRoom[];
  loadingRooms: boolean;
  createChat: (memberIds: string[], type: 'dm' | 'group', name?: string) => Promise<string | null>;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
}

const ChatPage: React.FC<ChatPageProps> = ({ 
    onClose,
    tasks, 
    projects, 
    profiles,
    currentUser,
    allUsers,
    notificationSound,
    onAddTask,
    chatRooms,
    loadingRooms,
    createChat,
    selectedRoomId,
    onSelectRoom
}) => {
  const [isChatListVisible, setIsChatListVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const selectedRoom = useMemo(() => {
    return chatRooms.find(room => room.id === selectedRoomId);
  }, [selectedRoomId, chatRooms]);

  if (!currentUser) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50 animate-fadeIn">
        <div className={`bg-[#1E293B] border border-white/10 w-[80vw] max-w-2xl rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${isMinimized ? 'h-auto' : 'h-[75vh] max-h-[650px]'}`}>
            <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0">
                 <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><MessageSquare size={20} /> Trò chuyện</h3>
                    {!isMinimized && (
                        <button onClick={() => setIsChatListVisible(p => !p)} className="text-slate-400 hover:text-white" title={isChatListVisible ? "Ẩn menu" : "Hiện menu"}>
                            <PanelLeft size={20} className={`transition-transform duration-300 ${isChatListVisible ? '' : 'rotate-180'}`}/>
                        </button>
                    )}
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setIsMinimized(p => !p)} className="text-slate-400 hover:text-white" title={isMinimized ? "Mở rộng" : "Thu nhỏ"}>
                        {isMinimized ? <Maximize2 size={16} /> : <Minus size={20} />}
                    </button>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
                 </div>
            </div>
            <div className={`flex flex-grow overflow-hidden ${isMinimized ? 'hidden' : ''}`}>
                <aside className={`flex-shrink-0 border-r border-white/10 transition-all duration-300 ${isChatListVisible ? 'w-60' : 'w-0 overflow-hidden'}`}>
                    <ChatList
                        rooms={chatRooms}
                        currentUser={currentUser}
                        profiles={profiles}
                        allUsers={allUsers}
                        onSelectRoom={onSelectRoom}
                        selectedRoomId={selectedRoomId}
                        onCreateChat={createChat}
                        projects={projects}
                    />
                </aside>

                <main className="flex-grow flex flex-col">
                    {loadingRooms ? (
                        <div className="flex-grow flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                        </div>
                    ) : selectedRoomId && selectedRoom ? (
                      <ChatWindow
                        key={selectedRoomId}
                        room={selectedRoom}
                        currentUser={currentUser}
                        profiles={profiles}
                        tasks={tasks}
                        projects={projects}
                        notificationSound={notificationSound}
                        onAddTask={onAddTask}
                      />
                    ) : (
                      <div className="flex-grow flex items-center justify-center text-slate-500 flex-col px-4 text-center">
                        <MessageSquare size={48} />
                        <p className="mt-4 text-lg">Chọn một cuộc trò chuyện để bắt đầu</p>
                      </div>
                    )}
                </main>
            </div>
        </div>
    </div>
  );
};

export default ChatPage;