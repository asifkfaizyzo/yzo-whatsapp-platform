import React, { useEffect } from 'react';
import { useAdminAuthStore } from './store/useAdminAuthStore';
import AppRoutes from './routes/index';
import { ConfirmProvider } from './context/ConfirmContext';
import { ToastProvider } from './context/ToastContext';

function App() {
  const checkAuth = useAdminAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ConfirmProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </ConfirmProvider>
  );
}

export default App;
