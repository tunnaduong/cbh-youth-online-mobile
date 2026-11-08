import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { storage } from "../global/storage";

// Dynamic import or optional require for native module
let AlternateAppIcons = null;
try {
  AlternateAppIcons = require("expo-alternate-app-icons");
} catch (e) {
  // Gracefully handles environments where native module isn't linked yet
}

export const LAUNCHER_STORAGE_KEY = "launcher_app_icon_name";
export const CUSTOM_STORAGE_KEY = "custom_app_icon_uri";

/**
 * The standard default application icon.
 */
export const DEFAULT_APP_ICON = {
  key: "default",
  nativeName: null,
  nameKey: "appIcon.preset.default",
  source: require("../assets/cbh-youth-default.png"),
  tag: "Mặc định",
};

/**
 * Alternate launcher icons configured in app.json for Android activity-alias
 * and iOS CFBundleAlternateIcons. Does NOT include "default" as a grid card;
 * the default icon is restored via the "Đặt lại mặc định" button.
 */
export const LAUNCHER_APP_ICONS = [
  {
    key: "Dark",
    nativeName: "Dark",
    nameKey: "appIcon.preset.dark",
    source: require("../assets/cbh-youth-dark.png"),
    tag: "Dark",
  },
  {
    key: "ClearDark",
    nativeName: "ClearDark",
    nameKey: "appIcon.preset.cleardark",
    source: require("../assets/cbh-youth-cleardark.png"),
    tag: "Clear Dark",
  },
  {
    key: "ClearLight",
    nativeName: "ClearLight",
    nameKey: "appIcon.preset.clearlight",
    source: require("../assets/cbh-youth-clearlight.png"),
    tag: "Clear Light",
  },
  {
    key: "TintedDark",
    nativeName: "TintedDark",
    nameKey: "appIcon.preset.tinteddark",
    source: require("../assets/cbh-youth-tinteddark.png"),
    tag: "Tinted Dark",
  },
  {
    key: "TintedLight",
    nativeName: "TintedLight",
    nameKey: "appIcon.preset.tintedlight",
    source: require("../assets/cbh-youth-tintedlight.png"),
    tag: "Tinted Light",
  },
  {
    key: "TeachersDay",
    nativeName: "TeachersDay",
    nameKey: "appIcon.preset.teachers_day",
    source: require("../assets/teachers-day-20-11.png"),
    tag: "20/11",
  },
  {
    key: "Classic",
    nativeName: "Classic",
    nameKey: "appIcon.preset.classic",
    source: require("../assets/icon.png"),
    tag: "Classic CYO",
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
 * Returns the stored custom icon URI, if any.
 */
export function getCustomAppIconUri() {
  try {
    return storage.getString(CUSTOM_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the visual display metadata for the active icon (preset, custom or default).
 */
export function getActiveIconDisplay(activeKey, customUri) {
  if (activeKey === "custom" && customUri) {
    return {
      key: "custom",
      source: { uri: customUri },
      nameKey: "appIcon.customTitle",
      tag: "Custom",
    };
  }

  if (!activeKey || activeKey === "default") {
    return DEFAULT_APP_ICON;
  }

  const found = LAUNCHER_APP_ICONS.find((item) => item.key === activeKey);
  return found || DEFAULT_APP_ICON;
}

/**
 * Sets the OS launcher app icon or custom mode.
 * @param {string} iconKey - One of the keys in LAUNCHER_APP_ICONS, "default", or "custom"
 */
export async function applyLauncherIcon(iconKey) {
  if (iconKey === "default" || !iconKey) {
    try {
      if (typeof AlternateAppIcons?.setAlternateAppIcon === "function") {
        await AlternateAppIcons.setAlternateAppIcon(null);
      }
    } catch (error) {
      console.warn("[AppIcon] Could not reset alternate app icon natively:", error?.message || error);
    }
    storage.set(LAUNCHER_STORAGE_KEY, "default");
    return "default";
  }

  if (iconKey === "custom") {
    // Custom uploaded icons cannot directly register as OS activity-alias at runtime,
    // so we reset native alternate icon to null / default while saving custom mode in app.
    try {
      if (typeof AlternateAppIcons?.setAlternateAppIcon === "function") {
        await AlternateAppIcons.setAlternateAppIcon(null);
      }
    } catch {}
    storage.set(LAUNCHER_STORAGE_KEY, "custom");
    return "custom";
  }

  const item = LAUNCHER_APP_ICONS.find((i) => i.key === iconKey);
  if (!item) {
    storage.set(LAUNCHER_STORAGE_KEY, "default");
    return "default";
  }

  const targetNative = item.nativeName;

  try {
    if (typeof AlternateAppIcons?.setAlternateAppIcon === "function") {
      await AlternateAppIcons.setAlternateAppIcon(targetNative);
    }
  } catch (error) {
    console.warn("[AppIcon] Could not set alternate app icon natively:", error?.message || error);
  }

  try {
    storage.set(LAUNCHER_STORAGE_KEY, item.key);
  } catch {}

  return item.key;
}

/**
 * Ensures an uploaded image is square-cropped (1:1) and saves to persistent app storage.
 */
export async function saveCustomAppIcon(sourceUri) {
  if (!sourceUri) return null;

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 512, height: 512 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.PNG }
    );

    const fileName = `custom_app_icon_${Date.now()}.png`;
    const destinationPath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.copyAsync({
      from: manipulated.uri,
      to: destinationPath,
    });

    storage.set(CUSTOM_STORAGE_KEY, destinationPath);
    return destinationPath;
  } catch (error) {
    console.error("Error cropping and saving custom app icon:", error);
    throw error;
  }
}

/**
 * Deletes the stored custom icon file and removes it from storage.
 */
export async function removeCustomAppIcon(customUri) {
  try {
    if (customUri) {
      const fileInfo = await FileSystem.getInfoAsync(customUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(customUri, { idempotent: true });
      }
    }
  } catch (e) {
    console.warn("[AppIcon] Error deleting custom icon file:", e);
  }

  try {
    storage.delete(CUSTOM_STORAGE_KEY);
  } catch {}
}
