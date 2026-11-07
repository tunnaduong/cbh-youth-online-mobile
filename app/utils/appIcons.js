import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Predefined list of application icons sourced from app/assets.
 */
export const PRESET_APP_ICONS = [
  {
    key: "default",
    nameKey: "appIcon.preset.default",
    source: require("../assets/icon.png"),
    tag: "Original",
  },
  {
    key: "ios_default",
    nameKey: "appIcon.preset.ios_default",
    source: require("../assets/cbh-youth-iOS-Default-1024x1024.png"),
    tag: "Light",
  },
  {
    key: "ios_dark",
    nameKey: "appIcon.preset.ios_dark",
    source: require("../assets/cbh-youth-iOS-Dark-1024x1024.png"),
    tag: "Dark",
  },
  {
    key: "ios_clearlight",
    nameKey: "appIcon.preset.ios_clearlight",
    source: require("../assets/cbh-youth-iOS-ClearLight-1024x1024.png"),
    tag: "Clear",
  },
  {
    key: "ios_cleardark",
    nameKey: "appIcon.preset.ios_cleardark",
    source: require("../assets/cbh-youth-iOS-ClearDark-1024x1024.png"),
    tag: "Clear Dark",
  },
  {
    key: "christmas",
    nameKey: "appIcon.preset.christmas",
    source: require("../assets/christmas-ios.png"),
    tag: "Holiday",
  },
  {
    key: "newyear_2026",
    nameKey: "appIcon.preset.newyear_2026",
    source: require("../assets/2026-ios.png"),
    tag: "2026",
  },
  {
    key: "school",
    nameKey: "appIcon.preset.school",
    source: require("../assets/school-logo-removebg.png"),
    tag: "Crest",
  },
];

/**
 * Resolves the Image source based on the active icon key and optional custom URI.
 */
export function getAppIconSource(iconKey, customIconUri) {
  if (iconKey === "custom" && customIconUri) {
    return { uri: customIconUri };
  }
  const preset = PRESET_APP_ICONS.find((icon) => icon.key === iconKey);
  if (preset) {
    return preset.source;
  }
  return PRESET_APP_ICONS[0].source;
}

/**
 * Ensures an uploaded image is strictly square-cropped (1:1) and saves to persistent app storage.
 */
export async function saveCustomAppIcon(sourceUri) {
  if (!sourceUri) return null;

  try {
    // 1. Manipulate to ensure square dimension (resize to max 512x512 with square ratio)
    const manipulated = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 512, height: 512 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.PNG }
    );

    // 2. Persist to app's document directory
    const fileName = `custom_app_icon_${Date.now()}.png`;
    const destinationPath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.copyAsync({
      from: manipulated.uri,
      to: destinationPath,
    });

    return destinationPath;
  } catch (error) {
    console.error("Error cropping and saving custom app icon:", error);
    throw error;
  }
}
