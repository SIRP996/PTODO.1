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
import { useToast } from '../context/ToastContext';
import { useLog } from '../context/LogContext';
import { v4 as uuidv4 } from 'uuid';


const GUEST_TASKS_KEY = 'ptodo-guest-tasks';
const GUEST_TASK_LIMIT = 5;

export const useTasks = () => {
  const { currentUser, isGuestMode, userSettings, googleAccessToken } = useAuth();
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

    if (!userSettings?.isGoogleCalendarLinked) {
        addLog('[Sync] Thất bại: Người dùng chưa kết nối Lịch Google (kiểm tra từ userSettings).', 'warn');
        return;
    }
    if (!googleAccessToken) {
        addLog('[Sync] Thất bại: Không tìm thấy Google Access Token.', 'error');
        addToast("Phiên kết nối Lịch Google đã hết hạn. Vui lòng kết nối lại trong Cài đặt.", 'info');
        return;
    }
    addLog('[Sync] Trạng thái: Đã kết nối & có Access Token.', 'success');

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
    } else if ((action === 'update' || action === 'delete') && !task.googleCalendarEventId) {
        addLog(`[Sync] Bỏ qua: Không thể ${action} sự kiện cho công việc "${task.text}" vì thiếu ID sự kiện.`, 'warn');
        return;
    }

    try {
        addLog(`[Sync] Đang gửi yêu cầu: ${method} đến ${url}`, 'info');
        const headers = new Headers({
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json',
        });

        const fetchOptions: RequestInit = {
            method,
            headers,
        };

        if (method !== 'DELETE') {
            fetchOptions.body = JSON.stringify(eventData);
        }

        const response = await fetch(url, fetchOptions);
        
        if (!response.ok) {
            throw response;
        }

        if (action === 'create') {
            const createdEvent = await response.json();
            addLog(`[Sync] Thành công: Đã tạo sự kiện với ID: ${createdEvent.id}`, 'success');
            return createdEvent.id;
        }
        addLog(`[Sync] Thành công: Hoàn thành hành động ${action}.`, 'success');
        return null;

    } catch (error) {
        let specificMessage = `Lỗi đồng bộ với Lịch Google.`;
        if (error instanceof Response) {
            try {
                const errorData = await error.json();
                const gError = errorData.error;
                console.error("Google Calendar API Error:", gError);
                addLog(`[Sync] Lỗi API Google (HTTP ${gError.code}): ${gError.message}`, 'error');
                if (gError.code === 401) {
                    specificMessage = "Phiên kết nối đã hết hạn. Vui lòng kết nối lại Lịch Google trong Cài đặt.";
                } else if (gError.code === 403 && gError.message.includes('Calendar API has not been used')) {
                    specificMessage = "Lỗi quyền truy cập: Vui lòng bật 'Google Calendar API' trong Google Cloud Console cho dự án của bạn và kết nối lại.";
                } else {
                    specificMessage = `Lỗi từ Lịch Google: ${gError.message}`;
                }
            } catch (e) {
                 specificMessage = `Lỗi không xác định khi đồng bộ (HTTP ${error.status}). Vui lòng kiểm tra lại kết nối và quyền.`;
                 addLog(`[Sync] Lỗi không xác định (HTTP ${error.status}).`, 'error');
            }
        } else {
            addLog(`[Sync] Lỗi Fetch: ${error}`, 'error');
            console.error("Sync Error:", error);
        }
        addToast(specificMessage, 'error');
        return null;
    }
  }, [userSettings?.isGoogleCalendarLinked, googleAccessToken, addToast, addLog]);


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
          
          // Fix: Validate status from Firestore to prevent type corruption.
          let status: TaskStatus;
          if (data.status === 'todo' || data.status === 'inprogress' || data.status === 'completed') {
            status = data.status;
          } else {
            status = data.completed ? 'completed' : 'todo';
          }
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
    const newTaskData = {
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
      googleCalendarEventId: '',
    };

    try {
      if (dueDate) {
          const eventId = await syncWithCalendar('create', { ...newTaskData, createdAt: new Date().toISOString(), dueDate });
          if (eventId) {
            newTaskData.googleCalendarEventId = eventId;
          }
      }
      await addDoc(collection(db, 'tasks'), newTaskData);
      addToast('Đã thêm công việc mới!', 'success');
    } catch (error) {
      console.error("Error adding task: ", error);
      addToast('Không thể thêm công việc.', 'error');
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar]);
  
  const addTasksBatch = useCallback(async (tasksToAdd: { text: string; tags: string[]; dueDate: string | null; isUrgent: boolean }[]) => {
    if (isGuestMode) {
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
    
    addToast(`Đang xử lý ${tasksToAdd.length} công việc...`, 'info');

    for (const task of tasksToAdd) {
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
            googleCalendarEventId: '',
        };
        if (taskData.dueDate) {
            const eventId = await syncWithCalendar('create', { ...taskData, createdAt: new Date().toISOString(), dueDate: task.dueDate });
            if (eventId) {
              taskData.googleCalendarEventId = eventId;
            }
        }
        batch.set(newDocRef, taskData);
    }

    try {
        await batch.commit();
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
    const originalTasks = tasksRef.current;
    const task = originalTasks.find(t => t.id === id);
    if (!task || task.text === trimmedText) return;
    
    setTasks(current => current.map(t => t.id === id ? {...t, text: trimmedText} : t));

    try {
        if (task.dueDate) {
          await syncWithCalendar('update', { ...task, text: trimmedText });
        }
        await updateDoc(doc(db, 'tasks', id), { text: trimmedText });
        addToast('Đã cập nhật nội dung công việc.', 'success');
    } catch (error) {
      console.error("Error updating task text: ", error);
      addToast('Không thể cập nhật công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar]);

  const updateTaskNote = useCallback(async (id: string, newNote: string) => {
    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.map(t => t.id === id ? { ...t, note: newNote } : t);
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật ghi chú.', 'success');
        return;
    }

    if (!currentUser) return;
    const originalTasks = tasksRef.current;
    const task = originalTasks.find(t => t.id === id);
    if (!task || task.note === newNote) return;
    
    setTasks(current => current.map(t => t.id === id ? {...t, note: newNote} : t));

    try {
        if (task.dueDate) {
          await syncWithCalendar('update', { ...task, note: newNote });
        }
        await updateDoc(doc(db, 'tasks', id), { note: newNote });
        addToast('Đã cập nhật ghi chú.', 'success');
    } catch (error) {
      console.error("Error updating task note: ", error);
      addToast('Không thể cập nhật ghi chú.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar]);


  const toggleTask = useCallback(async (id: string) => {
    const taskToToggle = tasksRef.current.find(t => t.id === id);
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
    const originalTasks = tasksRef.current;
    setTasks(currentTasks => currentTasks.map(task =>
        task.id === id ? { ...task, status: newStatus } : task
    ));
    
    try {
        if (taskToToggle.dueDate) {
           await syncWithCalendar('update', { ...taskToToggle, status: newStatus });
        }
        await updateDoc(doc(db, 'tasks', id), { status: newStatus });
        
        if (newStatus === 'completed' && taskToToggle.recurrenceRule && taskToToggle.recurrenceRule !== 'none' && taskToToggle.dueDate) {
            let nextDueDate: Date;
            const currentDueDate = new Date(taskToToggle.dueDate);
            switch (taskToToggle.recurrenceRule) {
                case 'daily': nextDueDate = addDays(currentDueDate, 1); break;
                case 'weekly': nextDueDate = addWeeks(currentDueDate, 1); break;
                case 'monthly': nextDueDate = addMonths(currentDueDate, 1); break;
                default: nextDueDate = currentDueDate; 
            }
             await addTask(taskToToggle.text, taskToToggle.hashtags, nextDueDate.toISOString(), taskToToggle.isUrgent, taskToToggle.recurrenceRule);
             await updateDoc(doc(db, 'tasks', id), { recurrenceRule: 'none' });
        }
        
        addToast('Đã cập nhật trạng thái công việc.', 'success');
    } catch (error) {
      console.error("Error toggling task: ", error);
      addToast('Không thể cập nhật công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar, addTask]);

  const deleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasksRef.current.find(t => t.id === id);
    if (!taskToDelete) return;

    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.filter(task => task.id !== id && task.parentId !== id);
        updateGuestTasks(newTasks);
        addToast('Đã xóa công việc.', 'success');
        return;
    }
    if (!currentUser) return;
    const originalTasks = tasksRef.current;
    setTasks(currentTasks => currentTasks.filter(task => task.id !== id && task.parentId !== id));
    
    try {
      if (taskToDelete.dueDate && taskToDelete.googleCalendarEventId) {
        await syncWithCalendar('delete', taskToDelete);
      }

      const subtasksToDelete = tasksRef.current.filter(t => t.parentId === id).map(t => t.id);
      const allIdsToDelete = [id, ...subtasksToDelete];
      
      const batch = writeBatch(db);
      allIdsToDelete.forEach(taskId => {
        batch.delete(doc(db, 'tasks', taskId));
      });
      await batch.commit();
      addToast('Đã xóa công việc.', 'success');
    } catch (error) {
      console.error("Error deleting task: ", error);
      addToast('Không thể xóa công việc.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar]);

  const toggleTaskUrgency = useCallback(async (id: string) => {
     if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.map(t => t.id === id ? { ...t, isUrgent: !t.isUrgent } : t);
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật độ khẩn cấp.', 'success');
        return;
    }

    if (!currentUser) return;
    const originalTasks = tasksRef.current;
    const task = originalTasks.find(t => t.id === id);
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
  }, [currentUser, isGuestMode, addToast]);

  const updateTaskDueDate = useCallback(async (id: string, newDueDate: string | null) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task) return;

    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        const newTasks = currentTasks.map(t => t.id === id ? { ...t, dueDate: newDueDate, reminderSent: false } : t);
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật thời hạn.', 'success');
        return;
    }
    
    if (!currentUser) return;
    const originalTasks = tasksRef.current;
    setTasks(current => current.map(t => t.id === id ? {...t, dueDate: newDueDate, reminderSent: false} : t));
    
    try {
        const updatedTask = { ...task, dueDate: newDueDate, reminderSent: false };
        let eventId = task.googleCalendarEventId;
        
        if (newDueDate && !eventId) { // Create new event
            const newEventId = await syncWithCalendar('create', updatedTask);
            if (newEventId) eventId = newEventId;
        } else if (newDueDate && eventId) { // Update existing event
            await syncWithCalendar('update', updatedTask);
        } else if (!newDueDate && eventId) { // Delete event if date is removed
            await syncWithCalendar('delete', updatedTask);
            eventId = '';
        }

        await updateDoc(doc(db, 'tasks', id), { 
            dueDate: newDueDate ? new Date(newDueDate) : null, 
            reminderSent: false,
            googleCalendarEventId: eventId || '' 
        });
        addToast('Đã cập nhật thời hạn.', 'success');
    } catch (error) {
      console.error("Error updating due date: ", error);
      addToast('Không thể cập nhật thời hạn.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar]);

  const markReminderSent = useCallback(async (id: string) => {
    if (isGuestMode) return;
    
    if (!currentUser) return;
    const originalTasks = tasksRef.current;
    setTasks(current => current.map(t => t.id === id ? {...t, reminderSent: true} : t));

    try {
        await updateDoc(doc(db, 'tasks', id), { reminderSent: true });
    } catch (error) {
      console.error("Error marking reminder sent: ", error);
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode]);

  const updateTaskStatus = useCallback(async (id: string, newStatus: TaskStatus) => {
    const task = tasksRef.current.find(t => t.id === id);
    if (!task || task.status === newStatus) return;
    
    if (isGuestMode) {
        const currentTasks = getGuestTasks();
        // Fix: Explicitly type the return value of the map callback as Task to ensure type safety.
        const newTasks = currentTasks.map((t: Task): Task => {
            return t.id === id ? { ...t, status: newStatus } : t;
        });
        updateGuestTasks(newTasks);
        addToast('Đã cập nhật trạng thái công việc.', 'success');
        return;
    }

    if (!currentUser) return;
    const originalTasks = tasksRef.current;
    
    setTasks(current => current.map((t): Task => (
        t.id === id ? { ...t, status: newStatus } : t
    )));

    try {
        if (task.dueDate) {
          await syncWithCalendar('update', { ...task, status: newStatus });
        }
        await updateDoc(doc(db, 'tasks', id), { status: newStatus });
        addToast('Đã cập nhật trạng thái công việc.', 'success');
    } catch (error) {
      console.error("Error updating task status: ", error);
      addToast('Không thể cập nhật trạng thái.', 'error');
      setTasks(originalTasks);
    }
  }, [currentUser, isGuestMode, addToast, syncWithCalendar]);

  const syncExistingTasksToCalendar = useCallback(async () => {
    addLog('[Manual Sync] Bắt đầu quá trình đồng bộ thủ công.', 'info');
    const tasksToSync = tasksRef.current.filter(t => t.dueDate && !t.googleCalendarEventId);
    
    if (tasksToSync.length === 0) {
      addToast("Tất cả công việc đã được đồng bộ.", 'info');
      addLog('[Manual Sync] Không có công việc nào cần đồng bộ.', 'info');
      return;
    }

    addToast(`Đang đồng bộ ${tasksToSync.length} công việc cũ...`, 'info');
    addLog(`[Manual Sync] Tìm thấy ${tasksToSync.length} công việc cần đồng bộ.`, 'info');

    const batch = writeBatch(db);
    let successCount = 0;

    for (const task of tasksToSync) {
        const eventId = await syncWithCalendar('create', task);
        if (eventId) {
            const taskRef = doc(db, 'tasks', task.id);
            batch.update(taskRef, { googleCalendarEventId: eventId });
            successCount++;
        }
    }

    try {
        await batch.commit();
        addToast(`Đã đồng bộ thành công ${successCount} công việc.`, 'success');
        addLog(`[Manual Sync] Hoàn tất: Đã đồng bộ ${successCount} công việc.`, 'success');
    } catch (error) {
        console.error("Error during batch sync update:", error);
        addToast("Có lỗi xảy ra khi cập nhật công việc sau khi đồng bộ.", 'error');
        addLog(`[Manual Sync] Lỗi khi cập nhật Firestore: ${error}`, 'error');
    }
  }, [syncWithCalendar, addToast, addLog]);


  return { tasks, addTask, addTasksBatch, addSubtasksBatch, toggleTask, deleteTask, markReminderSent, updateTaskDueDate, toggleTaskUrgency, updateTaskText, updateTaskStatus, updateTaskNote, syncExistingTasksToCalendar };
};
