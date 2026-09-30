import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizeFaceProfileInput, toFaceProfile } from '../features/face/face-profile-record';

const collection = 'faceProfiles';

function profileRef(uid) {
  if (typeof uid !== 'string' || !uid.trim()) throw Object.assign(new Error('Sesi masuk tidak tersedia.'), { code: 'FACE_PROFILE_AUTH_REQUIRED' });
  return doc(db, collection, uid);
}

export async function getFaceProfile(uid) {
  const snapshot = await getDoc(profileRef(uid));
  return snapshot.exists() ? toFaceProfile(snapshot.data()) : null;
}

export async function saveFaceProfile(uid, input) {
  const reference = profileRef(uid);
  const profile = normalizeFaceProfileInput(input);
  const current = await getDoc(reference);
  const now = new Date().toISOString();
  await setDoc(reference, { ...profile, enrolledAt: current.data()?.enrolledAt || serverTimestamp(), updatedAt: serverTimestamp() });
  return { ...profile, enrolledAt: toFaceProfile(current.data())?.enrolledAt || now, updatedAt: now };
}

export async function deleteFaceProfile(uid) {
  await deleteDoc(profileRef(uid));
}

export function faceProfileErrorMessage(error) {
  if (error?.code === 'FACE_PROFILE_AUTH_REQUIRED' || error?.code === 'permission-denied' || error?.code === 'unauthenticated') return 'Sesi masuk tidak memiliki akses ke profil wajah. Silakan masuk kembali.';
  if (error?.code === 'unavailable') return 'Penyimpanan profil wajah sedang tidak tersedia. Coba lagi.';
  return error?.message || 'Profil wajah belum dapat diproses. Coba lagi.';
}
