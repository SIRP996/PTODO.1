import { useState, useEffect, useCallback, useRef } from 'react';
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
import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { useToast } from '../context/ToastContext';
import { useLog } from '../context/LogContext';
import { v4 as uuidv4 } from 'uuid';


const GUEST_TASKS_KEY = 'ptodo-guest-tasks';
const GUEST_TASK_LIMIT = 5;

export const useTasks = () => {
  const { currentUser, isGuestMode, userSettings, googleAccessToken, updateUserSettings } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const { addLog } = useLog();

  // Create a ref to hold the latest tasks array to break dependency cycles in callbacks
  const tasksRef = useRef<Task[]>(tasks);

  // Keep the ref in sync with the state
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Unified function to update guest tasks in state and localStorage
  const updateGuestTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(newTasks));
  };
  
  const getGuestTasks = (): Task[] => {
    const storedTasks = localStorage.getItem(GUEST_TASKS_KEY);
    return storedTasks ? JSON.parse(storedTasks) : [];
  };

  const syncWithCalendar = useCallback(async (action: 'create' | 'update' | 'delete', task: Omit<Task, 'id'> & { id?: string }) => {
    addLog(`[Sync] Bắt đầu đồng bộ: Hành động = ${action}, Công việc = ${task.text}`, 'info');

    if (!currentUser || !userSettings?.isGoogleCalendarLinked) {
        addLog('[Sync] Bỏ qua: Người dùng chưa đăng nhập hoặc Lịch Google chưa được kết nối.', 'warn');
        return null;
    }

    const performSync = async (token: string) => {
        const eventData = {
            summary: task.text,
            description: task.note || `Trạng thái: ${task.status}`,
            start: { dateTime: new Date(task.dueDate!).toISOString() },
            end: { dateTime: new Date(new Date(task.dueDate!).getTime() + 60 * 60 * 1000).toISOString() }, // Default 1 hour duration
            ...(task.status === 'completed' && { status: 'cancelled' })
        };
        
        let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
        let method = 'POST';

        if (action === 'update' && task.googleCalendarEventId) {
            url += `/${task.googleCalendarEventId}`;
            method = 'PUT';
        } else if (action === 'delete' && task.googleCalendarEventId) {
            url += `/${task.googleCalendarEventId}`;
            method = 'DELETE';
            const deleteResponse = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
            if (!deleteResponse.ok) throw deleteResponse;
            addLog(`[Sync] Đã xóa sự kiện thành công: ${task.text}`, 'success');
            return null;
        }

        const response = await fetch(url, {
            method,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });

        if (!response.ok) throw response;

        const responseData = await response.json();
        addLog(`[Sync] Đồng bộ sự kiện thành công: ${task.text}`, 'success');
        return responseData.id;
    };

    try {
        if (!googleAccessToken) {
            throw { status: 401 }; // Treat no token as an expired one to trigger refresh
        }
        return await performSync(googleAccessToken);
    } catch (error: any) {
        if (error.status === 401) {
            addLog('[Sync] Lỗi 401: Token đã hết hạn. Thử làm mới...', 'warn');
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/calendar.events');
            provider.setCustomParameters({
                'access_type': 'offline'
            });

            try {
                const result = await reauthenticateWithPopup(currentUser, provider);
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const newToken = credential?.accessToken;
                
                if (newToken) {
                    sessionStorage.setItem('ptodo-google-token', newToken);
                    addLog('[Sync] Token đã được làm mới. Thử lại API call...', 'info');
                    return await performSync(newToken);
                } else {
                    throw new Error("Không nhận được token mới sau khi làm mới.");
                }
            } catch (refreshError: any) {
                addLog(`[Sync] Lỗi trong quá trình làm mới token: ${refreshError.message}`, 'error');
                // Don't show a toast if the user simply closed the popup.
                if (refreshError.code !== 'auth/popup-closed-by-user' && refreshError.code !== 'auth/cancelled-popup-request') {
                    addToast("Phiên Google đã hết hạn và không thể tự động làm mới. Thao tác đồng bộ đã thất bại.", "error");
                }
                // We no longer set isGoogleCalendarLinked to false here.
                // This allows the app to optimistically try to re-authenticate on the next sync action,
                // providing a better user experience than forcing them to go to settings.
                return null;
            }
        } else {
            addToast("Đã xảy ra lỗi khi đồng bộ với Lịch Google.", "error");
            addLog(`[Sync] Lỗi không xác định: ${error.message || error.statusText}`, 'error');
            return null;
        }
    }
  }, [userSettings?.isGoogleCalendarLinked, googleAccessToken, currentUser, addToast, addLog, updateUserSettings]);

  // Fix: Add implementations for all task management functions and a return statement.
  const addTask = useCallback(async (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly') => {
    const newTask: Omit<Task, 'id' | 'createdAt' | 'status' | 'reminderSent'> = {
      text,
      hashtags: tags,
      dueDate,
      isUrgent,
      recurrenceRule,
      userId: currentUser?.uid,
      note: '',
    };

    if (isGuestMode) {
      const guestTasks = getGuestTasks();
      if (guestTasks.length >= GUEST_TASK_LIMIT) {
        addToast(`Chế độ khách chỉ cho phép tối đa ${GUEST_TASK_LIMIT} công việc.`, 'warn');
        return;
      }
      const newGuestTask: Task = {
        ...newTask,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        status: 'todo',
        reminderSent: false,
      };
      updateGuestTasks([...guestTasks, newGuestTask]);
      return;
    }

    if (currentUser) {
      try {
        const docData = {
          ...newTask,
          status: 'todo' as TaskStatus,
          reminderSent: false,
          createdAt: serverTimestamp(),
          dueDate: dueDate ? new Date(dueDate) : null,
        };
        
        let googleCalendarEventId = null;
        if (dueDate) {
          googleCalendarEventId = await syncWithCalendar('create', { ...docData, id: '' });
        }

        await addDoc(collection(db, 'tasks'), { ...docData, googleCalendarEventId });
        addToast("Đã thêm công việc thành công!", 'success');
      } catch (error) {
        console.error("Error adding task: ", error);
        addToast("Không thể thêm công việc.", 'error');
      }
    }
  }, [currentUser, isGuestMode, syncWithCalendar, addToast]);

  const toggleTask = useCallback(async (id: string) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;

    // Fix: Explicitly type `newStatus` as `TaskStatus` to prevent type inference issues.
    const newStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';

    if (isGuestMode) {
      const updatedTasks = getGuestTasks().map(t => t.id === id ? { ...t, status: newStatus } : t);
      updateGuestTasks(updatedTasks);
      return;
    }

    if (currentUser) {
      const taskDocRef = doc(db, 'tasks', id);
      try {
        const updateData: Partial<Task> = { status: newStatus };
        
        if (task.dueDate) {
            await syncWithCalendar('update', { ...task, ...updateData });
        }
        
        await updateDoc(taskDocRef, { status: newStatus });

        if (newStatus === 'completed' && task.recurrenceRule && task.recurrenceRule !== 'none' && task.dueDate) {
          let nextDueDate: Date | null = null;
          const currentDueDate = new Date(task.dueDate);
          switch (task.recurrenceRule) {
            case 'daily': nextDueDate = addDays(currentDueDate, 1); break;
            case 'weekly': nextDueDate = addWeeks(currentDueDate, 1); break;
            case 'monthly': nextDueDate = addMonths(currentDueDate, 1); break;
          }
          if (nextDueDate) {
            await addTask(task.text, task.hashtags, nextDueDate.toISOString(), task.isUrgent, task.recurrenceRule);
            addToast(`Đã tạo công việc lặp lại cho lần tiếp theo.`, 'info');
          }
        }
      } catch (error) {
        console.error("Error toggling task: ", error);
        addToast("Không thể cập nhật trạng thái công việc.", 'error');
      }
    }
  }, [currentUser, isGuestMode, addTask, syncWithCalendar, addToast]);

  const deleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasksRef.current.find(t => t.id === id);
    if (!taskToDelete) return;

    if (isGuestMode) {
      const subtasks = getGuestTasks().filter(t => t.parentId === id);
      const idsToDelete = [id, ...subtasks.map(st => st.id)];
      const updatedTasks = getGuestTasks().filter(t => !idsToDelete.includes(t.id));
      updateGuestTasks(updatedTasks);
      return;
    }
    
    if (currentUser) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'tasks', id));
        
        const subtasksToDelete = tasksRef.current.filter(t => t.parentId === id);
        subtasksToDelete.forEach(subtask => {
          batch.delete(doc(db, 'tasks', subtask.id));
        });

        await batch.commit();

        if (taskToDelete.googleCalendarEventId) {
            await syncWithCalendar('delete', taskToDelete);
        }
        addToast("Đã xóa công việc.", 'success');
      } catch (error) {
        console.error("Error deleting task: ", error);
        addToast("Không thể xóa công việc.", 'error');
      }
    }
  }, [currentUser, isGuestMode, syncWithCalendar, addToast]);

  const markReminderSent = useCallback(async (id: string) => {
    if (isGuestMode) {
      const updatedTasks = getGuestTasks().map(t => t.id === id ? { ...t, reminderSent: true } : t);
      updateGuestTasks(updatedTasks);
      return;
    }
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'tasks', id), { reminderSent: true });
      } catch (error) {
        console.error("Error marking reminder sent: ", error);
      }
    }
  }, [currentUser, isGuestMode]);

  const updateTaskDueDate = useCallback(async (id: string, newDueDate: string | null) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;

    const newDueDateObject = newDueDate ? new Date(newDueDate) : null;

    if (isGuestMode) {
      const updatedTasks = getGuestTasks().map(t => t.id === id ? { ...t, dueDate: newDueDate } : t);
      updateGuestTasks(updatedTasks);
      return;
    }

    if (currentUser) {
      try {
        const taskDocRef = doc(db, 'tasks', id);
        let googleCalendarEventId = task.googleCalendarEventId;
        const taskUpdatePayload = { ...task, dueDate: newDueDate };

        if (newDueDate && !task.googleCalendarEventId) {
            googleCalendarEventId = await syncWithCalendar('create', taskUpdatePayload);
        } else if (newDueDate && task.googleCalendarEventId) {
            await syncWithCalendar('update', taskUpdatePayload);
        } else if (!newDueDate && task.googleCalendarEventId) {
            await syncWithCalendar('delete', task);
            googleCalendarEventId = null;
        }

        await updateDoc(taskDocRef, { dueDate: newDueDateObject, googleCalendarEventId });
      } catch (error) {
        console.error("Error updating due date: ", error);
        addToast("Không thể cập nhật ngày hết hạn.", 'error');
      }
    }
  }, [currentUser, isGuestMode, syncWithCalendar, addToast]);

  const toggleTaskUrgency = useCallback(async (id: string) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;

    const newUrgency = !task.isUrgent;

    if (isGuestMode) {
      const updatedTasks = getGuestTasks().map(t => t.id === id ? { ...t, isUrgent: newUrgency } : t);
      updateGuestTasks(updatedTasks);
      return;
    }

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'tasks', id), { isUrgent: newUrgency });
      } catch (error) {
        console.error("Error toggling urgency: ", error);
        addToast("Không thể cập nhật mức độ khẩn cấp.", 'error');
      }
    }
  }, [currentUser, isGuestMode, addToast]);

  const addSubtasksBatch = useCallback(async (parentId: string, subtaskTexts: string[]) => {
    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const availableSlots = GUEST_TASK_LIMIT - currentTasks.length;
        if (subtaskTexts.length > availableSlots) {
            addToast(`Chỉ có thể thêm ${availableSlots} công việc con trong chế độ khách.`, 'warn');
        }
        const newSubtasks = subtaskTexts.slice(0, availableSlots).map(text => ({
            id: uuidv4(), text, status: 'todo' as TaskStatus, createdAt: new Date().toISOString(),
            dueDate: null, hashtags: [], reminderSent: false, isUrgent: false, parentId: parentId,
        }));
        updateGuestTasks([...currentTasks, ...newSubtasks]);
        return;
    }

    if (currentUser) {
      const batch = writeBatch(db);
      const tasksCollection = collection(db, 'tasks');
      subtaskTexts.forEach(text => {
        const newDocRef = doc(tasksCollection);
        batch.set(newDocRef, {
          text, status: 'todo', createdAt: serverTimestamp(), dueDate: null, hashtags: [],
          reminderSent: false, isUrgent: false, userId: currentUser.uid, parentId: parentId,
        });
      });
      try {
        await batch.commit();
        addToast(`Đã thêm ${subtaskTexts.length} công việc con.`, 'success');
      } catch (error) {
        console.error("Error adding subtasks batch: ", error);
        addToast("Không thể thêm công việc con.", 'error');
      }
    }
  }, [currentUser, isGuestMode, addToast]);

  const addTasksBatch = useCallback(async (tasksToAdd: Array<Omit<Task, 'id' | 'createdAt' | 'status' | 'reminderSent'>>) => {
    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const availableSlots = GUEST_TASK_LIMIT - currentTasks.length;
        if (tasksToAdd.length > availableSlots) {
            addToast(`Chỉ có thể thêm ${availableSlots} công việc trong chế độ khách.`, 'warn');
        }
        const newTasks = tasksToAdd.slice(0, availableSlots).map(task => ({
            ...task, id: uuidv4(), createdAt: new Date().toISOString(), status: 'todo' as TaskStatus, reminderSent: false,
        }));
        updateGuestTasks([...currentTasks, ...newTasks]);
        addToast(`Đã thêm ${newTasks.length} công việc.`, 'success');
        return;
    }

    if (currentUser) {
      const batch = writeBatch(db);
      const tasksCollection = collection(db, 'tasks');
      for (const task of tasksToAdd) {
        const newDocRef = doc(tasksCollection);
        const docData = {
            ...task, status: 'todo' as TaskStatus, reminderSent: false, createdAt: serverTimestamp(),
            userId: currentUser.uid, dueDate: task.dueDate ? new Date(task.dueDate) : null,
        };

        let googleCalendarEventId = null;
        if (task.dueDate) {
          googleCalendarEventId = await syncWithCalendar('create', { ...docData, id: newDocRef.id });
        }
        batch.set(newDocRef, { ...docData, googleCalendarEventId });
      }
      try {
        await batch.commit();
        addToast(`Đã thêm ${tasksToAdd.length} công việc mới!`, 'success');
      } catch (error) {
        console.error("Error adding tasks batch: ", error);
        addToast("Đã xảy ra lỗi khi thêm hàng loạt công việc.", 'error');
      }
    }
  }, [currentUser, isGuestMode, syncWithCalendar, addToast]);
  
  const updateTaskText = useCallback(async (id: string, newText: string) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;
    
    if (isGuestMode) {
      const updatedTasks = getGuestTasks().map(t => t.id === id ? { ...t, text: newText } : t);
      updateGuestTasks(updatedTasks);
      return;
    }

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'tasks', id), { text: newText });
        if(task.googleCalendarEventId) {
            await syncWithCalendar('update', {...task, text: newText});
        }
      } catch (error) {
        console.error("Error updating text: ", error);
        addToast("Không thể cập nhật nội dung công việc.", 'error');
      }
    }
  }, [currentUser, isGuestMode, syncWithCalendar, addToast]);

  const updateTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task || task.status === status) return;

    if (isGuestMode) {
      const updatedTasks = getGuestTasks().map(t => t.id === id ? { ...t, status } : t);
      updateGuestTasks(updatedTasks);
      return;
    }

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'tasks', id), { status });
        if(task.googleCalendarEventId) {
            await syncWithCalendar('update', {...task, status});
        }
      } catch (error) {
        console.error("Error updating status: ", error);
        addToast("Không thể cập nhật trạng thái công việc.", 'error');
      }
    }
  }, [currentUser, isGuestMode, syncWithCalendar, addToast]);

  const updateTaskNote = useCallback(async (id: string, note: string) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;
    
    if (isGuestMode) {
      const updatedTasks = getGuestTasks().map(t => t.id === id ? { ...t, note } : t);
      updateGuestTasks(updatedTasks);
      return;
    }

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'tasks', id), { note });
         if(task.googleCalendarEventId) {
            await syncWithCalendar('update', {...task, note});
        }
      } catch (error) {
        console.error("Error updating note: ", error);
        addToast("Không thể cập nhật ghi chú.", 'error');
      }
    }
  }, [currentUser, isGuestMode, syncWithCalendar, addToast]);

  const syncExistingTasksToCalendar = useCallback(async () => {
    if (!currentUser || !userSettings?.isGoogleCalendarLinked) {
      addToast("Vui lòng kết nối Lịch Google trong Cài đặt trước.", "info");
      return;
    }

    addToast("Bắt đầu đồng bộ công việc cũ với Lịch Google...", "info");
    addLog("[Sync All] Bắt đầu đồng bộ hàng loạt.", "info");

    const tasksToSync = tasksRef.current.filter(t => t.dueDate && t.status !== 'completed');
    let successCount = 0;
    let failCount = 0;

    for (const task of tasksToSync) {
      try {
        const action = task.googleCalendarEventId ? 'update' : 'create';
        const newEventId = await syncWithCalendar(action, task);
        
        if (newEventId && !task.googleCalendarEventId) {
          await updateDoc(doc(db, 'tasks', task.id), { googleCalendarEventId: newEventId });
        }
        successCount++;
      } catch (error) {
        failCount++;
        addLog(`[Sync All] Lỗi đồng bộ công việc "${task.text}": ${error}`, 'error');
      }
    }
    
    if (failCount > 0) {
        addToast(`Đồng bộ hoàn tất với ${failCount} lỗi. Vui lòng kiểm tra bảng ghi chú.`, 'warn');
    } else {
        addToast(`Đã đồng bộ thành công ${successCount} công việc.`, 'success');
    }
     addLog(`[Sync All] Đồng bộ hàng loạt hoàn tất. Thành công: ${successCount}, Thất bại: ${failCount}.`, 'info');
  }, [currentUser, userSettings?.isGoogleCalendarLinked, syncWithCalendar, addToast, addLog]);

  useEffect(() => {
    if (isGuestMode) {
      setTasks(getGuestTasks());
      setLoading(false);
      return () => {};
    }

    if (!currentUser) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'tasks'), 
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasksData: Task[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        tasksData.push({
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          dueDate: (data.dueDate as Timestamp)?.toDate().toISOString() || null,
        } as Task);
      });
      setTasks(tasksData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tasks: ", error);
      addToast("Không thể tải công việc.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, isGuestMode, addToast]);


  return {
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    markReminderSent,
    updateTaskDueDate,
    toggleTaskUrgency,
    addSubtasksBatch,
    addTasksBatch,
    updateTaskText,
    updateTaskStatus,
    updateTaskNote,
    syncExistingTasksToCalendar,
  };
};