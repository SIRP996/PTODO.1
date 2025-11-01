

import React, { useContext, useState, useEffect, createContext, ReactNode } from 'react';
import { auth, db } from '../firebaseConfig';
import { 
  User, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, writeBatch, collection } from 'firebase/firestore';
import { Theme, Task } from '../types';

interface UserSettings {
  apiKey?: string;
  googleSheetUrl?: string;
  theme?: Theme;
  avatarUrl?: string;
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isGuestMode: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  signup: (email: string, pass: string) => Promise<any>;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
  updateUserProfile: (name: string) => Promise<void>;
  userSettings: UserSettings | null;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

const GUEST_TASKS_KEY = 'ptodo-guest-tasks';
const GUEST_MODE_KEY = 'ptodo-is-guest';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(() => {
      return sessionStorage.getItem(GUEST_MODE_KEY) === 'true';
  });

  const enterGuestMode = () => {
    if (currentUser) {
      logout();
    }
    sessionStorage.setItem(GUEST_MODE_KEY, 'true');
    setIsGuestMode(true);
  };
  
  const exitGuestMode = () => {
    sessionStorage.removeItem(GUEST_MODE_KEY);
    localStorage.removeItem(GUEST_TASKS_KEY);
    setIsGuestMode(false);
  };

  async function migrateGuestTasks(userId: string) {
    const guestTasksRaw = localStorage.getItem(GUEST_TASKS_KEY);
    if (guestTasksRaw) {
      const guestTasks: Omit<Task, 'id' | 'userId'>[] = JSON.parse(guestTasksRaw);
      if (guestTasks.length > 0) {
        const batch = writeBatch(db);
        const tasksCollectionRef = collection(db, 'tasks');
        guestTasks.forEach(task => {
          const newDocRef = doc(tasksCollectionRef);
          const taskData = {
            ...task,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            createdAt: serverTimestamp(),
            userId: userId,
          };
          batch.set(newDocRef, taskData);
        });
        await batch.commit();
        localStorage.removeItem(GUEST_TASKS_KEY); // Clear after migration
      }
    }
  }
  
  async function signup(email: string, pass: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    if (userCredential.user) {
      sessionStorage.removeItem(GUEST_MODE_KEY);
      setIsGuestMode(false);
      // Create user settings document on signup
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        apiKey: '',
        googleSheetUrl: '',
        theme: 'default',
        createdAt: serverTimestamp(),
      });
      // Migrate tasks AFTER user doc is created
      await migrateGuestTasks(userCredential.user.uid);
    }
  }

  function login(email: string, pass: string) {
    return signInWithEmailAndPassword(auth, email, pass);
  }
  
  function logout() {
    return signOut(auth);
  }
  
  function resetPassword(email: string) {
    return sendPasswordResetEmail(auth, email);
  }

  function updateUserProfile(name: string) {
    if (auth.currentUser) {
      return updateProfile(auth.currentUser, {
        displayName: name
      });
    }
    return Promise.reject(new Error("No user is logged in."));
  }
  
  async function updateUserSettings(settings: Partial<UserSettings>) {
    if (isGuestMode) {
      // In guest mode, we can only update theme, which is stored in localStorage
      const currentSettings = userSettings || {};
      const newSettings = { ...currentSettings, ...settings };
      setUserSettings(newSettings);
      // This part might need to be handled where the theme is applied (e.g., App.tsx)
      return;
    }
    if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        return setDoc(userDocRef, settings, { merge: true });
    } else {
        return Promise.reject(new Error("No user logged in to update settings."));
    }
  }

  useEffect(() => {
    let unsubscribeSettings = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      unsubscribeSettings();
      setUserSettings(null);
      
      if (user) {
        sessionStorage.removeItem(GUEST_MODE_KEY);
        setIsGuestMode(false);
        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeSettings = onSnapshot(userDocRef, docSnap => {
            if (docSnap.exists()) {
                setUserSettings(docSnap.data() as UserSettings);
            } else {
                // This case can happen if a user was created before this feature was implemented.
                setDoc(userDocRef, {
                    apiKey: '',
                    googleSheetUrl: '',
                    theme: 'default',
                    createdAt: serverTimestamp(),
                });
                setUserSettings({ theme: 'default'});
            }
            setLoading(false);
        }, error => {
            console.error("Error fetching user settings:", error);
            setUserSettings({}); // Provide empty settings to avoid blocking the app
            setLoading(false);
        });
      } else {
        // If no user and not in guest mode, finish loading
        if (!sessionStorage.getItem(GUEST_MODE_KEY)) {
            setLoading(false);
        }
      }
    });

    return () => {
        unsubscribeAuth();
        unsubscribeSettings();
    };
  }, []);

  // Effect to handle initial load for guest mode
  useEffect(() => {
    if (isGuestMode && !currentUser) {
      setLoading(false);
    }
  }, [isGuestMode, currentUser]);


  const value: AuthContextType = {
    currentUser,
    loading,
    isGuestMode,
    enterGuestMode,
    exitGuestMode,
    signup,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    userSettings,
    updateUserSettings,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};