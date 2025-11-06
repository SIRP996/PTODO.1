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
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const projectsData: Project[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        projectsData.push({
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as Project);
      });
      projectsData.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setProjects(projectsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching projects: ", error);
      addToast("Không thể tải danh sách dự án.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, addToast]);

  const addProject = useCallback(async (name: string) => {
    if (!currentUser) {
      addToast("Bạn cần đăng nhập để tạo dự án.", "error");
      return;
    }
    if (!name.trim()) {
      addToast("Tên dự án không được để trống.", "warn");
      return;
    }

    try {
      const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
      await addDoc(collection(db, 'projects'), {
        name,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
        color: color,
        isVisible: true,
      });
      addToast(`Đã tạo dự án "${name}"!`, 'success');
    } catch (error) {
      console.error("Error adding project: ", error);
      addToast("Không thể tạo dự án.", 'error');
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

  const updateProject = useCallback(async (projectId: string, data: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>) => {
    if (!currentUser) {
      addToast("Bạn cần đăng nhập để sửa dự án.", "error");
      return;
    }
    if (data.name !== undefined && !data.name.trim()) {
      addToast("Tên dự án không được để trống.", "warn");
      return;
    }

    try {
      await updateDoc(doc(db, 'projects', projectId), data);
      addToast("Đã cập nhật dự án.", 'success');
    } catch (error) {
      console.error("Error updating project: ", error);
      addToast("Không thể cập nhật dự án.", 'error');
    }
  }, [currentUser, addToast]);


  return { projects, addProject, loading, deleteProject, updateProject };
};