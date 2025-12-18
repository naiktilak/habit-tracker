import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebaseService';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string, isSignUp?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to map Firebase User to App User and save to Firestore
  const handleUser = async (firebaseUser: FirebaseUser) => {
    try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);

        let userData: User;

        if (userSnap.exists()) {
          userData = userSnap.data() as User;
        } else {
          userData = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || undefined,
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`
          };
          await setDoc(userRef, userData);
        }

        setCurrentUser(userData);
    } catch (e) {
        console.error("Error fetching user data:", e);
        // Fallback to basic user if DB fails (e.g. permission or network)
        setCurrentUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || undefined,
            avatar: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`
        });
    }
  };

  useEffect(() => {
    // Safety timeout in case Auth never responds
    const safetyTimeout = setTimeout(() => {
        if (loading) {
            console.warn("Auth timeout reached, forcing load completion.");
            setLoading(false);
        }
    }, 3000);

    const unsubscribe = onAuthStateChanged(auth,
        async (user) => {
          try {
            if (user) {
              await handleUser(user);
            } else {
              setCurrentUser(null);
            }
          } catch (err) {
            console.error("Auth State Change Error:", err);
            setError("Failed to fetch user data.");
          } finally {
            setLoading(false);
            clearTimeout(safetyTimeout);
          }
        },
        (error) => {
            console.error("Auth Stream Error:", error);
            setError("Authentication service unavailable.");
            setLoading(false);
            clearTimeout(safetyTimeout);
        }
    );

    return () => {
        unsubscribe();
        clearTimeout(safetyTimeout);
    };
  }, []);

  const loginWithGoogle = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Login Error:", err);
      setError(err.message || "Failed to login with Google");
      throw err;
    }
  };

  const loginWithEmail = async (email: string, password: string, isSignUp = false) => {
    setError(null);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Email Login Error:", err);
      let msg = "Failed to login";
      if (err.code === 'auth/user-not-found') msg = "User not found";
      else if (err.code === 'auth/wrong-password') msg = "Incorrect password";
      else if (err.code === 'auth/email-already-in-use') msg = "Email already in use";
      else if (err.code === 'auth/weak-password') msg = "Password should be at least 6 characters";
      else if (err.code === 'auth/invalid-api-key') msg = "Configuration Error: Invalid API Key";
      setError(msg);
      throw err;
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
        console.error("Logout Error:", err);
        setError("Failed to logout");
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, loginWithGoogle, loginWithEmail, logout, error }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
