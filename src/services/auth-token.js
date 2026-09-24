import { auth } from '../lib/firebase';

export async function getAuthToken({ forceRefresh = false } = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const error = new Error('Sesi pengguna tidak tersedia.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  return currentUser.getIdToken(forceRefresh);
}
