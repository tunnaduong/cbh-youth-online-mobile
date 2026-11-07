import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

let ringInterval = null;

export const startRingtoneVibration = () => {
  if (ringInterval) clearInterval(ringInterval);
  ringInterval = setInterval(() => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } catch {}
  }, 1200);
};

export const stopRingtoneVibration = () => {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
};

export const playCallConnectedHaptic = () => {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {}
};

export const playCallEndedHaptic = () => {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  } catch {}
};
