// ─────────────────────────────────────────────
// AdminRoute — Route Guard Component
// Redirects unauthenticated/unauthorized users to /admin/login
// ─────────────────────────────────────────────

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingState from '../ui/LoadingState';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { currentUser, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <LoadingState message="VERIFYING WARDEN CLEARANCE..." />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    // Save attempted location for seamless redirect after login
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
