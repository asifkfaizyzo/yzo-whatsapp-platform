import { useEffect, useRef } from 'react';
import { socketService } from '../services/socket';
import { useAuthStore } from '../stores/authStore';

export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !connectedRef.current) {
      socketService.connect();
      connectedRef.current = true;
    }

    return () => {
      if (!isAuthenticated) {
        socketService.disconnect();
        connectedRef.current = false;
      }
    };
  }, [isAuthenticated]);

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