import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ── Foreground notification behavior ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority?.HIGH ?? 1,
  }),
});

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15_000;

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private retryCount = 0;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  // ── Register for push ──
  async register(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('🔔 Not a physical device — push skipped');
      return null;
    }

    this.retryCount = 0;
    return this._attemptRegistration();
  }

  private async _attemptRegistration(): Promise<string | null> {
    try {
      // 1. Permissions
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('🔔 Push permission not granted');
        return null;
      }

      // 2. Android channels
      if (Platform.OS === 'android') {
        await this._setupAndroidChannels();
      }

      // 3. Get Expo push token
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        '6292ddf3-0f58-4832-9e8d-6e12f98b62f3';

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      this.expoPushToken = tokenData.data;
      this.retryCount = 0;

      console.log('🔔 ✅ Push token:', this.expoPushToken?.substring(0, 40) + '...');
      return this.expoPushToken;
    } catch (error: any) {
      console.error('❌ Push registration error:', error?.message);

      const msg = error?.message || '';
      const isTransient =
        msg.includes('503') ||
        msg.includes('SERVICE_UNAVAILABLE') ||
        msg.includes('temporarily unavailable') ||
        msg.includes('Try again');

      if (isTransient && this.retryCount < MAX_RETRIES) {
        this.retryCount++;
        const delay = RETRY_DELAY_MS * this.retryCount;
        console.warn(`🔔 Retry ${this.retryCount}/${MAX_RETRIES} in ${delay / 1000}s`);
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        this.retryTimeout = setTimeout(() => this._attemptRegistration(), delay);
      }

      return null;
    }
  }

  // ── Android notification channels ──
  private async _setupAndroidChannels() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#125EF2',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      description: 'New WhatsApp messages from contacts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#125EF2',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }

  // ── Listeners ──
  startListening(
    onNotification?: (notification: Notifications.Notification) => void,
    onResponse?: (response: Notifications.NotificationResponse) => void,
  ) {
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        onNotification?.(notification);
      },
    );

    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        onResponse?.(response);
      },
    );
  }

  stopListening() {
    this.notificationListener?.remove();
    this.responseListener?.remove();
    this.notificationListener = null;
    this.responseListener = null;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  // ── Badge ──
  async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch {}
  }

  // ── Getters ──
  getToken(): string | null {
    return this.expoPushToken;
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;