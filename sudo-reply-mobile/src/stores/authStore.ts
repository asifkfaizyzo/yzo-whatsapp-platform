import { create } from 'zustand';
import { AuthStorage } from '../services/auth';
import { socketService } from '../services/socket';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  tenantId: string;
  availabilityStatus?: 'AVAILABLE' | 'AWAY' | 'OFFLINE';
  tenant?: {
    id: string;
    tenantName: string | null;
    logo: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface AuthState {
  // ── Data ──
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  userType: 'USER' | 'TENANT' | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // ── Actions ──
  setAuth: (
    user: UserProfile,
    accessToken: string,
    refreshToken: string,
    userType: 'USER' | 'TENANT',
  ) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  setAvailability: (status: 'AVAILABLE' | 'AWAY' | 'OFFLINE') => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  hydrate: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  userType: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, accessToken, refreshToken, userType) => {
    AuthStorage.saveTokens(accessToken, refreshToken);
    AuthStorage.saveUserType(userType);
    set({
      user,
      accessToken,
      refreshToken,
      userType,
      isAuthenticated: true,
      isLoading: false,
    });
    socketService.connect();
  },

  setTokens: (accessToken, refreshToken) => {
    AuthStorage.saveTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (user) => set({ user }),

  setAvailability: (status) => {
    const { user } = get();
    if (user) {
      set({ user: { ...user, availabilityStatus: status } });
    }
  },

  setLoading: (isLoading) => set({ isLoading }),

  logout: () => {
    AuthStorage.clearAll();
    socketService.disconnect();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      userType: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, userType] = await Promise.all([
        AuthStorage.getAccessToken(),
        AuthStorage.getRefreshToken(),
        AuthStorage.getUserType(),
      ]);

      if (accessToken && refreshToken && userType) {
        set({
          accessToken,
          refreshToken,
          userType,
          isLoading: false,
        });
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },
}));