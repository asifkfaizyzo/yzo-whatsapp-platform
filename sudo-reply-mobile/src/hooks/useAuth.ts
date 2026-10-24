import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { ENDPOINTS } from '../config/api';
import { useAuthStore, UserProfile } from '../stores/authStore';

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: UserProfile;
    accessToken: string;
    refreshToken: string;
  };
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async ({
      email,
      password,
      userType,
    }: LoginPayload & { userType: 'USER' | 'TENANT' }) => {
      const endpoint =
        userType === 'TENANT'
          ? ENDPOINTS.tenantAuth.login
          : ENDPOINTS.auth.login;

      const { data } = await api.post<LoginResponse>(endpoint, {
        email,
        password,
      });
      return { ...data, userType };
    },
    onSuccess: (response) => {
      const { user, accessToken, refreshToken } = response.data;
      setAuth(user, accessToken, refreshToken, response.userType);
    },
  });
}

export function useProfile() {
  const { user, userType, setUser } = useAuthStore();

  return useQuery({
    queryKey: ['profile', userType],
    queryFn: async () => {
      const endpoint =
        userType === 'TENANT'
          ? ENDPOINTS.tenantAuth.me
          : ENDPOINTS.auth.me;
      const { data } = await api.get(endpoint);
      const profile = data.data || data;
      setUser(profile);
      return profile as UserProfile;
    },
    enabled: !!userType,
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useCallback(async () => {
    try {
      const { refreshToken, userType } = useAuthStore.getState();
      if (refreshToken) {
        const endpoint =
          userType === 'TENANT'
            ? ENDPOINTS.tenantAuth.logout
            : ENDPOINTS.auth.logout;
        await api.post(endpoint, { refreshToken }).catch(() => {});
      }
    } finally {
      logout();
    }
  }, [logout]);
}

export function useUnreadCount() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.auth.unreadCount);
      return data.data || data;
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
}