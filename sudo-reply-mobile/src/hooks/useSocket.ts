import { useEffect, useRef } from 'react';
import { socketService } from '../services/socket';
import { useAuthStore } from '../stores/authStore';

export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && accessToken && user && !connectedRef.current) {
      socketService.connect(accessToken, { id: user.id, tenantId: user.tenantId });
      connectedRef.current = true;
    }

    return () => {
      if (!isAuthenticated) {
        socketService.disconnect();
        connectedRef.current = false;
      }
    };
  }, [isAuthenticated, accessToken, user]);

  return socketService;
}

export function useSocketEvent(
  event: string,
  callback: (...args: any[]) => void,
) {
  useEffect(() => {
    socketService.on(event, callback);
    return () => {
      socketService.off(event, callback);
    };
  }, [event, callback]);
}