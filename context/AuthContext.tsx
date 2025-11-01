import React, { useContext, useState, useEffect, createContext, ReactNode } from 'react';
import { auth, db } from '../firebaseConfig';
import { 
  User, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  linkWithPopup,
  unlink,
  UserCredential,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, writeBatch, collection } from 'firebase/firestore';
import { UserSettings, Task } from '../types';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isGuestMode: boolean;
  googleAccessToken: string | null;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  signup: (email: string, pass: string) => Promise<any>;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
  updateUserProfile: (name: string) => Promise<void>;
  userSettings: UserSettings | null;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  linkGoogleAccount: () => Promise<void>;
  unlinkGoogleAccount: () => Promise<void>;
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
const GOOGLE_ACCESS_TOKEN_KEY = 'ptodo-google-token';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => sessionStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY));
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
        isGoogleCalendarLinked: false,
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
    sessionStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
    setGoogleAccessToken(null);
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
      return;
    }
    if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        return setDoc(userDocRef, settings, { merge: true });
    } else {
        return Promise.reject(new Error("No user logged in to update settings."));
    }
  }

  const linkGoogleAccount = async () => {
    if (!currentUser) throw new Error("User not logged in");
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    try {
        const result: UserCredential = await linkWithPopup(currentUser, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
            sessionStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, credential.accessToken);
            setGoogleAccessToken(credential.accessToken);
        }
        await updateUserSettings({ isGoogleCalendarLinked: true });
    } catch (error) {
        console.error("Error linking Google account:", error);
        throw error;
    }
  };
  
  const unlinkGoogleAccount = async () => {
    if (!currentUser) throw new Error("User not logged in");
    try {
        await unlink(currentUser, 'google.com');
        sessionStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
        setGoogleAccessToken(null);
        await updateUserSettings({ isGoogleCalendarLinked: false });
    } catch (error) {
        console.error("Error unlinking Google account:", error);
        throw error;
    }
  };

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
                const settings = docSnap.data() as UserSettings;
                setUserSettings(settings);
            } else {
                setDoc(userDocRef, {
                    apiKey: '',
                    googleSheetUrl: '',
                    theme: 'default',
                    isGoogleCalendarLinked: false,
                    createdAt: serverTimestamp(),
                });
                setUserSettings({ theme: 'default', isGoogleCalendarLinked: false});
            }
            setLoading(false);
        }, error => {
            console.error("Error fetching user settings:", error);
            setUserSettings({}); // Provide empty settings to avoid blocking the app
            setLoading(false);
        });
      } else {
        // If no user, clear token and finish loading if not in guest mode
        sessionStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
        setGoogleAccessToken(null);
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
    googleAccessToken,
    enterGuestMode,
    exitGuestMode,
    signup,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    userSettings,
    updateUserSettings,
    linkGoogleAccount,
    unlinkGoogleAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};