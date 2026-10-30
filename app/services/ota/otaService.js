import * as Updates from "expo-updates";
import { storage } from "../../global/storage";

/**
 * Service for managing Over-The-Air (OTA) updates fetched from the self-hosted
 * server (https://api.chuyenbienhoa.com/v1.0/ota/manifest).
 *
 * Supports switching update channels between:
 * - "production": Stable release built from the `main` branch.
 * - "preview": Early-access preview built from the `dhphuc` branch via CI.
 */

export const OTA_STORAGE_KEY = "ota_channel";

export const OTA_CHANNELS = {
  PRODUCTION: "production",
  PREVIEW: "preview",
};

/**
 * Returns the user's selected OTA update channel ("production" | "preview").
 * Defaults to "production".
 */
export function getOtaChannel() {
  try {
    const saved = storage.getString(OTA_STORAGE_KEY);
    if (saved === OTA_CHANNELS.PREVIEW) {
      return OTA_CHANNELS.PREVIEW;
    }
    return OTA_CHANNELS.PRODUCTION;
  } catch {
    return OTA_CHANNELS.PRODUCTION;
  }
}

/**
 * Applies the request headers override so that expo-updates queries the server
 * with the active "expo-channel-name" header.
 */
export function applyChannelOverride(channel = getOtaChannel()) {
  try {
    if (typeof Updates.setUpdateRequestHeadersOverride === "function") {
      Updates.setUpdateRequestHeadersOverride({
        "expo-channel-name": channel,
      });
    }
  } catch (err) {
    console.warn("Could not set update request headers override:", err?.message);
  }
}

/**
 * Sets the user's preferred OTA update channel and immediately updates the request header override.
 */
export function setOtaChannel(channel) {
  const target = channel === OTA_CHANNELS.PREVIEW ? OTA_CHANNELS.PREVIEW : OTA_CHANNELS.PRODUCTION;
  try {
    storage.set(OTA_STORAGE_KEY, target);
  } catch (err) {
    console.warn("Could not save OTA channel to storage:", err?.message);
  }
  applyChannelOverride(target);
  return target;
}

// Apply the stored channel immediately upon module evaluation
applyChannelOverride();

/**
 * Returns metadata about the currently running update.
 */
export function getRunningUpdateInfo() {
  const activeChannel = getOtaChannel();
  try {
    return {
      isEnabled: Updates.isEnabled,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      updateId: Updates.updateId || null,
      channel: Updates.channel || activeChannel,
      activeChannel,
      runtimeVersion: Updates.runtimeVersion || null,
      createdAt: Updates.createdAt ? new Date(Updates.createdAt) : null,
    };
  } catch (err) {
    return {
      isEnabled: false,
      isEmbeddedLaunch: true,
      updateId: null,
      channel: activeChannel,
      activeChannel,
      runtimeVersion: null,
      createdAt: null,
      error: err?.message,
    };
  }
}

/**
 * Checks the server for a new update and downloads it if available.
 *
 * @param {string} [channelOverride] Optional channel name to check instead of the stored one
 * @returns {Promise<{ status: 'dev_mode' | 'disabled' | 'up_to_date' | 'downloaded' | 'error', channel?: string, manifest?: object, error?: string }>}
 */
export async function checkAndFetchUpdate(channelOverride) {
  if (__DEV__) {
    return { status: "dev_mode" };
  }

  if (!Updates.isEnabled) {
    return { status: "disabled" };
  }

  const channel = channelOverride || getOtaChannel();
  applyChannelOverride(channel);

  try {
    const checkResult = await Updates.checkForUpdateAsync();

    if (!checkResult.isAvailable) {
      return { status: "up_to_date", channel };
    }

    const fetchResult = await Updates.fetchUpdateAsync();
    return {
      status: "downloaded",
      manifest: fetchResult.manifest || checkResult.manifest,
      channel,
    };
  } catch (error) {
    return {
      status: "error",
      channel,
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
