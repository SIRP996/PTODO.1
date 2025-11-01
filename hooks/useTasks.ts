import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus } from '../types';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { useAuth } from '../context/AuthContext';
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
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { useToast } from '../context/ToastContext';
import { v4 as uuidv4 } from 'uuid';


const GUEST_TASKS_KEY = 'ptodo-guest-tasks';
const GUEST_TASK_LIMIT = 5;

export const useTasks = () => {
  const { currentUser, isGuestMode, userSettings } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Unified function to update guest tasks in state and localStorage
  const updateGuestTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(newTasks));
  };
  
  const getGuestTasks = (): Task[] => {
    const storedTasks = localStorage.getItem(GUEST_TASKS_KEY);
    return storedTasks ? JSON.parse(storedTasks) : [];
  };

  const syncWithCalendar = useCallback((action: 'create' | 'update' | 'delete', taskText: string) => {
    if (!userSettings?.isGoogleCalendarLinked) return;
    const messages = {
        create: 'Đang tạo sự kiện Lịch Google cho:',
        update: 'Đang cập nhật sự kiện Lịch Google cho:',
        delete: 'Đang xóa sự kiện Lịch Google cho:'
    };
    const message = `${messages[action]} "${taskText}"`;
    addToast(message, 'info');
    console.log(`SYNC_CALENDAR: ${message}`);
  }, [userSettings?.isGoogleCalendarLinked, addToast]);

  useEffect(() => {
    if (isGuestMode) {
      setLoading(true);
      const guestTasks = getGuestTasks();
      setTasks(guestTasks);
      setLoading(false);
      return () => {}; // No-op for cleanup in guest mode
    }

    if (!currentUser) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const tasksCollectionRef = collection(db, 'tasks');
    const q = query(tasksCollectionRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasksData = snapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          const createdAtData = data.createdAt;
          const dueDateData = data.dueDate;

          // Handle Firestore Timestamps, converting them to ISO strings
          const createdAt = createdAtData instanceof Timestamp ? createdAtData.toDate().toISOString() : createdAtData;
          const dueDate = dueDateData instanceof Timestamp ? dueDateData.toDate().toISOString() : dueDateData;
          
          const status: TaskStatus = data.status || (data.completed ? 'completed' : 'todo');
          const { completed, ...restData } = data;

          return {
            id: docSnapshot.id,
            ...restData,
            createdAt,
            dueDate,
            status,
            note: data.note || '',
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
  }, [currentUser, isGuestMode, addToast]);

  const addTask = useCallback(async (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly') => {
    if (!text.trim()) return;

    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        if (currentTasks.length >= GUEST_TASK_LIMIT) {
            addToast(`Bạn đã đạt giới hạn ${GUEST_TASK_LIMIT} công việc cho khách. Vui lòng đăng ký để thêm không giới hạn.`, 'info');
            return;
        }
        const newTask: Task = {
            id: uuidv4(),
            text: text.trim(),
            status: 'todo',
            createdAt: new Date().toISOString(),
            dueDate,
            hashtags: tags.map(tag => tag.toLowerCase()),
            reminderSent: false,
            isUrgent,
            recurrenceRule: 'none', // No recurrence for guests
            note: '',
        };
        updateGuestTasks([...currentTasks, newTask]);
        addToast('Đã thêm công việc mới!', 'success');
        return;
    }
    
    if (!currentUser) return;
    const newTask = {
      text: text.trim(),
      status: 'todo' as TaskStatus,
      createdAt: serverTimestamp(),
      dueDate: dueDate ? new Date(dueDate) : null,
      hashtags: tags.map(tag => tag.toLowerCase()),
      reminderSent: false,
      isUrgent,
      recurrenceRule,
      userId: currentUser.uid,
      note: '',
    };

    try {
      await addDoc(collection(db, 'tasks'), newTask);
      if (dueDate) {
        syncWithCalendar('create', text.trim());
      }
      addToast('Đã thêm công việc mới!', 'success');
    } catch (error) {
      console.error("Error adding task: ", error);
      addToast('Không thể thêm công việc.', 'error');
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar]);
  
  const addTasksBatch = useCallback(async (tasksToAdd: { text: string; tags: string[]; dueDate: string | null; isUrgent: boolean }[]) => {
    if (isGuestMode) {
        // Guest mode batch add isn't supported via UI, but useful for migration
        const guestTasks = getGuestTasks();
        const newTasks: Task[] = tasksToAdd.map(task => ({
            id: uuidv4(),
            text: task.text.trim(),
            status: 'todo',
            createdAt: new Date().toISOString(),
            dueDate: task.dueDate,
            hashtags: task.tags.map(tag => tag.toLowerCase()),
            reminderSent: false,
            isUrgent: task.isUrgent,
            recurrenceRule: 'none',
            note: '',
        }));
        updateGuestTasks([...guestTasks, ...newTasks].slice(0, GUEST_TASK_LIMIT));
        return;
    }
    
    if (!currentUser || tasksToAdd.length === 0) return;

    const batch = writeBatch(db);
    const tasksCollectionRef = collection(db, 'tasks');

    tasksToAdd.forEach(task => {
        const newDocRef = doc(tasksCollectionRef);
        const taskData = {
            text: task.text.trim(),
            status: 'todo' as TaskStatus,
            createdAt: serverTimestamp(),
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            hashtags: task.tags.map(tag => tag.toLowerCase()),
            reminderSent: false,
            isUrgent: task.isUrgent,
            recurrenceRule: 'none' as const,
            userId: currentUser.uid,
            note: '',
        };
        batch.set(newDocRef, taskData);
    });

    try {
        await batch.commit();
        tasksToAdd.forEach(task => {
          if (task.dueDate) {
            syncWithCalendar('create', task.text.trim());
          }
        });
        addToast(`Đã thêm ${tasksToAdd.length} công việc mới.`, 'success');
    } catch (error) {
        console.error("Error adding tasks in batch: ", error);
        addToast('Không thể thêm các công việc.', 'error');
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar]);

  const addSubtasksBatch = useCallback(async (parentId: string, subtaskTexts: string[]) => {
    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const availableSlots = GUEST_TASK_LIMIT - currentTasks.length;
        if (availableSlots <= 0) {
            addToast(`Đã đạt giới hạn ${GUEST_TASK_LIMIT} công việc. Không thể thêm công việc con.`, 'info');
            return;
        }
        
        const subtasksToAdd: Task[] = subtaskTexts.slice(0, availableSlots).map(text => ({
            id: uuidv4(),
            text: text.trim(),
            status: 'todo',
            createdAt: new Date().toISOString(),
            dueDate: null,
            hashtags: [],
            reminderSent: false,
            isUrgent: false,
            recurrenceRule: 'none',
            parentId: parentId,
            note: '',
        }));

        updateGuestTasks([...currentTasks, ...subtasksToAdd]);
        addToast(`Đã thêm ${subtasksToAdd.length} công việc con.`, 'success');
        return;
    }

    if (!currentUser || subtaskTexts.length === 0) return;

    const batch = writeBatch(db);
    const tasksCollectionRef = collection(db, 'tasks');

    subtaskTexts.forEach(text => {
        const newDocRef = doc(tasksCollectionRef);
        const subtaskData = {
            text: text.trim(),
            status: 'todo' as TaskStatus,
            createdAt: serverTimestamp(),
            dueDate: null,
            hashtags: [],
            reminderSent: false,
            isUrgent: false,
            recurrenceRule: 'none' as const,
            userId: currentUser.uid,
            parentId: parentId,
            note: '',
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
  }, [currentUser, isGuestMode, addToast]);

  const updateTaskText = useCallback(async (id: string, newText: string) => {
    const trimmedText = newText.trim();
    if (!trimmedText) {
      addToast('Nội dung công việc không thể để trống.', 'error');
      return;
    }
    
    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.map(t => t.id === id ? { ...t, text: trimmedText } : t);
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật nội dung công việc.', 'success');
        return;
    }
    
    if (!currentUser) return;
    const originalTasks = tasks;
    const task = tasks.find(t => t.id === id);
    if (!task || task.text === trimmedText) return;
    
    setTasks(current => current.map(t => t.id === id ? {...t, text: trimmedText} : t));

    try {
        await updateDoc(doc(db, 'tasks', id), { text: trimmedText });
        if (task.dueDate) {
          syncWithCalendar('update', trimmedText);
        }
        addToast('Đã cập nhật nội dung công việc.', 'success');
    } catch (error) {
      console.error("Error updating task text: ", error);
      addToast('Không thể cập nhật công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, tasks, addToast, syncWithCalendar]);

  const updateTaskNote = useCallback(async (id: string, newNote: string) => {
    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.map(t => t.id === id ? { ...t, note: newNote } : t);
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật ghi chú.', 'success');
        return;
    }

    if (!currentUser) return;
    const originalTasks = tasks;
    const task = tasks.find(t => t.id === id);
    if (!task || task.note === newNote) return;
    
    setTasks(current => current.map(t => t.id === id ? {...t, note: newNote} : t));

    try {
        await updateDoc(doc(db, 'tasks', id), { note: newNote });
        addToast('Đã cập nhật ghi chú.', 'success');
    } catch (error) {
      console.error("Error updating task note: ", error);
      addToast('Không thể cập nhật ghi chú.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, tasks, addToast]);


  const toggleTask = useCallback(async (id: string) => {
    const taskToToggle = tasks.find(t => t.id === id);
    if (!taskToToggle) return;
    const newStatus = taskToToggle.status === 'completed' ? 'todo' : 'completed';

    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.map(t => t.id === id ? { ...t, status: newStatus } : t);
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật trạng thái công việc.', 'success');
        return;
    }
    
    if (!currentUser) return;
    
    const originalTasks = tasks;
    
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
            note: taskToToggle.note,
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
                createdAt: serverTimestamp(),
                dueDate: nextDueDate, hashtags: taskToToggle.hashtags,
                reminderSent: false, isUrgent: taskToToggle.isUrgent,
                recurrenceRule: taskToToggle.recurrenceRule, userId: currentUser.uid,
                note: taskToToggle.note || ''
            };
            const batch = writeBatch(db);
            const taskDocRef = doc(db, 'tasks', id);
            batch.update(taskDocRef, { status: 'completed', recurrenceRule: 'none' });
            const newDocRef = doc(collection(db, 'tasks'));
            batch.set(newDocRef, nextInstanceData);
            await batch.commit();
        } else {
            await updateDoc(doc(db, 'tasks', id), { status: newStatus });
        }
        if (taskToToggle.dueDate) {
          syncWithCalendar('update', taskToToggle.text);
        }
        addToast('Đã cập nhật trạng thái công việc.', 'success');
    } catch (error) {
      console.error("Error toggling task: ", error);
      addToast('Không thể cập nhật công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, tasks, addToast, syncWithCalendar]);

  const deleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.filter(task => task.id !== id && task.parentId !== id);
        updateGuestTasks(newTasks);
        addToast('Đã xóa công việc.', 'success');
        return;
    }
    if (!currentUser) return;
    const originalTasks = tasks;
    setTasks(currentTasks => currentTasks.filter(task => task.id !== id && task.parentId !== id));
    
    try {
      const subtasksToDelete = tasks.filter(t => t.parentId === id).map(t => t.id);
      const allIdsToDelete = [id, ...subtasksToDelete];
      
      const batch = writeBatch(db);
      allIdsToDelete.forEach(taskId => {
        batch.delete(doc(db, 'tasks', taskId));
      });
      await batch.commit();
      if (taskToDelete.dueDate) {
        syncWithCalendar('delete', taskToDelete.text);
      }
      addToast('Đã xóa công việc.', 'success');
    } catch (error) {
      console.error("Error deleting task: ", error);
      addToast('Không thể xóa công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, tasks, addToast, syncWithCalendar]);

  const toggleTaskUrgency = useCallback(async (id: string) => {
     if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.map(t => t.id === id ? { ...t, isUrgent: !t.isUrgent } : t);
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật độ khẩn cấp.', 'success');
        return;
    }

    if (!currentUser) return;
    const originalTasks = tasks;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    setTasks(current => current.map(t => t.id === id ? {...t, isUrgent: !t.isUrgent} : t));

    try {
        await updateDoc(doc(db, 'tasks', id), { isUrgent: !task.isUrgent });
        addToast('Đã cập nhật độ khẩn cấp.', 'success');
    } catch (error) {
      console.error("Error updating urgency: ", error);
      addToast('Không thể cập nhật độ khẩn cấp.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, tasks, addToast]);

  const updateTaskDueDate = useCallback(async (id: string, newDueDate: string | null) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.map(t => t.id === id ? { ...t, dueDate: newDueDate, reminderSent: false } : t);
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật thời hạn.', 'success');
        return;
    }
    
    if (!currentUser) return;
    const originalTasks = tasks;
    setTasks(current => current.map(t => t.id === id ? {...t, dueDate: newDueDate, reminderSent: false} : t));
    
    try {
        await updateDoc(doc(db, 'tasks', id), { dueDate: newDueDate ? new Date(newDueDate) : null, reminderSent: false });
        syncWithCalendar(task.googleCalendarEventId || !newDueDate ? 'update' : 'create', task.text);
        addToast('Đã cập nhật thời hạn.', 'success');
    } catch (error) {
      console.error("Error updating due date: ", error);
      addToast('Không thể cập nhật thời hạn.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, tasks, addToast, syncWithCalendar]);

  const markReminderSent = useCallback(async (id: string) => {
    if (isGuestMode) return; // Reminders are not supported for guests
    
    if (!currentUser) return;
    const originalTasks = tasks;
    setTasks(current => current.map(t => t.id === id ? {...t, reminderSent: true} : t));

    try {
        await updateDoc(doc(db, 'tasks', id), { reminderSent: true });
    } catch (error) {
      console.error("Error marking reminder sent: ", error);
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, tasks]);

  const updateTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === status) return;
    
    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        // FIX: The status property from JSON.parse is a generic string.
        // We ensure that the new array has elements where status is explicitly TaskStatus.
        const newTasks: Task[] = currentTasks.map((t) => (t.id === id ? { ...t, status } : t));
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật trạng thái công việc.', 'success');
        return;
    }

    if (!currentUser) return;
    const originalTasks = tasks;
    
    // FIX: The tasks in state could be from guest mode, so status can be a generic string.
    // We ensure that the new array has elements where status is explicitly TaskStatus.
    setTasks(current => current.map((t) => (t.id === id ? {...t, status: status} : t)) as Task[]);

    try {
        await updateDoc(doc(db, 'tasks', id), { status: status });
        if (task.dueDate) {
          syncWithCalendar('update', task.text);
        }
        addToast('Đã cập nhật trạng thái công việc.', 'success');
    } catch (error) {
      console.error("Error updating task status: ", error);
      addToast('Không thể cập nhật trạng thái.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, tasks, addToast, syncWithCalendar]);


  return { tasks, addTask, addTasksBatch, addSubtasksBatch, toggleTask, deleteTask, markReminderSent, updateTaskDueDate, toggleTaskUrgency, updateTaskText, updateTaskStatus, updateTaskNote };
};
