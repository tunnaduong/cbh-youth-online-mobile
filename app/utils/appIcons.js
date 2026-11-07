import { storage } from "../global/storage";

// Dynamic import or optional require for native module
let AlternateAppIcons = null;
try {
  AlternateAppIcons = require("expo-alternate-app-icons");
} catch (e) {
  // Gracefully handles environments where native module isn't linked yet
}

export const LAUNCHER_STORAGE_KEY = "launcher_app_icon_name";

/**
 * Curated list of launcher icons configured in app.json for Android activity-alias
 * and iOS CFBundleAlternateIcons.
 */
export const LAUNCHER_APP_ICONS = [
  {
    key: "default",
    nativeName: null,
    nameKey: "appIcon.preset.default",
    source: require("../assets/icon.png"),
    tag: "Original",
  },
  {
    key: "Classic",
    nativeName: "Classic",
    nameKey: "appIcon.preset.classic",
    source: require("../assets/ios-light.png"),
    tag: "Classic",
  },
  {
    key: "Christmas",
    nativeName: "Christmas",
    nameKey: "appIcon.preset.christmas",
    source: require("../assets/christmas-ios.png"),
    tag: "Holiday",
  },
  {
    key: "NewYear2026",
    nativeName: "NewYear2026",
    nameKey: "appIcon.preset.newyear_2026",
    source: require("../assets/2026-ios.png"),
    tag: "2026",
  },
  {
    key: "SchoolCrest",
    nativeName: "SchoolCrest",
    nameKey: "appIcon.preset.school",
    source: require("../assets/school-logo-removebg.png"),
    tag: "Crest",
  },
];

/**
 * Checks whether the current device supports setting alternate launcher icons.
 */
export function isAlternateIconsSupported() {
  try {
    return Boolean(AlternateAppIcons?.supportsAlternateIcons);
  } catch {
    return false;
  }
}

/**
 * Returns the active launcher icon key saved in storage or reported natively.
 */
export function getActiveLauncherIconKey() {
  try {
    const saved = storage.getString(LAUNCHER_STORAGE_KEY);
    if (saved) return saved;

    if (typeof AlternateAppIcons?.getAppIconName === "function") {
      const activeNative = AlternateAppIcons.getAppIconName();
      if (activeNative) return activeNative;
    }
  } catch {}
  return "default";
}

/**
 * Sets the OS launcher app icon.
 * @param {string} iconKey - One of the keys in LAUNCHER_APP_ICONS ("default", "Classic", "Christmas", etc.)
 */
export async function applyLauncherIcon(iconKey) {
  const item = LAUNCHER_APP_ICONS.find((i) => i.key === iconKey) || LAUNCHER_APP_ICONS[0];
  const targetNative = item.nativeName;

  try {
    if (typeof AlternateAppIcons?.setAlternateAppIcon === "function") {
      await AlternateAppIcons.setAlternateAppIcon(targetNative);
    }
  } catch (error) {
    console.warn("[AppIcon] Could not set alternate app icon natively:", error?.message || error);
    // Continue saving choice to storage so UI reflects selection on supported builds
  }

  try {
    storage.set(LAUNCHER_STORAGE_KEY, item.key);
  } catch {}

  return item.key;
}
