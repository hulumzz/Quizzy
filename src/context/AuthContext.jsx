import React, { useEffect, useState } from 'react';
import {
  auth,
  db,
  loginWithGoogle,
  loginAnonymously,
  loginWithEmail,
  registerWithEmail,
  logout,
  doc,
  setDoc,
  getDoc,
} from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        const cacheKey = `quizzy_user_profile:${firebaseUser.uid}`;
        try {
          const ref = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const profileData = snap.data();
            setUserProfile(profileData);
            localStorage.setItem(cacheKey, JSON.stringify(profileData));
          } else {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              setUserProfile(JSON.parse(cached));
            } else {
              setUserProfile(null);
            }
          }
        } catch (err) {
          console.warn('Firestore User Profile read fallback:', err.message);
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            setUserProfile(JSON.parse(cached));
          } else {
            setUserProfile(null);
          }
        }
      } else {
        setUser(null);
        setUserProfile(null);
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

  const signInWithEmailAndPassword = async (email, password) => loginWithEmail(email, password);
  const createAccountWithEmail = async (email, password) => registerWithEmail(email, password);

  const readUserProfile = async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
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
    setUserProfile(null);
    return logout();
  };

  const saveUserProfile = async (uid, profile) => {
    const ref = doc(db, 'users', uid);
    await setDoc(ref, profile, { merge: true });
    setUserProfile(profile);
    localStorage.setItem(`quizzy_user_profile:${uid}`, JSON.stringify(profile));
  };

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, signInWithGoogle, signInAsGuest, signInWithEmailAndPassword, createAccountWithEmail, signOut, saveUserProfile, readUserProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
