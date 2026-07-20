import { useEffect } from 'react';
import AppRoutes from './routes/appRoutes';
import { useAuthStore } from './store/useAuthStore';
import { ConfirmProvider } from './context/ConfirmContext';
import { ToastProvider } from './context/ToastContext';

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    checkAuth();
  }, []);

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#125EF2]" />
      </div>
    );
  }

  return (
    <ConfirmProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </ConfirmProvider>
  );
}

export default App;
