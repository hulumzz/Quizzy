import { Outlet } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

export default function AuthBoundary() {
  return <AuthProvider><Outlet /></AuthProvider>;
}
