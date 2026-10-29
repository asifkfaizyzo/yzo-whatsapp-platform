const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

class PushService {
  constructor() {
    this.accessToken = process.env.EXPO_ACCESS_TOKEN || null;
    console.log('🔔 Push notification service initialized (Expo Push API)');
    if (this.accessToken) {
      console.log('🔔 Expo access token loaded ✅');
    }
  }

  getHeaders() {
    const headers = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  isValidExpoToken(token) {
    return (
      token &&
      typeof token === 'string' &&
      token.startsWith('ExponentPushToken[')
    );
  }

  async sendToDevice({ token, title, body, data = {}, sound = 'default' }) {
    try {
      if (!token) {
        return { success: false, message: 'No push token provided' };
      }

      if (!this.isValidExpoToken(token)) {
        console.warn(`⚠️ Invalid Expo push token: ${token?.substring(0, 20)}`);
        return { success: false, message: 'Invalid push token format' };
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('========================================');
        console.log('🔔 PUSH NOTIFICATION');
        console.log(`Token: ${token.substring(0, 30)}...`);
        console.log(`Title: ${title}`);
        console.log(`Body:  ${body}`);
        console.log('========================================');
      }

      const message = {
        to: token,
        title,
        body,
        data,
        sound,
        priority: 'high',
        channelId: data?.channelId || 'default',
      };

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(10000),
      });

      const result = await response.json();
      const ticket = result?.data;

      if (ticket?.status === 'error') {
        console.error('🔔 Expo push error:', ticket.message);
        return { success: false, message: ticket.message, details: ticket.details };
      }

      console.log(`🔔 Push sent to ${token.substring(0, 30)}...`);
      return { success: true, message: 'Push sent', ticketId: ticket?.id };
    } catch (error) {
      console.error('🔔 Push send error:', error.message);
      return { success: false, message: error.message };
    }
  }

  async sendToMultiple({ tokens, title, body, data = {} }) {
    try {
      if (!tokens || tokens.length === 0) {
        return { success: false, message: 'No tokens provided' };
      }

      const validTokens = tokens.filter((t) => this.isValidExpoToken(t));
      if (validTokens.length === 0) {
        return { success: false, message: 'No valid Expo push tokens' };
      }

      const messages = validTokens.map((token) => ({
        to: token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
      }));

      const CHUNK_SIZE = 100;
      const results = { sent: 0, failed: 0, details: [] };

      for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
        const chunk = messages.slice(i, i + CHUNK_SIZE);

        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(chunk),
          signal: AbortSignal.timeout(30000),
        });

        const result = await response.json();
        const ticketData = result?.data || [];

        ticketData.forEach((ticket, index) => {
          if (ticket.status === 'ok') {
            results.sent++;
          } else {
            results.failed++;
            results.details.push({ token: chunk[index].to, error: ticket.message });
          }
        });
      }

      console.log(`🔔 Bulk push: ${results.sent} sent, ${results.failed} failed`);
      return { success: true, ...results };
    } catch (error) {
      console.error('🔔 Bulk push error:', error.message);
      return { success: false, message: error.message };
    }
  }

  async checkReceipts(ticketIds) {
    try {
      if (!ticketIds || ticketIds.length === 0) return null;

      const response = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ ids: ticketIds }),
        signal: AbortSignal.timeout(10000),
      });

      const result = await response.json();
      return result?.data;
    } catch (error) {
      console.error('🔔 Receipt check error:', error.message);
      return null;
    }
  }
}

export default new PushService();