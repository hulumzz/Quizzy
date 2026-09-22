import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  db,
  loginWithGoogle,
  loginAnonymously,
  logout,
  doc,
  setDoc,
  getDoc,
} from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('quizzy_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Try fetching user profile from Firestore with fallback to localStorage
        try {
          const ref = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const profileData = snap.data();
            setUserProfile(profileData);
            localStorage.setItem('quizzy_user_profile', JSON.stringify(profileData));
          } else {
            // Check local storage cache
            const cached = localStorage.getItem('quizzy_user_profile');
            if (cached) {
              setUserProfile(JSON.parse(cached));
            } else {
              setUserProfile(null);
            }
          }
        } catch (err) {
          console.warn('Firestore User Profile read fallback:', err.message);
          // Fallback to cached profile or construct default from auth user
          const cached = localStorage.getItem('quizzy_user_profile');
          if (cached) {
            setUserProfile(JSON.parse(cached));
          } else {
            setUserProfile({
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Pengguna',
              email: firebaseUser.email,
              role: 'teacher', // default role fallback
              avatar: firebaseUser.photoURL,
              isAnonymous: firebaseUser.isAnonymous,
            });
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
        localStorage.removeItem('quizzy_user_profile');
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await loginWithGoogle();
      return result;
    } catch (err) {
      console.error('Google Sign In Error:', err);
      throw err;
    }
  };

  const signInAsGuest = async () => {
    try {
      const result = await loginAnonymously();
      return result;
    } catch (err) {
      console.error('Guest Sign In Error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('quizzy_user_profile');
    setUserProfile(null);
    return logout();
  };

  const saveUserProfile = async (uid, profile) => {
    // Always update state & localStorage first for instant UX
    setUserProfile(profile);
    localStorage.setItem('quizzy_user_profile', JSON.stringify(profile));

    // Try persisting to Firestore asynchronously
    try {
      const ref = doc(db, 'users', uid);
      await setDoc(ref, profile, { merge: true });
    } catch (err) {
      console.warn('Firestore User Profile save warning (saved locally):', err.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, signInWithGoogle, signInAsGuest, signOut, saveUserProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
