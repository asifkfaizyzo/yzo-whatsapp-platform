import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, isLoading, isHydrated } = useAuthStore();
  const location = useLocation();

    // ← ADD THESE
  console.log('=== ProtectedRoute CHECK ===');
  console.log('pathname:', location.pathname);
  console.log('isHydrated:', isHydrated);
  console.log('isLoading:', isLoading);
  console.log('isAuthenticated:', isAuthenticated);
  console.log('user type:', user?.type);
  console.log('user planId:', user?.planId);

  // ⏳ Wait for checkAuth() to finish — don't redirect yet
  if (!isHydrated || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#125EF2]" />
      </div>
    );
  }

  // ❌ Not logged in
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ❌ Wrong role
  const role = user.type === 'TENANT' ? 'admin' : 'agent';
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ No plan → select plan
  const isPlanPage =
    location.pathname === '/select-plan' ||
    location.pathname === '/payment';

  if (user.type === 'TENANT' && !user.planId && !isPlanPage) {
    return <Navigate to="/select-plan" replace />;
  }

  return children;
};  // ← function closes HERE

export default ProtectedRoute;