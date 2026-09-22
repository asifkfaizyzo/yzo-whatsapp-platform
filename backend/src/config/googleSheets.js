import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

/**
 * Creates a new OAuth2 client instance
 * @param {Object} tokens - Optional tokens to set in credentials
 */
export const getOAuth2Client = (tokens = null) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    console.error("❌ Google OAuth Credentials missing in .env");
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI // This is the missing parameter causing your error
  );

  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }

  return oauth2Client;
};

/**
 * Gets a Google Sheets client for a specific tenant
 */
export const getSheetsClient = async (tenantId) => {
  // We will handle the database lookup in the service, 
  // but this utility helps create the base client
  const oauth2Client = getOAuth2Client();
  return google.sheets({ version: 'v4', auth: oauth2Client });
};