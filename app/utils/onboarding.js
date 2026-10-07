import AsyncStorage from "@react-native-async-storage/async-storage";

// First-launch setup is two screens: the language, then "customize your
// experience". Picking the language is what the app treated as "been here
// before", so closing the app on the second screen skipped it for good - the
// next launch went straight to the welcome/login screens.
//
// This flag is set when the language has been picked and cleared when the
// second screen is finished; while it is set, a signed-out launch reopens
// that screen. A flag for "in progress" rather than "done", so devices that
// were set up before it existed are not sent through the screen again.
const PENDING_KEY = "onboarding_settings_pending";

export async function markOnboardingSettingsPending() {
  try {
    await AsyncStorage.setItem(PENDING_KEY, "1");
  } catch {}
}

export async function finishOnboardingSettings() {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {}
}

export async function onboardingSettingsPending() {
  try {
    return (await AsyncStorage.getItem(PENDING_KEY)) === "1";
  } catch {
    return false;
  }
}
