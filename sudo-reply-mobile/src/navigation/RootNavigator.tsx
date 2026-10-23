import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';
import { useProfile } from '../hooks/useAuth';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useSocket } from '../hooks/useSocket';

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  // Hydrate tokens from SecureStore on mount
  useEffect(() => {
    hydrate().finally(() => setIsReady(true));
  }, [hydrate]);

  // Fetch profile if we have tokens but no user data yet
  const hasTokens = useAuthStore((s) => !!s.accessToken);
  const hasUser = useAuthStore((s) => !!s.user);
  useProfile(); // auto-fetches when userType is set

  // Connect socket when authenticated
  useSocket();

  if (!isReady || isLoading) {
    return <LoadingSpinner fullScreen message="Loading Sudo Reply..." />;
  }

  // If we have tokens but haven't loaded the user profile yet, show spinner
  if (hasTokens && !hasUser && !isAuthenticated) {
    return <LoadingSpinner fullScreen message="Verifying session..." />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};