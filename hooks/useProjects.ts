import { useState, useEffect, useCallback } from 'react';
import { Project } from '../types';
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
                ...data,
                createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                memberIds: data.memberIds || [],
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
                projectsMap.set(docSnap.id, {
                    id: docSnap.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                    memberIds: data.memberIds || [],
                } as Project);
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
      await deleteDoc(doc(db, 'projects', projectId));
      addToast("Đã xóa dự án.", 'success');
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
        if (usersQuery.empty) {
            addToast(`Không tìm thấy người dùng với email: ${inviteeEmail}`, 'error');
            return;
        }
        const inviteeUser = usersQuery.docs[0];
        if (project.memberIds.includes(inviteeUser.id)) {
            addToast("Người dùng này đã là thành viên của dự án.", "info");
            return;
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
        addToast(`Đã gửi lời mời đến ${inviteeEmail}!`, 'success');
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