import Constants from "expo-constants";

/**
 * Minimum native binary build number required by the current OTA bundles.
 * Configured directly in app.json (`expo.extra.minNativeBuild`), defaults to 1008.
 * If the installed APK/IPA versionCode is less than this value, OTA updates
 * are blocked and the user is prompted to install the newer base APK.
 */
export function getMinNativeBuildRequired() {
  try {
    const fromConfig =
      Constants.expoConfig?.extra?.minNativeBuild ??
      Constants.expoConfig?.extra?.ota?.minNativeBuild;
    if (typeof fromConfig === "number" && fromConfig > 0) {
      return fromConfig;
    }
  } catch {}
  return 1008;
}

export const MIN_NATIVE_BUILD_REQUIRED = getMinNativeBuildRequired();

/**
 * Resolves the default OTA channel embedded in this binary build
 * ("preview" for dhphuc branch, "production" for main branch).
 */
export function getEmbeddedDefaultChannel() {
  try {
    const embeddedHeader =
      Constants.expoConfig?.updates?.requestHeaders?.["expo-channel-name"];
    if (embeddedHeader === "preview" || embeddedHeader === "production") {
      return embeddedHeader;
    }
  } catch {}
  return "preview";
}
