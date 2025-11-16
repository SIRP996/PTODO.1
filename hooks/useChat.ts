

import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDoc,
  getDocs,
  limit,
  setDoc,
} from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { ChatRoom, ChatMessage, Project, Task, UserProfile } from '../types';

export const useChat = (currentUser: User | null, projects: Project[], activeRoomId?: string | null) => {
  const [projectChatRooms, setProjectChatRooms] = useState<ChatRoom[]>([]);
  const [dmChatRooms, setDmChatRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { addToast } = useToast();

  // Fetch all chat rooms (projects and DMs)
  useEffect(() => {
    if (!currentUser) {
      setLoadingRooms(false);
      return;
    }

    const q = query(
      collection(db, 'chatRooms'),
      where('memberIds', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const rooms: ChatRoom[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as ChatRoom));

      // Separate rooms and enrich DM rooms with profile data
      const projectRooms: ChatRoom[] = [];
      const dms: ChatRoom[] = [];

      for (const room of rooms) {
        if (room.type === 'project') {
          projectRooms.push(room);
        } else if (room.type === 'dm') {
          const otherMemberId = room.memberIds.find(id => id !== currentUser.uid);
          if (otherMemberId && !room.memberProfiles?.[otherMemberId]) {
            const userDoc = await getDoc(doc(db, 'users', otherMemberId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                room.memberProfiles = {
                    ...room.memberProfiles,
                    [otherMemberId]: {
                        displayName: userData.displayName || 'Unknown',
                        photoURL: userData.photoURL || null,
                    }
                }
            }
          }
          room.name = room.memberProfiles?.[otherMemberId!]?.displayName || "Tin nhắn";
          dms.push(room);
        }
      }

      setProjectChatRooms(projectRooms.sort((a,b) => a.name.localeCompare(b.name)));
      setDmChatRooms(dms.sort((a,b) => a.name.localeCompare(b.name)));
      setLoadingRooms(false);
    }, (error) => {
      console.error("Error fetching chat rooms:", error);
      addToast("Không thể tải danh sách phòng chat.", "error");
      setLoadingRooms(false);
    });

    return () => unsubscribe();
  }, [currentUser, addToast]);

  // Fetch messages for the active room
  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const messagesQuery = query(
      collection(db, 'chatRooms', activeRoomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
      } as ChatMessage));
      setMessages(msgs);
      setLoadingMessages(false);
    }, (error) => {
      console.error("Error fetching messages:", error);
      addToast("Không thể tải tin nhắn.", "error");
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [activeRoomId, addToast]);
  
  const sendMessage = useCallback(async (roomId: string, text: string, onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>) => {
    if (!currentUser || !text.trim()) return;

    try {
      const messageData = {
        roomId,
        senderId: currentUser.uid,
        text: text.trim(),
        createdAt: serverTimestamp(),
        isDeleted: false,
      };
      
      const batch = writeBatch(db);
      
      // Add message
      const messageRef = doc(collection(db, 'chatRooms', roomId, 'messages'));
      batch.set(messageRef, messageData);
      
      // Update last message in room
      const roomRef = doc(db, 'chatRooms', roomId);
      batch.update(roomRef, {
        lastMessage: {
            text: text.trim(),
            senderId: currentUser.uid,
            createdAt: serverTimestamp()
        }
      });
      
      // Handle task assignment via mention
      const userMentionRegex = /\[user:([^\]]+?) text:"[^"]+"\]/g;
      const taskMentionRegex = /\[task:([^\]]+?) text:"[^"]+"\]/g;
      const userMentions = [...text.matchAll(userMentionRegex)].map(m => m[1]);
      const taskMentions = [...text.matchAll(taskMentionRegex)].map(m => m[1]);
      
      if (userMentions.length > 0 && taskMentions.length > 0) {
        for (const taskId of taskMentions) {
            const taskDocRef = doc(db, 'tasks', taskId);
            const taskDoc = await getDoc(taskDocRef);
            if (taskDoc.exists()) {
                const taskData = taskDoc.data();
                const currentAssignees = taskData.assigneeIds || [];
                const newAssignees = [...new Set([...currentAssignees, ...userMentions])];
                if (newAssignees.length > currentAssignees.length) {
                    onUpdateTask(taskId, { assigneeIds: newAssignees });
                    addToast(`Đã giao việc cho thành viên được nhắc đến.`, 'info');
                }
            }
        }
      }

      await batch.commit();

    } catch (error) {
      console.error("Error sending message:", error);
      addToast("Không thể gửi tin nhắn.", "error");
    }
  }, [currentUser, addToast]);

  const deleteMessage = useCallback(async (roomId: string, messageId: string) => {
    try {
      const messageRef = doc(db, 'chatRooms', roomId, 'messages', messageId);
      await updateDoc(messageRef, {
        text: 'Tin nhắn đã được thu hồi',
        isDeleted: true,
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      addToast("Không thể xóa tin nhắn.", "error");
    }
  }, [addToast]);
  
  const createDmRoom = useCallback(async (targetUser: UserProfile): Promise<ChatRoom | null> => {
    if (!currentUser) return null;

    const memberIds = [currentUser.uid, targetUser.uid].sort();
    const roomId = `dm_${memberIds[0]}_${memberIds[1]}`;
    
    const roomRef = doc(db, 'chatRooms', roomId);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
        return { id: roomSnap.id, ...roomSnap.data() } as ChatRoom;
    } else {
        const newRoomData: Omit<ChatRoom, 'id'> = {
            type: 'dm',
            memberIds,
            memberProfiles: {
                [currentUser.uid]: {
                    displayName: currentUser.displayName || 'Me',
                    photoURL: currentUser.photoURL,
                },
                [targetUser.uid]: {
                    displayName: targetUser.displayName,
                    photoURL: targetUser.photoURL,
                }
            },
            name: targetUser.displayName,
        };
        await setDoc(roomRef, newRoomData);
        return { id: roomId, ...newRoomData };
    }
  }, [currentUser]);

  return {
    projectChatRooms,
    dmChatRooms,
    loadingRooms,
    messages,
    loadingMessages,
    sendMessage,
    deleteMessage,
    createDmRoom,
  };
};
