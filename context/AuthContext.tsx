
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
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Theme } from '../types';

interface UserSettings {
  apiKey?: string;
  googleSheetUrl?: string;
  theme?: Theme;
  avatarUrl?: string;
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  async function signup(email: string, pass: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    if (userCredential.user) {
      // Create user settings document on signup
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      return setDoc(userDocRef, {
        apiKey: '',
        googleSheetUrl: '',
        theme: 'default',
        createdAt: serverTimestamp(),
      });
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
        setLoading(false);
      }
    });

    return () => {
        unsubscribeAuth();
        unsubscribeSettings();
    };
  }, []);


  const value: AuthContextType = {
    currentUser,
    loading,
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