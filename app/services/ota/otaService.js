import { Platform } from "react-native";
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
export const OTA_DISMISSED_UPDATE_KEY = "ota_dismissed_update_id";

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
 * Applies the request headers and update URL override so that expo-updates queries
 * the server with the active "expo-channel-name" header.
 */
export function applyChannelOverride(channel = getOtaChannel()) {
  try {
    if (typeof Updates.setUpdateURLAndRequestHeadersOverride === "function") {
      Updates.setUpdateURLAndRequestHeadersOverride({
        updateUrl: "https://api.chuyenbienhoa.com/v1.0/ota/manifest",
        requestHeaders: {
          "expo-channel-name": channel,
        },
      });
    } else if (typeof Updates.setUpdateRequestHeadersOverride === "function") {
      Updates.setUpdateRequestHeadersOverride({
        "expo-channel-name": channel,
      });
    }
  } catch (err) {
    console.warn("[OTA] Could not set update request headers override:", err?.message);
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
    console.warn("[OTA] Could not save OTA channel to storage:", err?.message);
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
 * Queries the self-hosted manifest or native expo-updates to check if an update is available.
 *
 * Checks HTTP direct manifest first to avoid native configuration NPE/mismatch,
 * falling back to native checkForUpdateAsync().
 *
 * @param {string} [channelOverride] Optional channel name to check
 * @returns {Promise<{
 *   status: 'available' | 'up_to_date' | 'dev_mode' | 'disabled' | 'error',
 *   isAvailable: boolean,
 *   channel: string,
 *   updateInfo?: { id: string, message: string, channel: string, createdAt: Date, manifest: object },
 *   error?: string
 * }>}
 */
export async function checkUpdateAvailable(channelOverride) {
  const channel = channelOverride || getOtaChannel();

  if (__DEV__) {
    return { status: "dev_mode", isAvailable: false, channel };
  }

  applyChannelOverride(channel);

  // 1. Direct manifest check via HTTP JSON endpoint
  try {
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const runtimeVersion = Updates.runtimeVersion || "7.4.10";
    const currentUpdateId = Updates.updateId || "";
    const url = `https://api.chuyenbienhoa.com/v1.0/ota/manifest?channel=${encodeURIComponent(
      channel
    )}&runtime-version=${encodeURIComponent(runtimeVersion)}&platform=${platform}&current_update_id=${encodeURIComponent(
      currentUpdateId
    )}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data?.directive?.type === "noUpdateAvailable") {
        return { status: "up_to_date", isAvailable: false, channel };
      }
      if (data?.id) {
        if (currentUpdateId && data.id === currentUpdateId) {
          return { status: "up_to_date", isAvailable: false, channel };
        }
        return {
          status: "available",
          isAvailable: true,
          channel,
          updateInfo: {
            id: data.id,
            message: data.metadata?.message || "",
            channel: data.metadata?.channel || channel,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            manifest: data,
          },
        };
      }
    }
  } catch (httpErr) {
    console.warn("[OTA] Direct manifest check error, checking native:", httpErr?.message);
  }

  // 2. Native expo-updates check
  if (Updates.isEnabled) {
    try {
      const checkResult = await Updates.checkForUpdateAsync();
      if (!checkResult.isAvailable) {
        return { status: "up_to_date", isAvailable: false, channel };
      }
      return {
        status: "available",
        isAvailable: true,
        channel,
        updateInfo: {
          id: checkResult.manifest?.id || null,
          message: checkResult.manifest?.metadata?.message || "",
          channel: checkResult.manifest?.metadata?.channel || channel,
          createdAt: checkResult.manifest?.createdAt ? new Date(checkResult.manifest.createdAt) : new Date(),
          manifest: checkResult.manifest,
        },
      };
    } catch (nativeErr) {
      console.warn("[OTA] Native checkForUpdateAsync error:", nativeErr?.message);
      return {
        status: "error",
        isAvailable: false,
        channel,
        error: nativeErr?.message || "Không thể kiểm tra cập nhật. Vui lòng thử lại sau.",
      };
    }
  }

  return { status: "disabled", isAvailable: false, channel };
}

/**
 * Downloads the update bundle using expo-updates native fetch.
 *
 * @param {string} [channelOverride] Optional channel name to check/fetch
 * @returns {Promise<{ status: 'downloaded' | 'disabled' | 'dev_mode' | 'error', channel?: string, manifest?: object, error?: string }>}
 */
export async function downloadAndApplyUpdate(channelOverride) {
  if (__DEV__) {
    return { status: "dev_mode" };
  }

  const channel = channelOverride || getOtaChannel();
  applyChannelOverride(channel);

  if (!Updates.isEnabled) {
    return { status: "disabled", error: "Tính năng cập nhật không khả dụng trong bản build này." };
  }

  try {
    const fetchResult = await Updates.fetchUpdateAsync();
    return {
      status: "downloaded",
      manifest: fetchResult.manifest,
      channel,
    };
  } catch (error) {
    console.warn("[OTA] Updates.fetchUpdateAsync error:", error?.message);
    return {
      status: "error",
      channel,
      error: error?.message || "Không thể tải bản cập nhật.",
    };
  }
}

/**
 * Checks for a new update and downloads it if available (backward-compatible wrapper).
 *
 * @param {string} [channelOverride] Optional channel name to check instead of the stored one
 * @returns {Promise<{ status: 'dev_mode' | 'disabled' | 'up_to_date' | 'downloaded' | 'error', channel?: string, manifest?: object, error?: string, updateInfo?: object }>}
 */
export async function checkAndFetchUpdate(channelOverride) {
  const check = await checkUpdateAvailable(channelOverride);

  if (check.status === "dev_mode") {
    return { status: "dev_mode", channel: check.channel };
  }
  if (check.status === "disabled") {
    return { status: "disabled", channel: check.channel };
  }
  if (check.status === "up_to_date") {
    return { status: "up_to_date", channel: check.channel };
  }
  if (check.status === "error") {
    return { status: "error", channel: check.channel, error: check.error };
  }

  if (check.isAvailable) {
    const download = await downloadAndApplyUpdate(check.channel);
    if (download.status === "downloaded") {
      return {
        status: "downloaded",
        channel: check.channel,
        manifest: download.manifest || check.updateInfo?.manifest,
        updateInfo: check.updateInfo,
      };
    }
    return {
      status: "error",
      channel: check.channel,
      error: download.error || "Không thể tải bản cập nhật.",
    };
  }

  return { status: "up_to_date", channel: check.channel };
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
