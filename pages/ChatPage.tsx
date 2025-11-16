import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Task, Project, UserProfile, ChatRoom } from '../types';
import { useChat } from '../hooks/useChat';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { MessageSquare, Loader2, X } from 'lucide-react';
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
}

const ChatPage: React.FC<ChatPageProps> = ({ 
    onClose,
    tasks, 
    projects, 
    profiles,
    currentUser,
    allUsers,
    notificationSound,
    onAddTask
}) => {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  
  const { 
    chatRooms, 
    loading: loadingRooms, 
    createChat 
  } = useChat(currentUser, projects, profiles);
  const { addToast } = useToast();
  const prevRoomsRef = useRef<ChatRoom[]>([]);


  const selectedRoom = useMemo(() => {
    return chatRooms.find(room => room.id === selectedRoomId);
  }, [selectedRoomId, chatRooms]);

  useEffect(() => {
    // Simple diffing to find new messages for toast notifications
    const oldRoomsMap = new Map(prevRoomsRef.current.map(room => [room.id, room]));
    
    chatRooms.forEach(newRoom => {
        const oldRoom = oldRoomsMap.get(newRoom.id);
        
        // FIX: The logic to detect a new message was complex and potentially unsafe.
        // This simplified logic is safer and correctly handles new rooms, rooms with their first message, and rooms with updated messages.
        // It also helps TypeScript correctly narrow the type of `newRoom.lastMessage`.
        const hasNewMessage = newRoom.lastMessage && (newRoom.lastMessage.timestamp !== oldRoom?.lastMessage?.timestamp);

        if (hasNewMessage) {
            // FIX: The `hasNewMessage` check above guarantees that `newRoom.lastMessage` is not null, so the non-null assertion `!` is not needed and can be safely removed.
            if (newRoom.lastMessage.senderId !== currentUser?.uid && newRoom.id !== selectedRoomId) {
                const senderName = newRoom.lastMessage.senderName;
                addToast(`Tin nhắn mới từ ${senderName}`, 'info');
                notificationSound?.play().catch(e => console.error("Sound play failed", e));
            }
        }
    });

    prevRoomsRef.current = chatRooms;
  }, [chatRooms, selectedRoomId, currentUser, addToast, notificationSound]);

  if (!currentUser) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50 animate-fadeIn">
        <div className="bg-[#1E293B] border border-white/10 w-[80vw] max-w-2xl h-[75vh] max-h-[650px] rounded-2xl shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-white/10 flex-shrink-0">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2"><MessageSquare size={20} /> Trò chuyện</h3>
                 <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
            </div>
            <div className="flex flex-grow overflow-hidden">
                <aside className="w-60 flex-shrink-0 border-r border-white/10">
                    <ChatList
                        rooms={chatRooms}
                        currentUser={currentUser}
                        profiles={profiles}
                        allUsers={allUsers}
                        onSelectRoom={setSelectedRoomId}
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
