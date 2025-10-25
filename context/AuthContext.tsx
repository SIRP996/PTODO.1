
import React, { useContext, useState, useEffect, createContext, ReactNode } from 'react';
import { auth } from '../firebaseConfig';
// Fix: Import firebase to access the User type and auth methods via the compat layer.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

interface AuthContextType {
  // Fix: Use firebase.User type from the compat import.
  currentUser: firebase.User | null;
  loading: boolean;
  signup: (email: string, pass: string) => Promise<any>;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
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
  // Fix: Use firebase.User type from the compat import.
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  function signup(email: string, pass: string) {
    // Fix: Use auth object method for v8 compat syntax.
    return auth.createUserWithEmailAndPassword(email, pass);
  }

  function login(email: string, pass: string) {
    // Fix: Use auth object method for v8 compat syntax.
    return auth.signInWithEmailAndPassword(email, pass);
  }
  
  function logout() {
    // Fix: Use auth object method for v8 compat syntax.
    return auth.signOut();
  }
  
  function resetPassword(email: string) {
    // Fix: Use auth object method for v8 compat syntax.
    return auth.sendPasswordResetEmail(email);
  }

  useEffect(() => {
    // Fix: Use auth object method for v8 compat syntax.
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);


  const value: AuthContextType = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
