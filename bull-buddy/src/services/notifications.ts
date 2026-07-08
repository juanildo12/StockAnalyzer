import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let devicePushToken: string | null = null;

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    devicePushToken = token.data;
    return token.data;
  } catch {
    return null;
  }
}

export async function scheduleStreakReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);

  await Notifications.scheduleNotificationAsync({
    identifier: 'streak-reminder',
    content: {
      title: '🐂 ¡Tu racha te espera!',
      body: 'Entra a Bull Buddy para reclamar tu racha diaria y no perder tu progreso. ¡Te espero!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
    },
  });
}

export async function scheduleEventNotification(eventTitle: string, startsAt: Date) {
  const now = Date.now();
  const triggerDate = startsAt.getTime() - 3600000;

  if (triggerDate > now) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎪 ¡Evento próximo!',
        body: `"${eventTitle}" empieza en 1 hora. ¡No te lo pierdas!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerDate),
      },
    });
  }
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
