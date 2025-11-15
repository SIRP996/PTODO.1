
import React, { useContext, useState, useEffect, createContext, ReactNode, useCallback } from 'react';
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
  signInWithPopup,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, writeBatch, collection, updateDoc, deleteField, query, where, getDocs, arrayUnion, getDoc } from 'firebase/firestore';
import { UserSettings, Task } from '../types';
import { useToast } from './ToastContext';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isGuestMode: boolean;
  googleAccessToken: string | null;
  setGoogleAccessToken: (token: string | null) => void;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  signup: (email: string, pass: string) => Promise<any>;
  login: (email: string, pass: string) => Promise<any>;
  loginWithGoogle: () => Promise<void>;
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
const PENDING_INVITATION_ID = 'pendingInvitationId';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => sessionStorage.getItem(GOOGLE_ACCESS_TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(() => {
      return sessionStorage.getItem(GUEST_MODE_KEY) === 'true';
  });
  const { addToast } = useToast();

  const handlePendingInvitations = useCallback(async (user: User) => {
    if (!user.email) return;

    const projectNames: string[] = [];
    const batch = writeBatch(db);
    let invitationsFound = false;

    // 1. Check for invitation from URL
    const pendingInvitationId = sessionStorage.getItem(PENDING_INVITATION_ID);
    if (pendingInvitationId) {
      const invRef = doc(db, 'invitations', pendingInvitationId);
      const invSnap = await getDoc(invRef);
      if (invSnap.exists()) {
        const invitation = invSnap.data();
        if (invitation.inviteeEmail === user.email && invitation.status === 'pending') {
          const projectRef = doc(db, 'projects', invitation.projectId);
          batch.update(projectRef, { memberIds: arrayUnion(user.uid) });
          batch.update(invRef, { status: 'accepted' });
          projectNames.push(invitation.projectName);
          invitationsFound = true;
        }
      }
      sessionStorage.removeItem(PENDING_INVITATION_ID);
    }
    
    // 2. Check for other invitations matching user's email
    const invitationsQuery = query(
        collection(db, 'invitations'),
        where('inviteeEmail', '==', user.email),
        where('status', '==', 'pending')
    );
    const querySnapshot = await getDocs(invitationsQuery);
    if (!querySnapshot.empty) {
      querySnapshot.forEach(docSnap => {
        // Avoid processing the one from the link again
        if (docSnap.id !== pendingInvitationId) {
          const invitation = docSnap.data();
          const projectRef = doc(db, 'projects', invitation.projectId);
          batch.update(projectRef, { memberIds: arrayUnion(user.uid) });
          const invitationRef = doc(db, 'invitations', docSnap.id);
          batch.update(invitationRef, { status: 'accepted' });
          if (!projectNames.includes(invitation.projectName)) {
              projectNames.push(invitation.projectName);
          }
          invitationsFound = true;
        }
      });
    }

    if (invitationsFound) {
      try {
        await batch.commit();
        if (projectNames.length > 0) {
          addToast(`Bạn đã được tự động thêm vào dự án: ${projectNames.join(', ')}`, 'success');
        }
      } catch (error) {
        console.error("Error auto-accepting invitations: ", error);
      }
    }
  }, [addToast]);

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
      const user = userCredential.user;
      sessionStorage.removeItem(GUEST_MODE_KEY);
      setIsGuestMode(false);
      // Create user settings document on signup
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        displayName: user.displayName || email.split('@')[0],
        email: user.email,
        photoURL: user.photoURL,
        apiKey: '',
        googleSheetUrl: '',
        theme: 'default',
        isGoogleCalendarLinked: false,
        createdAt: serverTimestamp(),
      });
      // Migrate tasks AFTER user doc is created
      await migrateGuestTasks(user.uid);
    }
  }

  function login(email: string, pass: string) {
    return signInWithEmailAndPassword(auth, email, pass);
  }

  async function loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, { 
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      isGoogleCalendarLinked: true 
    }, { merge: true });

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
        sessionStorage.setItem(GOOGLE_ACCESS_TOKEN_KEY, credential.accessToken);
        setGoogleAccessToken(credential.accessToken);
    }
    
    await migrateGuestTasks(user.uid);
    sessionStorage.removeItem(GUEST_MODE_KEY);
    setIsGuestMode(false);
  }
  
  function logout() {
    sessionStorage.removeItem(GOOGLE_ACCESS_TOKEN_KEY);
    setGoogleAccessToken(null);
    return signOut(auth);
  }
  
  function resetPassword(email: string) {
    return sendPasswordResetEmail(auth, email);
  }

  async function updateUserProfile(name: string) {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: name });
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, { displayName: name });
    } else {
      return Promise.reject(new Error("No user is logged in."));
    }
  }
  
  async function updateUserSettings(settings: Partial<UserSettings>) {
    if (isGuestMode) {
      const currentSettings = userSettings || {};
      const newSettings = { ...currentSettings, ...settings };
      setUserSettings(newSettings);
      return;
    }
    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const settingsToUpdate: { [key: string]: any } = { ...settings };
      
      if (settings.avatarUrl) {
          settingsToUpdate.photoURL = settings.avatarUrl;
      }
      if (settings.avatarUrl === '') {
          settingsToUpdate.photoURL = currentUser.photoURL; // Reset to original auth photoURL
      }

      for (const key in settingsToUpdate) {
        if (settingsToUpdate[key] === null || settingsToUpdate[key] === undefined) {
          settingsToUpdate[key] = deleteField();
        }
      }
      
      return updateDoc(userDocRef, settingsToUpdate);
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
            await updateUserSettings({ isGoogleCalendarLinked: true });
            setUserSettings(current => ({...(current || {}), isGoogleCalendarLinked: true }));
        } else {
            throw new Error("Không nhận được token truy cập từ Google sau khi xác thực.");
        }
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
        setUserSettings(current => ({...(current || {}), isGoogleCalendarLinked: false }));
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
        handlePendingInvitations(user);
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
                    displayName: user.displayName || user.email?.split('@')[0],
                    email: user.email,
                    photoURL: user.photoURL,
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
            setUserSettings({}); 
            setLoading(false);
        });
      } else {
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
  }, [handlePendingInvitations]);

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
    setGoogleAccessToken,
    enterGuestMode,
    exitGuestMode,
    signup,
    login,
    loginWithGoogle,
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
