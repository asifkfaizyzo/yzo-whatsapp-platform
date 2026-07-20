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
    if (location.pathname === '/register') {
      return children;
    }
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
    location.pathname === '/plans' ||
    location.pathname === '/payment' ||
    location.pathname === '/checkout';
  // ❌ Incomplete onboarding → force them to the registration/onboarding page
  if (user?.type === 'TENANT' && !user?.onboardingCompleted) {
    if (location.pathname !== '/register') {
      return <Navigate to="/register" replace />;
    }
  } else if (user?.type === 'TENANT' && user?.onboardingCompleted) {
    // ✅ Enterprise Pending check
    if (user?.planStatus === 'enterprise_pending') {
      if (location.pathname !== '/enterprise-request') {
        return <Navigate to="/enterprise-request" replace />;
      }
      return children;
    }

    // Already finished onboarding → prevent accessing register page
    if (location.pathname === '/register') {
      return <Navigate to="/dashboard" replace />;
    }

    // ✅ No plan → select plan (only check if onboarding is fully completed!)
    const isPlanPage =
      location.pathname === '/select-plan' ||
      location.pathname === '/plans' ||
      location.pathname === '/payment' ||
      location.pathname === '/checkout' ||
      location.pathname === '/enterprise-request';

    if (!user.planId && user?.planStatus !== 'enterprise_active' && !isPlanPage) {
      return <Navigate to="/select-plan" replace />;
    }
  }

  return children;
};  // ← function closes HERE

export default ProtectedRoute;