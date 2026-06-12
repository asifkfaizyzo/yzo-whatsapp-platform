import { useEffect } from 'react';
import AppRoutes from './routes/appRoutes'
import { useAuthStore } from './store/useAuthStore';

function App() {

  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth(); // Check cookie session on app load
  }, [checkAuth]);

  return (
    <AppRoutes />
  )
}

export default App
