import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'sr_access_token',
  REFRESH_TOKEN: 'sr_refresh_token',
  USER_TYPE: 'sr_user_type',
} as const;

export const AuthStorage = {
  async saveTokens(accessToken: string, refreshToken?: string | null) {
  const tasks: Promise<void>[] = [];

  if (accessToken) {
    tasks.push(SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken));
  }

  if (refreshToken) {
    tasks.push(SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken));
  } else {
    // Clear stale refresh token if new login didn't provide one
    tasks.push(SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN));
  }

  await Promise.all(tasks);
},
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async saveUserType(type: 'USER' | 'TENANT') {
    await SecureStore.setItemAsync(KEYS.USER_TYPE, type);
  },

  async getUserType(): Promise<'USER' | 'TENANT' | null> {
    return SecureStore.getItemAsync(KEYS.USER_TYPE) as Promise<'USER' | 'TENANT' | null>;
  },

  async clearAll() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.USER_TYPE),
    ]);
  },
};