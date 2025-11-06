import { useState, useEffect, useCallback } from 'react';
import { TaskTemplate } from '../types';
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

export const useTaskTemplates = () => {
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (!currentUser) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'taskTemplates'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const templatesData: TaskTemplate[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        templatesData.push({
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as TaskTemplate);
      });
      templatesData.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setTemplates(templatesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching templates: ", error);
      addToast("Không thể tải danh sách mẫu công việc.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, addToast]);

  const addTemplate = useCallback(async (template: Omit<TaskTemplate, 'id' | 'createdAt' | 'userId'>) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'taskTemplates'), {
        ...template,
        userId: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      addToast(`Đã tạo mẫu "${template.name}"!`, 'success');
    } catch (error) {
      console.error("Error adding template: ", error);
      addToast("Không thể tạo mẫu công việc.", 'error');
    }
  }, [currentUser, addToast]);

  const updateTemplate = useCallback(async (templateId: string, data: Partial<Omit<TaskTemplate, 'id' | 'userId' | 'createdAt'>>) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'taskTemplates', templateId), data);
      addToast("Đã cập nhật mẫu công việc.", 'success');
    } catch (error) {
      console.error("Error updating template: ", error);
      addToast("Không thể cập nhật mẫu công việc.", 'error');
    }
  }, [currentUser, addToast]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'taskTemplates', templateId));
      addToast("Đã xóa mẫu công việc.", 'success');
    } catch (error) {
      console.error("Error deleting template: ", error);
      addToast("Không thể xóa mẫu công việc.", 'error');
    }
  }, [currentUser, addToast]);

  return { templates, addTemplate, updateTemplate, deleteTemplate, loading };
};
