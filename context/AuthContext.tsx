
import React, { useContext, useState, useEffect, createContext, ReactNode } from 'react';
import { auth, db } from '../firebaseConfig';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

interface UserSettings {
  apiKey?: string;
  googleSheetUrl?: string;
}

interface AuthContextType {
  currentUser: firebase.User | null;
  loading: boolean;
  signup: (email: string, pass: string) => Promise<any>;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
  updateUserProfile: (name: string) => Promise<void>;
  userSettings: UserSettings | null;
  updateUserSettings: (settings: UserSettings) => Promise<void>;
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
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  function signup(email: string, pass: string) {
    return auth.createUserWithEmailAndPassword(email, pass)
      .then(userCredential => {
        if (userCredential.user) {
          // Create user settings document on signup
          return db.collection('users').doc(userCredential.user.uid).set({
            apiKey: '',
            googleSheetUrl: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
  }

  function login(email: string, pass: string) {
    return auth.signInWithEmailAndPassword(email, pass);
  }
  
  function logout() {
    return auth.signOut();
  }
  
  function resetPassword(email: string) {
    return auth.sendPasswordResetEmail(email);
  }

  function updateUserProfile(name: string) {
    if (auth.currentUser) {
      return auth.currentUser.updateProfile({
        displayName: name
      });
    }
    return Promise.reject(new Error("No user is logged in."));
  }
  
  async function updateUserSettings(settings: UserSettings) {
    if (currentUser) {
        const userDocRef = db.collection('users').doc(currentUser.uid);
        return userDocRef.set(settings, { merge: true });
    } else {
        return Promise.reject(new Error("No user logged in to update settings."));
    }
  }

  useEffect(() => {
    let unsubscribeSettings = () => {};

    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      unsubscribeSettings();
      setUserSettings(null);

      if (user) {
        setLoading(true);
        unsubscribeSettings = db.collection('users').doc(user.uid).onSnapshot(doc => {
            if (doc.exists) {
                setUserSettings(doc.data() as UserSettings);
            } else {
                // This case can happen if a user was created before this feature was implemented.
                db.collection('users').doc(user.uid).set({
                    apiKey: '',
                    googleSheetUrl: '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
                setUserSettings({});
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
