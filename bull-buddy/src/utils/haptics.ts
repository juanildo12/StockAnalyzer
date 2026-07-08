import * as Haptics from 'expo-haptics';

export function hapticsLight() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}

export function hapticsMedium() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
}

export function hapticsHeavy() {
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
}

export function hapticsSuccess() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
}

export function hapticsError() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
}

export function hapticsWarning() {
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
}
