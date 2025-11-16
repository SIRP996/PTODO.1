import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { ChatRoom, ChatMessage, UserProfile, Task, Project } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, Timestamp, getDocs, writeBatch, deleteField, limit, arrayUnion } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import Message from './Message';
import MessageInput from './MessageInput';
import { Loader2, Trash2 } from 'lucide-react';

interface ChatWindowProps {
  room: ChatRoom;
  currentUser: User;
  profiles: Map<string, UserProfile>;
  tasks: Task[];
  projects: Project[];
  notificationSound: HTMLAudioElement | null;
  onAddTask: (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly', projectId?: string) => Promise<string | undefined>;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ room, currentUser, profiles, tasks, projects, notificationSound, onAddTask }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const { addToast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isProjectOwner = useMemo(() => {
    if (room.type !== 'project' || !room.projectId || !currentUser) return false;
    const project = projects.find(p => p.id === room.projectId);
    return project?.ownerId === currentUser.uid;
  }, [room, projects, currentUser]);

  const canClearHistory = room.type !== 'project' || isProjectOwner;

  // Effect to fetch messages, runs only when the room ID changes.
  useEffect(() => {
    setLoading(true);
    setMessages([]); // Clear messages from previous room
    
    const messagesQuery = query(
      collection(db, `chatRooms/${room.id}/messages`),
      orderBy('createdAt', 'desc'),
      limit(50) // Fetch only the last 50 messages for performance
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const userClearedUntilTimestamp = room.clearedUntil?.[currentUser.uid];

      const newMessages = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as ChatMessage;
      })
      .filter(msg => {
        // Filter messages created before the user cleared the chat
        if (userClearedUntilTimestamp && msg.createdAt <= userClearedUntilTimestamp) {
            return false;
        }
        // Filter messages individually deleted by the current user
        if (!msg.deletedFor || !Array.isArray(msg.deletedFor)) {
          return true;
        }
        return !msg.deletedFor.includes(currentUser.uid);
      })
      .reverse(); // Reverse to show in chronological order
      
      setMessages(newMessages);

      if(newMessages.length > 0) {
        const latestMessage = newMessages[newMessages.length-1];
        if(latestMessage.senderId !== currentUser.uid) {
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
  }, [room.id, currentUser.uid, addToast, room.clearedUntil]);

  // Effect to mark messages as read.
  useEffect(() => {
    if (!currentUser || !room.lastMessage) return;

    const userLastRead = room.lastRead?.[currentUser.uid];
    const lastMessageTimestamp = room.lastMessage.timestamp;

    // Only mark as read if the last message is from someone else and is newer than our last read timestamp
    if (room.lastMessage.senderId !== currentUser.uid && (!userLastRead || new Date(lastMessageTimestamp) > new Date(userLastRead))) {
        const mark = async () => {
            try {
                const roomRef = doc(db, 'chatRooms', room.id);
                await updateDoc(roomRef, {
                    [`lastRead.${currentUser.uid}`]: new Date().toISOString(),
                });
            } catch (error) {
                console.error("Failed to mark chat as read:", error);
            }
        };
        mark();
    }
  }, [room.id, room.lastMessage, room.lastRead, currentUser]);
  
  // Effect to scroll to the bottom on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
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
    let wasTaskAssigned = false;

    // --- Task creation and assignment logic ---
    if (text.startsWith('#task') && room.type === 'project') {
      const sendAssignmentConfirmation = async (taskText: string, assigneeName: string) => {
        const confirmationText = `Đã giao việc "${taskText}" cho ${assigneeName}.`;
        await addDoc(collection(db, `chatRooms/${room.id}/messages`), {
          roomId: room.id,
          senderId: 'system',
          senderName: 'PTODO Bot',
          senderAvatar: null,
          text: confirmationText,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'chatRooms', room.id), {
          'lastMessage.text': confirmationText,
          'lastMessage.senderId': 'system',
          'lastMessage.senderName': 'PTODO Bot',
          'lastMessage.timestamp': serverTimestamp(),
        });
      };

      const mentionSyntaxRegex = /#task\s+\[user:(\S+)\s+text:"([^"]+)"\]\s*(.+)/s;
      const mentionMatch = text.match(mentionSyntaxRegex);

      if (mentionMatch) {
        const userIdToAssign = mentionMatch[1];
        const usernameToAssign = mentionMatch[2];
        const taskText = mentionMatch[3].trim();
        
        if (room.memberIds.includes(userIdToAssign)) {
            const newTaskId = await onAddTask(taskText, [], null, false, 'none', room.projectId);
            if (newTaskId) {
                await updateDoc(doc(db, 'tasks', newTaskId), { assigneeIds: [userIdToAssign] });
                await sendAssignmentConfirmation(taskText, usernameToAssign);
                wasTaskAssigned = true;
            }
        }
      }

      if (!wasTaskAssigned) {
        const rawTextRegex = /#task\s+@(\S+)\s+(.+)/s;
        const rawMatch = text.match(rawTextRegex);

        if (rawMatch) {
            const usernameToAssign = rawMatch[1];
            const taskText = rawMatch[2].trim();
            const memberToAssign = (Array.from(profiles.values()) as UserProfile[]).find(
                p => p.displayName.toLowerCase() === usernameToAssign.toLowerCase() && room.memberIds.includes(p.uid)
            );

            if (memberToAssign) {
                const newTaskId = await onAddTask(taskText, [], null, false, 'none', room.projectId);
                if (newTaskId) {
                    await updateDoc(doc(db, 'tasks', newTaskId), { assigneeIds: [memberToAssign.uid] });
                    await sendAssignmentConfirmation(taskText, memberToAssign.displayName);
                    wasTaskAssigned = true;
                }
            }
        }
      }
    }
    
    if (wasTaskAssigned) {
      return; 
    }

    // --- Logic to assign an existing task via mentions ---
    const taskMentionRegex = /\[task:(\S+)\s+text:"([^"]+)"\]/;
    const userMentionRegex = /\[user:(\S+)\s+text:"([^"]+)"\]/;

    const taskMatch = text.match(taskMentionRegex);
    const userMatch = text.match(userMentionRegex);

    if (taskMatch && userMatch && room.type === 'project' && room.projectId) {
        const taskId = taskMatch[1];
        const taskName = taskMatch[2];
        const userIdToAssign = userMatch[1];
        const userNameToAssign = userMatch[2];

        const taskToAssign = tasks.find(t => t.id === taskId);
        const userIsMember = room.memberIds.includes(userIdToAssign);

        if (taskToAssign && userIsMember && !taskToAssign.assigneeIds.includes(userIdToAssign)) {
            try {
                const taskRef = doc(db, 'tasks', taskId);
                await updateDoc(taskRef, {
                    assigneeIds: arrayUnion(userIdToAssign)
                });

                const confirmationText = `Đã giao việc "${taskName}" cho ${userNameToAssign}.`;
                const systemMessageRef = doc(collection(db, `chatRooms/${room.id}/messages`));
                const roomRef = doc(db, 'chatRooms', room.id);
                
                const confirmationBatch = writeBatch(db);
                confirmationBatch.set(systemMessageRef, {
                    roomId: room.id,
                    senderId: 'system',
                    senderName: 'PTODO Bot',
                    senderAvatar: null,
                    text: confirmationText,
                    createdAt: serverTimestamp(),
                });
                confirmationBatch.update(roomRef, {
                    'lastMessage.text': confirmationText,
                    'lastMessage.senderId': 'system',
                    'lastMessage.senderName': 'PTODO Bot',
                    'lastMessage.timestamp': serverTimestamp(),
                });
                await confirmationBatch.commit();
                
                addToast(`Đã giao việc "${taskName}" cho ${userNameToAssign}.`, 'success');
            } catch (error) {
                console.error("Error assigning task via mention:", error);
                addToast("Không thể giao việc.", "error");
            }
        }
    }

    // --- Normal message sending ---
    const newMessage: Omit<ChatMessage, 'id' | 'createdAt'> = {
        roomId: room.id,
        senderId: currentUser.uid,
        senderName: currentUserProfile?.displayName || 'Tôi',
        senderAvatar: currentUserProfile?.photoURL || null,
        text: text.trim(),
    };

    try {
        const batch = writeBatch(db);
        
        const messageRef = doc(collection(db, `chatRooms/${room.id}/messages`));
        batch.set(messageRef, {
            ...newMessage,
            createdAt: serverTimestamp(),
        });
        
        const roomRef = doc(db, 'chatRooms', room.id);
        batch.update(roomRef, {
            'lastMessage.text': text.trim(),
            'lastMessage.senderId': newMessage.senderId,
            'lastMessage.senderName': newMessage.senderName,
            'lastMessage.timestamp': serverTimestamp(),
        });
        
        await batch.commit();
    } catch(e) {
        addToast("Không thể gửi tin nhắn.", 'error');
    }
  };
  
  const handleDeleteMessage = async (messageId: string) => {
    try {
        const messageRef = doc(db, `chatRooms/${room.id}/messages`, messageId);
        await updateDoc(messageRef, {
            deletedFor: arrayUnion(currentUser.uid)
        });
    } catch (error) {
        console.error("Error deleting message for user:", error);
        addToast("Không thể xóa tin nhắn.", "error");
    }
  }

  const handleClearHistory = async () => {
    const confirmationMessage = canClearHistory
      ? 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử cuộc trò chuyện này không? Hành động này sẽ xóa cho tất cả thành viên và không thể hoàn tác.'
      : 'Bạn có chắc chắn muốn xóa lịch sử trò chuyện ở phía bạn không? Các thành viên khác vẫn sẽ thấy tin nhắn.';
    
    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setIsClearing(true);
    
    if (canClearHistory) {
        try {
            const messagesCollectionRef = collection(db, `chatRooms/${room.id}/messages`);
            while (true) {
                const q = query(messagesCollectionRef, limit(500));
                const snapshot = await getDocs(q);
                if (snapshot.empty) break;
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
            const roomRef = doc(db, 'chatRooms', room.id);
            await updateDoc(roomRef, {
                lastMessage: deleteField(),
                lastRead: deleteField(),
                clearedUntil: deleteField(),
            });
            addToast('Đã xóa lịch sử trò chuyện cho mọi người.', 'success');
        } catch (error) {
            console.error('Error clearing global chat history:', error);
            addToast('Không thể xóa lịch sử trò chuyện.', 'error');
        } finally {
            setIsClearing(false);
        }
    } else { 
        try {
            const roomRef = doc(db, 'chatRooms', room.id);
            await updateDoc(roomRef, {
                [`clearedUntil.${currentUser.uid}`]: new Date().toISOString()
            });
            addToast('Đã xóa lịch sử trò chuyện của bạn.', 'success');
        } catch (error) {
            console.error('Error clearing local chat history:', error);
            addToast('Không thể xóa lịch sử trò chuyện.', 'error');
        } finally {
            setIsClearing(false);
        }
    }
  };


  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 flex-shrink-0 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-white truncate">{getDisplayName(room)}</h3>
          <p className="text-xs text-slate-400">{room.memberIds.length} thành viên</p>
        </div>
        
        <button onClick={handleClearHistory} disabled={isClearing} className="p-2 text-slate-400 hover:text-red-400 rounded-full transition-colors disabled:cursor-not-allowed disabled:text-slate-600" title="Xóa lịch sử trò chuyện">
          {isClearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
        
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
        <MessageInput
          onSendMessage={handleSendMessage}
          tasks={tasks}
          members={room.memberIds.map(id => profiles.get(id)).filter(Boolean) as UserProfile[]}
          projectId={room.type === 'project' ? room.projectId : undefined}
        />
      </div>
    </div>
  );
};

export default ChatWindow;