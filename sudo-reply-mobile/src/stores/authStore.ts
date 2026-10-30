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
    // 🔍 DIAGNOSTIC
    console.log('💾 setAuth called:', {
      hasAccess: !!accessToken,
      hasRefresh: !!refreshToken,
      refreshType: typeof refreshToken,
    });

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
    socketService.connect(accessToken, { id: user.id, tenantId: user.tenantId });
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

    console.log('🔐 Hydrate:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken, userType });

    if (accessToken && userType) {
      set({
        accessToken,
        refreshToken,
        userType,
        isAuthenticated: true,
        isLoading: false,
      });

      // Use raw axios — NO interceptor (prevents logout on 401 during hydration)
      try {
        const axios = (await import('axios')).default;
        const { API_BASE_URL } = await import('../config/api');
        const meEndpoint = userType === 'TENANT' ? '/api2/me' : '/api3/me';
        const { data } = await axios.get(`${API_BASE_URL}${meEndpoint}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        });
        const userData = data.data || data.user || data;
        console.log('👤 Hydrated user:', userData?.id, userData?.name);
        if (userData?.id) {
          set({ user: userData });
          socketService.connect(accessToken, {
            id: userData.id,
            tenantId: userData.tenantId,
          });
        }
      } catch (meError: any) {
        console.warn('⚠️ Hydrate /me failed:', meError?.response?.status || meError.message);
        // Don't logout — token might still be valid for other calls
      }

      return true;
    }

    console.log('🔐 No tokens found — showing login');
    set({ isLoading: false });
    return false;
  } catch (err) {
    console.error('❌ Hydrate error:', err);
    set({ isLoading: false });
    return false;
  }
},
}));