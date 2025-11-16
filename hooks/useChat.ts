import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  writeBatch,
  Timestamp,
  getDocs,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { ChatRoom, Project, UserProfile } from '../types';
import { useToast } from '../context/ToastContext';

export const useChat = (currentUser: User | null, projects: Project[], profiles: Map<string, UserProfile>) => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Effect to create project-based chat rooms if they don't exist
  useEffect(() => {
    if (!currentUser || projects.length === 0) return;

    const ensureProjectChats = async () => {
      const batch = writeBatch(db);
      let batchHasWrites = false;

      for (const project of projects) {
        const chatRoomsRef = collection(db, 'chatRooms');
        const q = query(
          chatRoomsRef,
          where('projectId', '==', project.id),
          where('type', '==', 'project'),
          limit(1)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          const newChatRoomRef = doc(collection(db, 'chatRooms'));
          batch.set(newChatRoomRef, {
            name: project.name,
            memberIds: project.memberIds,
            type: 'project',
            projectId: project.id,
            createdAt: serverTimestamp(),
          });
          batchHasWrites = true;
        } else {
            // Ensure members are up to date
            const chatDoc = snapshot.docs[0];
            const chatData = chatDoc.data();
            const currentMembers = new Set(chatData.memberIds);
            const projectMembers = new Set(project.memberIds);
            if (currentMembers.size !== projectMembers.size || !project.memberIds.every(id => currentMembers.has(id))) {
                batch.update(chatDoc.ref, { memberIds: project.memberIds });
                batchHasWrites = true;
            }
        }
      }

      if (batchHasWrites) {
        try {
          await batch.commit();
        } catch (error) {
          console.error("Error ensuring project chats:", error);
        }
      }
    };

    ensureProjectChats();
  }, [currentUser, projects]);

  // Effect to subscribe to user's chat rooms
  useEffect(() => {
    if (!currentUser) {
      setChatRooms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'chatRooms'),
      where('memberIds', 'array-contains', currentUser.uid)
      // orderBy('lastMessage.timestamp', 'desc') // This is not allowed with array-contains and requires an index. Sorting is now done client-side.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
          lastMessage: data.lastMessage ? {
              ...data.lastMessage,
              timestamp: (data.lastMessage.timestamp as Timestamp)?.toDate().toISOString(),
          } : undefined,
        } as ChatRoom;
      });

      // Sort on the client side as Firestore doesn't allow ordering on a different field than the array-contains
      rooms.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });

      setChatRooms(rooms);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching chat rooms:", error);
      addToast("Không thể tải danh sách trò chuyện.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, addToast]);

  const createChat = useCallback(async (
    memberIds: string[], 
    type: 'dm' | 'group', 
    name?: string
  ): Promise<string | null> => {
    if (!currentUser || memberIds.length === 0) return null;

    const allMemberIds = [...new Set([currentUser.uid, ...memberIds])];
    
    // For DMs, check if a room already exists
    if (type === 'dm' && allMemberIds.length === 2) {
      const dmUserIds = allMemberIds.sort();
      const q = query(
        collection(db, 'chatRooms'),
        where('type', '==', 'dm'),
        where('dmUserIds', '==', dmUserIds)
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        return existing.docs[0].id;
      }
    }
    
    try {
      let chatName = name;
      if (!chatName) {
        if (type === 'dm') {
          const otherUserId = allMemberIds.find(id => id !== currentUser.uid);
          const otherProfile = profiles.get(otherUserId!);
          chatName = otherProfile?.displayName || 'Trò chuyện';
        } else {
          chatName = allMemberIds
            .map(id => profiles.get(id)?.displayName || 'Người dùng')
            .slice(0, 3)
            .join(', ');
        }
      }

      const docData: any = {
        name: chatName,
        memberIds: allMemberIds,
        type,
        createdAt: serverTimestamp(),
      };

      if (type === 'dm') {
        docData.dmUserIds = allMemberIds.sort();
      }

      const docRef = await addDoc(collection(db, 'chatRooms'), docData);
      addToast('Đã tạo cuộc trò chuyện mới!', 'success');
      return docRef.id;
    } catch (error) {
      console.error("Error creating chat:", error);
      addToast("Không thể tạo cuộc trò chuyện.", "error");
      return null;
    }
  }, [currentUser, addToast, profiles]);

  return { chatRooms, loading, createChat };
};
