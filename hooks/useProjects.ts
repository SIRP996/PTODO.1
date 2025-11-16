
import { useState, useEffect, useCallback } from 'react';
import { Project, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  deleteDoc,
  updateDoc,
  deleteField,
  getDocs,
  arrayRemove,
  writeBatch,
  documentId,
} from 'firebase/firestore';
import { useToast } from '../context/ToastContext';

const PROJECT_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#22c55e', // green
  '#a855f7', // purple
  '#14b8a6', // teal
  '#3b82f6', // blue
];

// Custom hook to fetch and cache user profiles
export const useUserProfiles = (userIds: string[]) => {
    const { currentUser, userSettings } = useAuth();
    const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchProfiles = async () => {
            const idsToFetch = [...new Set(userIds)];

            if (idsToFetch.length === 0) {
                // If there are no userIds, but we have a currentUser, we should still ensure their profile is in the map.
                if (currentUser) {
                    const photoURL = userSettings?.avatarUrl || userSettings?.photoURL || currentUser.photoURL;
                    const newProfiles = new Map<string, UserProfile>();
                    newProfiles.set(currentUser.uid, {
                        uid: currentUser.uid,
                        displayName: userSettings?.displayName || currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Current User'),
                        email: currentUser.email || 'N/A',
                        photoURL: photoURL,
                    });
                    setProfiles(newProfiles);
                } else {
                    setProfiles(new Map());
                }
                return;
            }

            setLoading(true);
            try {
                const newProfiles = new Map<string, UserProfile>();

                // Fetch profiles from Firestore in chunks
                for (let i = 0; i < idsToFetch.length; i += 30) {
                    const chunk = idsToFetch.slice(i, i + 30);
                    if (chunk.length === 0) continue;
                    
                    const usersQuery = query(collection(db, "users"), where(documentId(), "in", chunk));
                    const querySnapshot = await getDocs(usersQuery);
                    
                    querySnapshot.forEach(docSnap => {
                        const data = docSnap.data();
                        newProfiles.set(docSnap.id, {
                            uid: docSnap.id,
                            displayName: data.displayName || (data.email ? data.email.split('@')[0] : 'Unnamed User'),
                            email: data.email || 'N/A',
                            photoURL: data.photoURL,
                        });
                    });
                }
                
                // Add placeholders for any IDs that were not found
                idsToFetch.forEach(id => {
                    if (!newProfiles.has(id)) {
                         newProfiles.set(id, {
                            uid: id,
                            displayName: 'Unnamed User',
                            email: 'N/A',
                            photoURL: null,
                        });
                    }
                });

                // Finally, ensure the current user's data is correct, using real-time userSettings.
                // This overwrites any potentially stale data from the one-time fetch.
                if (currentUser) {
                    const photoURL = userSettings?.avatarUrl || userSettings?.photoURL || currentUser.photoURL;
                    const existingProfile = newProfiles.get(currentUser.uid);
                    
                    newProfiles.set(currentUser.uid, {
                        ...existingProfile,
                        uid: currentUser.uid,
                        displayName: userSettings?.displayName || currentUser.displayName || existingProfile?.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Current User'),
                        email: currentUser.email || existingProfile?.email || 'N/A',
                        photoURL: photoURL,
                    });
                }
                
                setProfiles(newProfiles);

            } catch (error) {
                console.error("Error fetching user profiles:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfiles();
    }, [JSON.stringify(userIds), currentUser, userSettings]);

    return { profiles, loading };
};


export const useProjects = () => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (!currentUser) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const projectsMap = new Map<string, Project>();

    const updateStateFromMap = () => {
        const allProjects = Array.from(projectsMap.values());
        allProjects.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setProjects(allProjects);
    };

    const newModelQuery = query(collection(db, 'projects'), where('memberIds', 'array-contains', currentUser.uid));
    const unsubNew = onSnapshot(newModelQuery, (snapshot) => {
        snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            projectsMap.set(docSnap.id, {
                id: docSnap.id,
                name: data.name,
                ownerId: data.ownerId,
                memberIds: data.memberIds || [],
                createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                color: data.color,
                isVisible: data.isVisible,
            } as Project);
        });
        updateStateFromMap();
        setLoading(false);
    }, (error) => {
        console.error("Error fetching projects (new model):", error);
        addToast("Không thể tải một số dự án.", "error");
        setLoading(false);
    });

    const oldModelQuery = query(collection(db, 'projects'), where('userId', '==', currentUser.uid));
    const unsubOld = onSnapshot(oldModelQuery, (snapshot) => {
        let hasChanges = false;
        snapshot.docs.forEach((docSnap) => {
            if (!projectsMap.has(docSnap.id)) {
                hasChanges = true;
                const data = docSnap.data();
                // Normalize old project data model to the new one on the fly.
                // This ensures the rest of the app can work with a consistent data structure.
                const normalizedProject: Project = {
                    id: docSnap.id,
                    name: data.name,
                    ownerId: data.ownerId || data.userId, // Use userId as ownerId for old projects
                    memberIds: data.memberIds || [data.userId], // Initialize memberIds with the owner
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                    color: data.color,
                    isVisible: data.isVisible,
                };
                projectsMap.set(docSnap.id, normalizedProject);
            }
        });
        if (hasChanges) {
            updateStateFromMap();
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching projects (old model):", error);
        setLoading(false);
    });

    return () => {
      unsubNew();
      unsubOld();
    };
  }, [currentUser, addToast]);

  const addProject = useCallback(async (name: string): Promise<string | undefined> => {
    if (!currentUser) {
      addToast("Bạn cần đăng nhập để tạo dự án.", "error");
      return undefined;
    }
    if (!name.trim()) {
      addToast("Tên dự án không được để trống.", "warn");
      return undefined;
    }

    try {
      const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
      const docRef = await addDoc(collection(db, 'projects'), {
        name,
        ownerId: currentUser.uid,
        memberIds: [currentUser.uid],
        createdAt: serverTimestamp(),
        color: color,
        isVisible: true,
      });
      addToast(`Đã tạo dự án "${name}"!`, 'success');
      return docRef.id;
    } catch (error) {
      console.error("Error adding project: ", error);
      addToast("Không thể tạo dự án.", 'error');
      return undefined;
    }
  }, [currentUser, addToast]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (!currentUser) {
      addToast("Bạn cần đăng nhập để xóa dự án.", "error");
      return;
    }
    try {
      const batch = writeBatch(db);

      // Delete associated tasks
      const tasksQuery = query(collection(db, 'tasks'), where('projectId', '==', projectId));
      const tasksSnapshot = await getDocs(tasksQuery);
      tasksSnapshot.forEach(doc => {
          batch.delete(doc.ref);
      });

      // Delete associated chat room
      const chatRoomsQuery = query(collection(db, 'chatRooms'), where('projectId', '==', projectId));
      const chatRoomsSnapshot = await getDocs(chatRoomsQuery);
      chatRoomsSnapshot.forEach(doc => {
          // This will remove the chat room from the UI, but its subcollection of messages will be orphaned.
          // For a full cleanup, a Cloud Function triggered on chatRoom deletion is recommended.
          batch.delete(doc.ref);
      });

      // Delete the project itself
      batch.delete(doc(db, 'projects', projectId));
      
      await batch.commit();
      addToast("Đã xóa dự án và tất cả công việc liên quan.", 'success');
    } catch (error) {
      console.error("Error deleting project: ", error);
      addToast("Không thể xóa dự án.", 'error');
    }
  }, [currentUser, addToast]);

  const updateProject = useCallback(async (projectId: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
    if (!currentUser) {
      addToast("Bạn cần đăng nhập để sửa dự án.", "error");
      return;
    }
    if (data.name !== undefined && !data.name.trim()) {
      addToast("Tên dự án không được để trống.", "warn");
      return;
    }

    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectToUpdate = projects.find(p => p.id === projectId);
      
      const updateData: {[key: string]: any} = { ...data };

      if (projectToUpdate && (projectToUpdate as any).userId && !projectToUpdate.memberIds) {
          updateData.memberIds = [(projectToUpdate as any).userId];
          updateData.ownerId = (projectToUpdate as any).userId;
          updateData.userId = deleteField();
      }

      await updateDoc(projectRef, updateData);
      addToast("Đã cập nhật dự án.", 'success');
    } catch (error) {
      console.error("Error updating project: ", error);
      addToast("Không thể cập nhật dự án.", 'error');
    }
  }, [currentUser, addToast, projects]);

  const inviteUserToProject = useCallback(async (project: Project, inviteeEmail: string) => {
    if (!currentUser) return;
    if (inviteeEmail === currentUser.email) {
        addToast("Bạn không thể mời chính mình.", "warn");
        return;
    }

    try {
        const usersQuery = await getDocs(query(collection(db, 'users'), where('email', '==', inviteeEmail)));
        if (!usersQuery.empty) {
            const inviteeUser = usersQuery.docs[0];
            if (project.memberIds.includes(inviteeUser.id)) {
                addToast("Người dùng này đã là thành viên của dự án.", "info");
                return;
            }
        }

        const existingInvitationQuery = await getDocs(query(
            collection(db, 'invitations'),
            where('projectId', '==', project.id),
            where('inviteeEmail', '==', inviteeEmail),
            where('status', '==', 'pending')
        ));

        if (!existingInvitationQuery.empty) {
            addToast("Đã có lời mời đang chờ gửi đến người dùng này.", "info");
            return;
        }

        await addDoc(collection(db, 'invitations'), {
            projectId: project.id,
            projectName: project.name,
            inviterId: currentUser.uid,
            inviterName: currentUser.displayName || currentUser.email,
            inviteeEmail: inviteeEmail,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        addToast(`Đã gửi lời mời đến ${inviteeEmail}! Email sẽ được gửi ngay sau đây.`, 'success');
    } catch (error) {
        addToast("Không thể gửi lời mời.", 'error');
    }
  }, [currentUser, addToast]);

  const removeUserFromProject = useCallback(async (projectId: string, userId: string) => {
    try {
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, {
        memberIds: arrayRemove(userId),
      });
      addToast("Đã xóa thành viên khỏi dự án.", 'success');
    } catch (error) {
      addToast("Không thể xóa thành viên.", 'error');
    }
  }, [addToast]);

  const cancelInvitation = useCallback(async (invitationId: string) => {
    try {
        await deleteDoc(doc(db, 'invitations', invitationId));
        addToast("Đã hủy lời mời.", 'success');
    } catch (error) {
        addToast("Không thể hủy lời mời.", 'error');
    }
  }, [addToast]);


  return { projects, addProject, loading, deleteProject, updateProject, inviteUserToProject, removeUserFromProject, cancelInvitation };
};
