import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// Ensure ENCRYPTION_KEY in .env is 32 bytes hex string (64 characters) or fallback to secret
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.ACCESS_SECRET || 'fallback_encryption_secret_key_32b')
  .digest();

export const encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decrypt = (text) => {
  if (!text || !text.includes(':')) return text;
  try {
    const [ivHex, authTagHex, encryptedHex] = text.split(':');
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      SECRET_KEY,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Failed to decrypt token:', e.message);
    return text; // return original if decryption fails (for backward compatibility)
  }
};