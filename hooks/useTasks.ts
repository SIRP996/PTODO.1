
import { useState, useEffect, useCallback } from 'react';
import { Task } from '../types';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebaseConfig';
// Fix: Import firebase for Timestamp and FieldValue, and import firestore for side effects to use v8 compat API.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export const useTasks = () => {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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
          
          return {
            id: docSnapshot.id,
            ...data,
            createdAt,
            dueDate,
          } as Task;
        });
        setTasks(tasksData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tasks:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const addTask = useCallback(async (text: string, tags: string[], dueDate: string | null, isUrgent: boolean, recurrenceRule: 'none' | 'daily' | 'weekly' | 'monthly') => {
    if (!text.trim() || !currentUser) return;

    const newTask = {
      text: text.trim(),
      completed: false,
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
    } catch (error) {
      console.error("Error adding task: ", error);
    }
  }, [currentUser]);

  const addSubtasksBatch = useCallback(async (parentId: string, subtaskTexts: string[]) => {
    if (!currentUser || subtaskTexts.length === 0) return;

    const batch = db.batch();
    const tasksCollectionRef = db.collection('tasks');

    subtaskTexts.forEach(text => {
        const newDocRef = tasksCollectionRef.doc();
        const subtaskData = {
            text: text.trim(),
            completed: false,
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
    } catch (error) {
        console.error("Error adding subtasks in batch: ", error);
    }
  }, [currentUser]);

  const toggleTask = useCallback(async (id: string) => {
    if (!currentUser) return;

    // Fix: Use v8 compat syntax for doc reference.
    const taskDocRef = db.collection('tasks').doc(id);
    const taskToToggle = tasks.find(t => t.id === id);
    if (!taskToToggle) return;

    try {
        if (!taskToToggle.completed && taskToToggle.recurrenceRule && taskToToggle.recurrenceRule !== 'none' && taskToToggle.dueDate) {
            
            let nextDueDate: Date;
            const currentDueDate = new Date(taskToToggle.dueDate);

            switch (taskToToggle.recurrenceRule) {
                case 'daily': nextDueDate = addDays(currentDueDate, 1); break;
                case 'weekly': nextDueDate = addWeeks(currentDueDate, 1); break;
                case 'monthly': nextDueDate = addMonths(currentDueDate, 1); break;
                default: nextDueDate = currentDueDate; 
            }

            const nextInstanceData = {
                text: taskToToggle.text,
                completed: false,
                // Fix: Use firebase.firestore.FieldValue.serverTimestamp() for v8 compat syntax.
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                dueDate: nextDueDate,
                hashtags: taskToToggle.hashtags,
                reminderSent: false,
                isUrgent: taskToToggle.isUrgent,
                recurrenceRule: taskToToggle.recurrenceRule,
                userId: currentUser.uid,
            };
            
            // Fix: Use v8 compat syntax for writeBatch.
            const batch = db.batch();
            batch.update(taskDocRef, { completed: true, recurrenceRule: 'none' });
            
            // Fix: Use v8 compat syntax for new doc reference.
            const newDocRef = db.collection('tasks').doc();
            batch.set(newDocRef, nextInstanceData);
            await batch.commit();

        } else {
            // Fix: Use v8 compat update method.
            await taskDocRef.update({ completed: !taskToToggle.completed });
        }
    } catch (error) {
      console.error("Error toggling task: ", error);
    }
  }, [currentUser, tasks]);

  const deleteTask = useCallback(async (id: string) => {
    if (!currentUser) return;
    try {
      // Fix: Use v8 compat syntax for deleting a document.
      await db.collection('tasks').doc(id).delete();
    } catch (error) {
      console.error("Error deleting task: ", error);
    }
  }, [currentUser]);

  const toggleTaskUrgency = useCallback(async (id: string) => {
    if (!currentUser) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
        // Fix: Use v8 compat syntax for updating a document.
        await db.collection('tasks').doc(id).update({ isUrgent: !task.isUrgent });
    } catch (error) {
      console.error("Error updating urgency: ", error);
    }
  }, [currentUser, tasks]);

  const updateTaskDueDate = useCallback(async (id: string, newDueDate: string | null) => {
    if (!currentUser) return;
    try {
        // Fix: Use v8 compat syntax for updating a document.
        await db.collection('tasks').doc(id).update({ dueDate: newDueDate ? new Date(newDueDate) : null, reminderSent: false });
    } catch (error) {
      console.error("Error updating due date: ", error);
    }
  }, [currentUser]);

  const markReminderSent = useCallback(async (id: string) => {
    if (!currentUser) return;
    try {
        // Fix: Use v8 compat syntax for updating a document.
        await db.collection('tasks').doc(id).update({ reminderSent: true });
    } catch (error) {
      console.error("Error marking reminder sent: ", error);
    }
  }, [currentUser]);


  return { tasks, addTask, addSubtasksBatch, toggleTask, deleteTask, markReminderSent, updateTaskDueDate, toggleTaskUrgency };
};