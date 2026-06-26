import React, { useEffect } from 'react';
import { useAdminAuthStore } from './store/useAdminAuthStore';
import AppRoutes from './routes/index';

function App() {
  const checkAuth = useAdminAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <AppRoutes />;
}

export default App;
