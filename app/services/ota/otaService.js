import * as Updates from "expo-updates";

/**
 * Service for managing Over-The-Air (OTA) updates fetched from the self-hosted
 * server (https://api.chuyenbienhoa.com/v1.0/ota/manifest).
 */

/**
 * Returns metadata about the currently running update.
 */
export function getRunningUpdateInfo() {
  try {
    return {
      isEnabled: Updates.isEnabled,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      updateId: Updates.updateId || null,
      channel: Updates.channel || null,
      runtimeVersion: Updates.runtimeVersion || null,
      createdAt: Updates.createdAt ? new Date(Updates.createdAt) : null,
    };
  } catch (err) {
    return {
      isEnabled: false,
      isEmbeddedLaunch: true,
      updateId: null,
      channel: null,
      runtimeVersion: null,
      createdAt: null,
      error: err.message,
    };
  }
}

/**
 * Checks the server for a new update and downloads it if available.
 *
 * @returns {Promise<{ status: 'dev_mode' | 'disabled' | 'up_to_date' | 'downloaded' | 'error', manifest?: object, error?: string }>}
 */
export async function checkAndFetchUpdate() {
  if (__DEV__) {
    return { status: "dev_mode" };
  }

  if (!Updates.isEnabled) {
    return { status: "disabled" };
  }

  try {
    const checkResult = await Updates.checkForUpdateAsync();

    if (!checkResult.isAvailable) {
      return { status: "up_to_date" };
    }

    const fetchResult = await Updates.fetchUpdateAsync();
    return {
      status: "downloaded",
      manifest: fetchResult.manifest || checkResult.manifest,
    };
  } catch (error) {
    return {
      status: "error",
      error: error?.message || "Unknown update error",
    };
  }
}

/**
 * Relaunches the app to immediately apply the newly downloaded OTA bundle.
 */
export async function reloadApp() {
  if (__DEV__ || !Updates.isEnabled) {
    return;
  }
  await Updates.reloadAsync();
}
