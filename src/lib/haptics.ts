import * as Haptics from 'expo-haptics';

/** Fire-and-forget haptics. Unsupported devices, web browsers, and iOS Low Power Mode just do nothing. */
function fire(play: () => Promise<void>) {
  try {
    play().catch(() => {});
  } catch {
    // Some platforms throw synchronously when haptics are unavailable.
  }
}

export const haptics = {
  tick: () => fire(() => Haptics.selectionAsync()),
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
