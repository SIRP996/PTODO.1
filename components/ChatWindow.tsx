import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { ChatRoom, ChatMessage, UserProfile, Task } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import Message from './Message';
import MessageInput from './MessageInput';
import { Loader2 } from 'lucide-react';

interface ChatWindowProps {
  room: ChatRoom;
  currentUser: User;
  profiles: Map<string, UserProfile>;
  tasks: Task[];
  notificationSound: HTMLAudioElement | null;
  onAddTask: (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly', projectId?: string) => Promise<string | undefined>;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ room, currentUser, profiles, tasks, notificationSound, onAddTask }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const messagesQuery = query(
      collection(db, `chatRooms/${room.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const newMessages = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          // FIX: Convert Firestore Timestamp to ISO string to prevent date parsing errors
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as ChatMessage;
      });
      
      const lastVisible = messages.length > 0 ? messages[messages.length - 1] : null;

      setMessages(newMessages);
      
      if(newMessages.length > 0) {
        const latestMessage = newMessages[newMessages.length-1];
        if(latestMessage.senderId !== currentUser.uid && (!lastVisible || latestMessage.id !== lastVisible.id)) {
            notificationSound?.play().catch(e => console.error("Error playing sound:", e));
            if(document.hidden && Notification.permission === 'granted') {
                new Notification(`Tin nhắn mới từ ${latestMessage.senderName}`, {
                    body: latestMessage.text,
                    icon: latestMessage.senderAvatar || '/vite.svg',
                });
            }
        }
      }

      setLoading(false);
    }, (error) => {
      console.error(`Error fetching messages for room ${room.id}:`, error);
      addToast("Không thể tải tin nhắn.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [room.id, currentUser.uid, notificationSound]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getDisplayName = (room: ChatRoom) => {
    if (room.type !== 'dm' || !currentUser) return room.name;
    const otherUserId = room.memberIds.find(id => id !== currentUser.uid);
    if (!otherUserId) return room.name;
    return profiles.get(otherUserId)?.displayName || room.name;
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const currentUserProfile = profiles.get(currentUser.uid);

    // --- Task assignment logic ---
    const assignmentRegex = /#task\s+@(\S+)/;
    const match = text.match(assignmentRegex);
    if (match && match[1] && room.type === 'project') {
      const usernameToAssign = match[1];
      // FIX: Explicitly cast Array.from(profiles.values()) to UserProfile[] to resolve type inference issues.
      const memberToAssign = (Array.from(profiles.values()) as UserProfile[]).find(p => p.displayName === usernameToAssign && room.memberIds.includes(p.uid));

      if (memberToAssign) {
        const taskText = text.replace(assignmentRegex, '').trim();
        const newTaskId = await onAddTask(taskText, [], null, false, 'none', room.projectId);
        if (newTaskId) {
            await updateDoc(doc(db, 'tasks', newTaskId), { assigneeIds: [memberToAssign.uid] });
            const confirmationText = `Đã giao việc "${taskText}" cho ${memberToAssign.displayName}.`;
            // Send a system message confirming assignment
            await addDoc(collection(db, `chatRooms/${room.id}/messages`), {
              roomId: room.id,
              senderId: 'system',
              senderName: 'PTODO Bot',
              senderAvatar: null,
              text: confirmationText,
              createdAt: serverTimestamp(),
            });
            // Also update last message
             await updateDoc(doc(db, 'chatRooms', room.id), {
                'lastMessage.text': confirmationText,
                'lastMessage.senderName': 'PTODO Bot',
                'lastMessage.timestamp': serverTimestamp(),
            });
            return;
        }
      }
    }
    // --- End task assignment logic ---

    const newMessage: Omit<ChatMessage, 'id' | 'createdAt'> = {
        roomId: room.id,
        senderId: currentUser.uid,
        senderName: currentUserProfile?.displayName || 'Tôi',
        senderAvatar: currentUserProfile?.photoURL || null,
        text: text.trim(),
    };

    try {
        await addDoc(collection(db, `chatRooms/${room.id}/messages`), {
            ...newMessage,
            createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'chatRooms', room.id), {
            'lastMessage.text': text.trim(),
            'lastMessage.senderName': newMessage.senderName,
            'lastMessage.timestamp': serverTimestamp(),
        });
    } catch(e) {
        addToast("Không thể gửi tin nhắn.", 'error');
    }
  };
  
  const handleDeleteMessage = async (messageId: string) => {
    await deleteDoc(doc(db, `chatRooms/${room.id}/messages`, messageId));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 flex-shrink-0">
        <h3 className="font-bold text-white truncate">{getDisplayName(room)}</h3>
        <p className="text-xs text-slate-400">{room.memberIds.length} thành viên</p>
      </div>
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {loading ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
          </div>
        ) : (
          messages.map((msg, index) => (
            <Message
              key={msg.id}
              message={msg}
              currentUser={currentUser}
              onDelete={handleDeleteMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-white/10 flex-shrink-0">
        <MessageInput onSendMessage={handleSendMessage} tasks={tasks} members={room.memberIds.map(id => profiles.get(id)).filter(Boolean) as UserProfile[]} />
      </div>
    </div>
  );
};

export default ChatWindow;