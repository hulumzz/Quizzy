import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  increment 
} from "firebase/firestore";

// Firebase credentials extracted from existing legacy Quizzy project
const firebaseConfig = {
  apiKey: "AIzaSyCV6MW5B2Au4gEbeSO5qdvb3TSmpdAir5s",
  authDomain: "quizzy-eb33b.firebaseapp.com",
  databaseURL: "https://quizzy-eb33b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "quizzy-eb33b",
  storageBucket: "quizzy-eb33b.firebasestorage.app",
  messagingSenderId: "519164189816",
  appId: "1:519164189816:web:444bce5bfde0add134e18d",
  measurementId: "G-PGK6EPK64V"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Auth Helpers
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const loginAnonymously = () => signInAnonymously(auth);
export const logout = () => signOut(auth);

export { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  increment 
};
