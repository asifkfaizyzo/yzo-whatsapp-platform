import crypto from 'node:crypto';

export const normalizeWooStoreHost = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
};

export const verifyWooAuthEventSignature = ({
  secret,
  timestamp,
  signature,
  rawBody,
  nowSeconds = Math.floor(Date.now() / 1000),
}) => {
  if (!secret || !/^\d{10}$/.test(String(timestamp)) || !Buffer.isBuffer(rawBody)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 5 * 60) return false;

  const received = String(signature || '').replace(/^sha256=/, '');
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
  const receivedBuffer = Buffer.from(received, 'hex');
  return expected.length === receivedBuffer.length && crypto.timingSafeEqual(expected, receivedBuffer);
};

export const isWooStoreUrl = ({ candidate, storeUrl, allowHttp = false }) => {
  try {
    const url = new URL(candidate);
    const storeHost = normalizeWooStoreHost(storeUrl);
    return Boolean(storeHost)
      && normalizeWooStoreHost(url.origin) === storeHost
      && (url.protocol === 'https:' || (allowHttp && url.protocol === 'http:'))
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
};
