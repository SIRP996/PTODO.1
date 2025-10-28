
import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus } from '../types';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
// Fix: Import firebase for Timestamp and FieldValue, and import firestore for side effects to use v8 compat API.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { useToast } from '../context/ToastContext';
import { v4 as uuidv4 } from 'uuid';


export const useTasks = () => {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (!currentUser) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Fix: Use v8 compat syntax for collection, query, where, and orderBy.
    const tasksCollectionRef = db.collection('tasks');
    const q = tasksCollectionRef
      .where('userId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc');

    // Fix: Use v8 compat syntax for onSnapshot.
    const unsubscribe = q.onSnapshot(
      (snapshot) => {
        const tasksData = snapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          const createdAtData = data.createdAt;
          const dueDateData = data.dueDate;

          // Handle Firestore Timestamps, converting them to ISO strings
          // Fix: Use firebase.firestore.Timestamp for instanceof check.
          const createdAt = createdAtData instanceof firebase.firestore.Timestamp ? createdAtData.toDate().toISOString() : createdAtData;
          const dueDate = dueDateData instanceof firebase.firestore.Timestamp ? dueDateData.toDate().toISOString() : dueDateData;
          
          const status: TaskStatus = data.status || (data.completed ? 'completed' : 'todo');
          const { completed, ...restData } = data;

          return {
            id: docSnapshot.id,
            ...restData,
            createdAt,
            dueDate,
            status,
          } as Task;
        });
        setTasks(tasksData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tasks:", error);
        addToast('Không thể tải công việc.', 'error');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, addToast]);

  const addTask = useCallback(async (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly') => {
    if (!text.trim() || !currentUser) return;

    const newTask = {
      text: text.trim(),
      status: 'todo' as TaskStatus,
      // Fix: Use firebase.firestore.FieldValue.serverTimestamp() for v8 compat syntax.
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      dueDate: dueDate ? new Date(dueDate) : null,
      hashtags: tags.map(tag => tag.toLowerCase()),
      reminderSent: false,
      isUrgent,
      recurrenceRule,
      userId: currentUser.uid,
    };

    try {
      // Fix: Use v8 compat syntax for adding a document.
      await db.collection('tasks').add(newTask);
      addToast('Đã thêm công việc mới!', 'success');
    } catch (error) {
      console.error("Error adding task: ", error);
      addToast('Không thể thêm công việc.', 'error');
    }
  }, [currentUser, addToast]);

  const addSubtasksBatch = useCallback(async (parentId: string, subtaskTexts: string[]) => {
    if (!currentUser || subtaskTexts.length === 0) return;

    const batch = db.batch();
    const tasksCollectionRef = db.collection('tasks');

    subtaskTexts.forEach(text => {
        const newDocRef = tasksCollectionRef.doc();
        const subtaskData = {
            text: text.trim(),
            status: 'todo' as TaskStatus,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            dueDate: null,
            hashtags: [],
            reminderSent: false,
            isUrgent: false,
            recurrenceRule: 'none' as const,
            userId: currentUser.uid,
            parentId: parentId,
        };
        batch.set(newDocRef, subtaskData);
    });

    try {
        await batch.commit();
        addToast(`Đã thêm ${subtaskTexts.length} công việc con.`, 'success');
    } catch (error) {
        console.error("Error adding subtasks in batch: ", error);
        addToast('Không thể thêm công việc con.', 'error');
    }
  }, [currentUser, addToast]);

  const updateTaskText = useCallback(async (id: string, newText: string) => {
    if (!currentUser) return;
    const trimmedText = newText.trim();
    if (!trimmedText) {
      addToast('Nội dung công việc không thể để trống.', 'error');
      return;
    }
    
    const originalTasks = tasks;
    const task = tasks.find(t => t.id === id);
    if (!task || task.text === trimmedText) return;
    
    setTasks(current => current.map(t => t.id === id ? {...t, text: trimmedText} : t));

    try {
        await db.collection('tasks').doc(id).update({ text: trimmedText });
        addToast('Đã cập nhật nội dung công việc.', 'success');
    } catch (error) {
      console.error("Error updating task text: ", error);
      addToast('Không thể cập nhật công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, tasks, addToast]);

  const toggleTask = useCallback(async (id: string) => {
    if (!currentUser) return;
    
    const originalTasks = tasks;
    const taskToToggle = tasks.find(t => t.id === id);
    if (!taskToToggle) return;

    const newStatus = taskToToggle.status === 'completed' ? 'todo' : 'completed';

    // Optimistic UI update
    if (taskToToggle.status !== 'completed' && taskToToggle.recurrenceRule && taskToToggle.recurrenceRule !== 'none' && taskToToggle.dueDate) {
        let nextDueDate: Date;
        const currentDueDate = new Date(taskToToggle.dueDate);
        switch (taskToToggle.recurrenceRule) {
            case 'daily': nextDueDate = addDays(currentDueDate, 1); break;
            case 'weekly': nextDueDate = addWeeks(currentDueDate, 1); break;
            case 'monthly': nextDueDate = addMonths(currentDueDate, 1); break;
            default: nextDueDate = currentDueDate; 
        }
        const newTaskClient: Task = {
            id: `temp-${uuidv4()}`,
            text: taskToToggle.text, status: 'todo',
            createdAt: new Date().toISOString(),
            dueDate: nextDueDate.toISOString(),
            hashtags: taskToToggle.hashtags, reminderSent: false,
            isUrgent: taskToToggle.isUrgent,
            recurrenceRule: taskToToggle.recurrenceRule, userId: currentUser.uid,
        };
        const updatedTasks = tasks.map(t => 
            t.id === id ? { ...t, status: 'completed' as TaskStatus, recurrenceRule: 'none' as const } : t
        );
        setTasks([...updatedTasks, newTaskClient]);
    } else {
        setTasks(currentTasks => currentTasks.map(task =>
            task.id === id ? { ...task, status: newStatus } : task
        ));
    }
    
    // Firebase operation
    try {
        if (taskToToggle.status !== 'completed' && taskToToggle.recurrenceRule && taskToToggle.recurrenceRule !== 'none' && taskToToggle.dueDate) {
            let nextDueDate: Date;
            const currentDueDate = new Date(taskToToggle.dueDate);
            switch (taskToToggle.recurrenceRule) {
                case 'daily': nextDueDate = addDays(currentDueDate, 1); break;
                case 'weekly': nextDueDate = addWeeks(currentDueDate, 1); break;
                case 'monthly': nextDueDate = addMonths(currentDueDate, 1); break;
                default: nextDueDate = currentDueDate; 
            }
            const nextInstanceData = {
                text: taskToToggle.text, status: 'todo',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                dueDate: nextDueDate, hashtags: taskToToggle.hashtags,
                reminderSent: false, isUrgent: taskToToggle.isUrgent,
                recurrenceRule: taskToToggle.recurrenceRule, userId: currentUser.uid,
            };
            const batch = db.batch();
            const taskDocRef = db.collection('tasks').doc(id);
            batch.update(taskDocRef, { status: 'completed', recurrenceRule: 'none' });
            const newDocRef = db.collection('tasks').doc();
            batch.set(newDocRef, nextInstanceData);
            await batch.commit();
        } else {
            await db.collection('tasks').doc(id).update({ status: newStatus });
        }
        addToast('Đã cập nhật trạng thái công việc.', 'success');
    } catch (error) {
      console.error("Error toggling task: ", error);
      addToast('Không thể cập nhật công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, tasks, addToast]);

  const deleteTask = useCallback(async (id: string) => {
    if (!currentUser) return;
    const originalTasks = tasks;
    setTasks(currentTasks => currentTasks.filter(task => task.id !== id && task.parentId !== id));
    
    try {
      const subtasksToDelete = tasks.filter(t => t.parentId === id).map(t => t.id);
      const allIdsToDelete = [id, ...subtasksToDelete];
      
      const batch = db.batch();
      allIdsToDelete.forEach(taskId => {
        batch.delete(db.collection('tasks').doc(taskId));
      });
      await batch.commit();
      addToast('Đã xóa công việc.', 'success');
    } catch (error) {
      console.error("Error deleting task: ", error);
      addToast('Không thể xóa công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, tasks, addToast]);

  const toggleTaskUrgency = useCallback(async (id: string) => {
    if (!currentUser) return;
    const originalTasks = tasks;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    setTasks(current => current.map(t => t.id === id ? {...t, isUrgent: !t.isUrgent} : t));

    try {
        await db.collection('tasks').doc(id).update({ isUrgent: !task.isUrgent });
        addToast('Đã cập nhật độ khẩn cấp.', 'success');
    } catch (error) {
      console.error("Error updating urgency: ", error);
      addToast('Không thể cập nhật độ khẩn cấp.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, tasks, addToast]);

  const updateTaskDueDate = useCallback(async (id: string, newDueDate: string | null) => {
    if (!currentUser) return;
    const originalTasks = tasks;
    setTasks(current => current.map(t => t.id === id ? {...t, dueDate: newDueDate, reminderSent: false} : t));
    
    try {
        await db.collection('tasks').doc(id).update({ dueDate: newDueDate ? new Date(newDueDate) : null, reminderSent: false });
        addToast('Đã cập nhật thời hạn.', 'success');
    } catch (error) {
      console.error("Error updating due date: ", error);
      addToast('Không thể cập nhật thời hạn.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, tasks, addToast]);

  const markReminderSent = useCallback(async (id: string) => {
    if (!currentUser) return;
    const originalTasks = tasks;
    setTasks(current => current.map(t => t.id === id ? {...t, reminderSent: true} : t));

    try {
        await db.collection('tasks').doc(id).update({ reminderSent: true });
    } catch (error) {
      console.error("Error marking reminder sent: ", error);
      setTasks(originalTasks);
    }
  }, [currentUser, tasks]);

  const updateTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
    if (!currentUser) return;
    const originalTasks = tasks;
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === status) return;
    
    setTasks(current => current.map(t => t.id === id ? {...t, status: status} : t));

    try {
        await db.collection('tasks').doc(id).update({ status: status });
        addToast('Đã cập nhật trạng thái công việc.', 'success');
    } catch (error) {
      console.error("Error updating task status: ", error);
      addToast('Không thể cập nhật trạng thái.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, tasks, addToast]);


  return { tasks, addTask, addSubtasksBatch, toggleTask, deleteTask, markReminderSent, updateTaskDueDate, toggleTaskUrgency, updateTaskText, updateTaskStatus };
};