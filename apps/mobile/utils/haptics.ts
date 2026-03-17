import * as Haptics from 'expo-haptics';

/** Light tap — for button presses */
export function hapticLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium tap — for garment swaps, saves */
export function hapticMedium(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy tap — for capture start/stop */
export function hapticHeavy(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Success notification — for processing complete */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Error notification — for errors */
export function hapticError(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Selection changed — for picker changes */
export function hapticSelection(): void {
  Haptics.selectionAsync();
}
