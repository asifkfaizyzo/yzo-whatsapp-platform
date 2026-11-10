// backend/src/services/oauth.service.js (do not remove this comment)

import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token and extract normalized user info.
 * @param {string} idToken - ID token from Google Sign-In client SDK
 * @returns {Promise<{email: string, firstName: string, lastName: string, provider: string, providerId: string}>}
 */
export const verifyGoogleToken = async (idToken) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload.email) {
      throw new Error('Google account has no email address');
    }

    return {
      email: payload.email.toLowerCase().trim(),
      firstName: payload.given_name || '',
      lastName: payload.family_name || '',
      provider: 'GOOGLE',
      providerId: payload.sub,
    };
  } catch (error) {
    if (error.message.includes('no email')) throw error;
    throw new Error('Invalid or expired Google token');
  }
};

/**
 * Verify a Facebook access token and extract normalized user info.
 * @param {string} accessToken - Access token from Facebook Login client SDK
 * @returns {Promise<{email: string, firstName: string, lastName: string, provider: string, providerId: string}>}
 */
export const verifyFacebookToken = async (accessToken) => {
  try {
    const { data } = await axios.get('https://graph.facebook.com/me', {
      params: {
        fields: 'id,email,first_name,last_name',
        access_token: accessToken,
      },
      timeout: 10000,
    });

    if (!data.email) {
      throw new Error('Facebook account has no email address');
    }

    return {
      email: data.email.toLowerCase().trim(),
      firstName: data.first_name || '',
      lastName: data.last_name || '',
      provider: 'FACEBOOK',
      providerId: data.id,
    };
  } catch (error) {
    if (error.message.includes('no email')) throw error;
    throw new Error('Invalid or expired Facebook token');
  }
};