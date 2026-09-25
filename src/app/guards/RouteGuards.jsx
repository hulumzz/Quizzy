import { Navigate, useLocation } from 'react-router-dom';
import { homeForRole } from '../navigation';
import { useAuth } from '../../context/useAuth';
import { PageLoader } from '../../components/ui';

function LoadingScreen() {
  return <div className="qz-app-shell"><PageLoader label="Menyiapkan ruang belajar..." /></div>;
}

export function RequireAuth({ children }) {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!['teacher', 'student'].includes(userProfile?.role) || (!userProfile?.isAnonymous && (!userProfile?.profileCompleted || !userProfile?.institution?.trim()))) return <Navigate to="/onboarding" replace />;
  return children;
}

export function RequireRole({ role, children }) {
  const { userProfile } = useAuth();
  if (userProfile?.role !== role) return <Navigate to={homeForRole(userProfile?.role)} replace />;
  return children;
}

export function PublicOnly({ children }) {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user && userProfile?.role) return <Navigate to={homeForRole(userProfile.role)} replace />;
  return children;
}
