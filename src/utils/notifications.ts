import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
const NOTIF_PREF_KEY = 'notif_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function isEnabled(): Promise<boolean> {
  if (isWeb) return false;
  const val = await AsyncStorage.getItem(NOTIF_PREF_KEY);
  return val !== 'false';
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIF_PREF_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

export async function requestPermission(): Promise<boolean> {
  if (isWeb) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dues', {
      name: 'Aidat Hatirlatmalari',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('announcements', {
      name: 'Duyurular',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
  return true;
}

export async function setupNotifications() {
  if (isWeb) return;
  const enabled = await isEnabled();
  if (!enabled) return;

  const granted = await requestPermission();
  if (!granted) return;

  await scheduleDailyDuesReminder();
}

export async function cancelAllReminders() {
  if (isWeb) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleDailyDuesReminder() {
  if (isWeb) return;
  const enabled = await isEnabled();
  if (!enabled) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Aidat Hatırlatması',
      body: 'Bu ayki aidat ödemelerini kontrol etmeyi unutmayın. Ödenmeyen aidatlar için daire sakinlerine hatırlatma yapabilirsiniz.',
      sound: 'default',
      data: { screen: 'Dues' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
      channelId: Platform.OS === 'android' ? 'dues' : undefined,
    },
  });
}

export async function sendAnnouncementNotification(title: string, body: string) {
  if (isWeb) return;
  const enabled = await isEnabled();
  if (!enabled) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { screen: 'Dashboard' },
    },
    trigger: null,
  });
}
