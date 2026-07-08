import * as Haptics from 'expo-haptics';

export const hapticsLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const hapticsMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const hapticsHeavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
export const hapticsSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const hapticsError = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
export const hapticsWarning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
export const hapticsSelection = () => Haptics.selectionAsync();
