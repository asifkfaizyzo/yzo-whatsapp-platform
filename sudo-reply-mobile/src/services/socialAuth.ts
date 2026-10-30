import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ENDPOINTS } from '../config/api';
import api from './api';

/**
 * Web Client ID from Google Cloud project sudoreply-509410.
 * Used to obtain the ID token that the backend verifies.
 */
const GOOGLE_WEB_CLIENT_ID =
  '73639182000-vh6bmq0unbpecadgshv4f1ts883eqnv8.apps.googleusercontent.com';

// Configure once at module load
GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  scopes: ['openid', 'profile', 'email'],
});

/**
 * Open the native Google Sign-In UI and return the ID token.
 */
export async function signInWithGoogle(): Promise<string> {
  await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('No ID token received from Google');
  }
  return idToken;
}

/**
 * Send Google ID token to backend for verification.
 * Routes to /api2/google-login (TENANT) or /api3/google-login (USER).
 */
export async function loginWithGoogleBackend(
  credential: string,
  userType: 'USER' | 'TENANT',
) {
  const endpoint =
    userType === 'TENANT'
      ? ENDPOINTS.tenantAuth.googleLogin
      : ENDPOINTS.auth.googleLogin;

  const { data } = await api.post(endpoint, { credential });
  return data;
}

/**
 * Sign out from Google (call on app logout).
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-critical
  }
}

export function isGoogleConfigured(): boolean {
  return GOOGLE_WEB_CLIENT_ID.length > 0;
}