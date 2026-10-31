import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { storage } from "../../global/storage";
import { MIN_NATIVE_BUILD_REQUIRED, getEmbeddedDefaultChannel } from "./otaConfig";

/**
 * Service for managing Over-The-Air (OTA) updates fetched from the self-hosted
 * server (https://api.chuyenbienhoa.com/v1.0/ota/manifest).
 *
 * Supports switching update channels between:
 * - "production": Stable release built from the `main` branch.
 * - "preview": Early-access preview built from the `dhphuc` branch via CI.
 */

export const OTA_STORAGE_KEY = "ota_channel";
export const OTA_ACTIVE_BUILD_KEY = "ota_active_build_number";
export const OTA_ACTIVE_UPDATE_ID_KEY = "ota_active_update_id";
export const OTA_ACTIVE_CHANNEL_KEY = "ota_active_channel";
export const OTA_ENABLED_KEY = "ota_enabled";
export const OTA_CHECK_STARTUP_KEY = "ota_check_startup";

export const OTA_CHANNELS = {
  PRODUCTION: "production",
  PREVIEW: "preview",
};

/**
 * Returns the base binary build number from the native AndroidManifest (versionCode)
 * or iOS Info.plist (CFBundleVersion).
 */
export function getNativeBuildNumber() {
  const parsed = parseInt(Application.nativeBuildVersion, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  try {
    const fromConfig =
      Constants.expoConfig?.android?.versionCode ??
      parseInt(Constants.expoConfig?.ios?.buildNumber, 10);
    if (Number.isFinite(fromConfig) && fromConfig > 0) {
      return fromConfig;
    }
  } catch {}
  return 1018;
}

/**
 * Returns the build number of the currently running JS bundle.
 * If running embedded, returns the native binary build number.
 * If running an OTA update, returns the active OTA build number stored on update.
 */
export function getRunningOtaBuildNumber() {
  const nativeBuild = getNativeBuildNumber();
  if (Updates.isEmbeddedLaunch) {
    return nativeBuild;
  }
  const storedBuild = storage.getNumber(OTA_ACTIVE_BUILD_KEY);
  return storedBuild && storedBuild > 0 ? storedBuild : nativeBuild;
}

/**
 * Synchronizes the native binary APK build number with the stored OTA build number.
 * If the user upgraded the app via native APK/IPA (e.g. from Google Play Store),
 * the newly installed base APK has a strictly higher build number than the preinstalled OTA bundle.
 * In this case, we use the bundled one with the APK and clear stale OTA state.
 */
export function syncNativeAndOtaBuild() {
  try {
    const nativeBuild = getNativeBuildNumber();
    const storedBuild = storage.getNumber(OTA_ACTIVE_BUILD_KEY) || 0;

    if (nativeBuild > 0 && storedBuild > 0 && nativeBuild > storedBuild) {
      storage.delete(OTA_ACTIVE_BUILD_KEY);
      storage.delete(OTA_ACTIVE_UPDATE_ID_KEY);
    }
  } catch (err) {
    console.warn("[OTA] syncNativeAndOtaBuild error:", err?.message);
  }
}

// Perform sync immediately upon module evaluation
syncNativeAndOtaBuild();

/**
 * Returns the user's selected OTA update channel ("production" | "preview").
 * Defaults to the channel embedded at build time (e.g. "preview" for dhphuc).
 */
export function getOtaChannel() {
  try {
    const saved = storage.getString(OTA_STORAGE_KEY);
    if (saved === OTA_CHANNELS.PREVIEW || saved === OTA_CHANNELS.PRODUCTION) {
      return saved;
    }
    return getEmbeddedDefaultChannel();
  } catch {
    return getEmbeddedDefaultChannel();
  }
}

/**
 * Checks whether OTA updates are enabled by the user in settings.
 * Defaults to true.
 */
export function isOtaEnabled() {
  try {
    const val = storage.getBoolean(OTA_ENABLED_KEY);
    return val !== undefined ? val : true;
  } catch {
    return true;
  }
}

/**
 * Enables or disables OTA updates.
 */
export function setOtaEnabled(enabled) {
  try {
    storage.set(OTA_ENABLED_KEY, !!enabled);
  } catch (err) {
    console.warn("[OTA] Could not save OTA enabled state to storage:", err?.message);
  }
  if (enabled) {
    applyChannelOverride();
  }
  return !!enabled;
}

/**
 * Checks whether checking for updates automatically at startup is enabled.
 * Defaults to true.
 */
export function isStartupCheckEnabled() {
  try {
    const val = storage.getBoolean(OTA_CHECK_STARTUP_KEY);
    return val !== undefined ? val : true;
  } catch {
    return true;
  }
}

/**
 * Sets whether to check for updates automatically at startup.
 */
export function setStartupCheckEnabled(enabled) {
  try {
    storage.set(OTA_CHECK_STARTUP_KEY, !!enabled);
  } catch (err) {
    console.warn("[OTA] Could not save startup check state to storage:", err?.message);
  }
  return !!enabled;
}

/**
 * Applies the request headers override so that expo-updates queries the server
 * with the active "expo-channel-name" header and persists across reboots.
 */
export function applyChannelOverride(channel = getOtaChannel()) {
  if (__DEV__) {
    console.log(`[OTA] applyChannelOverride: Skipped (__DEV__ is true)`);
    return;
  }
  if (!Updates.isEnabled) {
    console.log(`[OTA] applyChannelOverride: Skipped (Updates.isEnabled is false)`);
    return;
  }
  if (!isOtaEnabled()) {
    console.log(`[OTA] applyChannelOverride: Skipped (OTA disabled by user)`);
    return;
  }
  try {
    if (typeof Updates.setUpdateRequestHeadersOverride === "function") {
      const res = Updates.setUpdateRequestHeadersOverride({
        "expo-channel-name": channel,
      });
      if (res && typeof res.catch === "function") {
        res.catch((err) => {
          const msg = err?.message || "";
          if (
            msg.includes("not enabled") ||
            msg.includes("ERR_UPDATES_DISABLED") ||
            err?.code === "ERR_UPDATES_DISABLED"
          ) {
            return;
          }
          console.warn("[OTA] setUpdateRequestHeadersOverride promise rejected:", msg);
        });
      }
      console.log(`[OTA] Applied channel request header: expo-channel-name="${channel}"`);
    } else {
      console.warn("[OTA] Updates.setUpdateRequestHeadersOverride is not available on this platform.");
    }
  } catch (err) {
    const msg = err?.message || "";
    if (
      msg.includes("not enabled") ||
      msg.includes("ERR_UPDATES_DISABLED") ||
      err?.code === "ERR_UPDATES_DISABLED"
    ) {
      return;
    }
    console.error("[OTA] Could not set update request headers override:", msg);
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

// Apply the channel override immediately upon module evaluation
applyChannelOverride();

/**
 * Returns metadata about the currently running update.
 */
export function getRunningUpdateInfo() {
  const activeChannel = getOtaChannel();
  const nativeBuildNumber = getNativeBuildNumber();
  const activeBuildNumber = getRunningOtaBuildNumber();

  try {
    return {
      isEnabled: Updates.isEnabled,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      updateId: Updates.updateId || null,
      channel: Updates.channel || activeChannel,
      activeChannel,
      runtimeVersion: Updates.runtimeVersion || null,
      createdAt: Updates.createdAt ? new Date(Updates.createdAt) : null,
      nativeBuildNumber,
      activeBuildNumber,
      isOtaActive: !Updates.isEmbeddedLaunch && !!Updates.updateId,
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
      nativeBuildNumber,
      activeBuildNumber,
      isOtaActive: false,
      error: err?.message,
    };
  }
}

/**
 * Queries the self-hosted manifest or native expo-updates to check if an update is available.
 *
 * Implements intelligent checks:
 * 1. Minimum native build check: blocks OTA if base APK is older than min_native_build (1008).
 * 2. Build number comparison: only allows upgrade if upstream build > current active build.
 * 3. Update ID matching: prevents re-downloading current update.
 *
 * @param {string} [channelOverride] Optional channel name to check
 * @returns {Promise<{
 *   status: 'available' | 'up_to_date' | 'native_base_outdated' | 'dev_mode' | 'disabled' | 'error',
 *   isAvailable: boolean,
 *   channel: string,
 *   updateInfo?: {
 *     id: string,
 *     buildNumber: number,
 *     minNativeBuild: number,
 *     message: string,
 *     channel: string,
 *     createdAt: Date,
 *     manifest: object
 *   },
 *   minNativeRequired?: number,
 *   currentNativeBuild?: number,
 *   error?: string
 * }>}
 */
export async function checkUpdateAvailable(channelOverride, force = false) {
  const channel = channelOverride || getOtaChannel();
  const currentNativeBuild = getNativeBuildNumber();
  const currentActiveBuild = getRunningOtaBuildNumber();

  console.log(
    `[OTA] checkUpdateAvailable started (channel: "${channel}", force: ${force}, nativeBuild: ${currentNativeBuild}, activeOtaBuild: ${currentActiveBuild})`
  );

  if (__DEV__) {
    console.log("[OTA] App is in __DEV__ mode. Skipping OTA check.");
    return { status: "dev_mode", isAvailable: false, channel };
  }

  if (!force && !isOtaEnabled()) {
    console.log("[OTA] OTA updates disabled by user in Settings.");
    return {
      status: "disabled_by_user",
      isAvailable: false,
      channel,
      error: "Tính năng cập nhật OTA đang bị tắt trong Cài đặt.",
    };
  }

  applyChannelOverride(channel);

  // 1. Direct manifest check via HTTP JSON endpoint
  try {
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const runtimeVersion =
      Updates.runtimeVersion ||
      Constants.expoConfig?.runtimeVersion ||
      "7.4.10";
    const currentUpdateId = Updates.updateId || storage.getString(OTA_ACTIVE_UPDATE_ID_KEY) || "";
    const url = `https://api.chuyenbienhoa.com/v1.0/ota/manifest?channel=${encodeURIComponent(
      channel
    )}&runtime-version=${encodeURIComponent(runtimeVersion)}&platform=${platform}&current_update_id=${encodeURIComponent(
      currentUpdateId
    )}`;

    console.log(`[OTA] Querying direct HTTP manifest: ${url}`);

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

    console.log(`[OTA] HTTP manifest response status: ${res.status}`);

    if (res.ok) {
      const data = await res.json();
      console.log(
        `[OTA] HTTP manifest content: id=${data?.id || "none"}, build=${data?.metadata?.build_number || "none"}, minNative=${data?.metadata?.min_native_build || "none"}, directive=${data?.directive?.type || "none"}`
      );
      if (data?.directive?.type === "noUpdateAvailable") {
        console.log("[OTA] Server returned directive: noUpdateAvailable. App is up to date.");
        return { status: "up_to_date", isAvailable: false, channel };
      }
      if (data?.id) {
        const upstreamBuildNumber = parseInt(data.metadata?.build_number, 10) || 0;
        const minNativeBuild =
          parseInt(data.metadata?.min_native_build, 10) || MIN_NATIVE_BUILD_REQUIRED;

        // Check if the current native APK/IPA is too old for this OTA bundle
        if (currentNativeBuild > 0 && currentNativeBuild < minNativeBuild) {
          console.warn(
            `[OTA] Native base build outdated! current=${currentNativeBuild}, required=${minNativeBuild}`
          );
          return {
            status: "native_base_outdated",
            isAvailable: false,
            channel,
            minNativeRequired: minNativeBuild,
            currentNativeBuild,
            error: `Bản cập nhật yêu cầu phiên bản ứng dụng Build ${minNativeBuild} trở lên (bạn đang ở Build ${currentNativeBuild}). Vui lòng cập nhật hoặc tải file APK mới.`,
            updateInfo: {
              id: data.id,
              buildNumber: upstreamBuildNumber,
              minNativeBuild,
              currentNativeBuild,
              message: data.metadata?.message || "",
              channel: data.metadata?.channel || channel,
              createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
              manifest: data,
            },
          };
        }

        // Check if client is already running an equal or newer build
        if (upstreamBuildNumber > 0) {
          if (currentActiveBuild > 0 && upstreamBuildNumber <= currentActiveBuild) {
            console.log(
              `[OTA] Upstream build (${upstreamBuildNumber}) <= current active build (${currentActiveBuild}). Up to date.`
            );
            return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
          }
          if (currentNativeBuild > 0 && upstreamBuildNumber <= currentNativeBuild) {
            console.log(
              `[OTA] Upstream build (${upstreamBuildNumber}) <= installed base APK build (${currentNativeBuild}). Up to date.`
            );
            return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentNativeBuild };
          }
        }

        // Check if currently running update ID matches
        const runningUpdateId = Updates.updateId || storage.getString(OTA_ACTIVE_UPDATE_ID_KEY) || "";
        if (runningUpdateId && data.id === runningUpdateId) {
          console.log(`[OTA] Upstream update ID matches running update (${runningUpdateId}). Up to date.`);
          return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
        }

        console.log(
          `[OTA] Update is available: ID=${data.id}, Build=${upstreamBuildNumber}, Channel="${data.metadata?.channel || channel}"`
        );
        return {
          status: "available",
          isAvailable: true,
          channel,
          updateInfo: {
            id: data.id,
            buildNumber: upstreamBuildNumber,
            minNativeBuild,
            currentNativeBuild,
            message: data.metadata?.message || "",
            channel: data.metadata?.channel || channel,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            manifest: data,
          },
        };
      }
    } else {
      console.warn(`[OTA] HTTP manifest returned status ${res.status}`);
    }
  } catch (httpErr) {
    console.warn("[OTA] Direct manifest check error, checking native:", httpErr?.message || httpErr);
  }

  // 2. Native expo-updates check as fallback
  if (Updates.isEnabled) {
    try {
      console.log("[OTA] Running native Updates.checkForUpdateAsync()...");
      const checkResult = await Updates.checkForUpdateAsync();
      console.log(
        `[OTA] Native checkForUpdateAsync result: isAvailable=${checkResult?.isAvailable}, id=${checkResult?.manifest?.id || "none"}`
      );
      if (!checkResult.isAvailable) {
        console.log("[OTA] Native checkResult.isAvailable is false. Up to date.");
        return { status: "up_to_date", isAvailable: false, channel };
      }

      const upstreamBuildNumber =
        parseInt(checkResult.manifest?.metadata?.build_number, 10) || 0;
      const minNativeBuild =
        parseInt(checkResult.manifest?.metadata?.min_native_build, 10) || MIN_NATIVE_BUILD_REQUIRED;

      if (currentNativeBuild > 0 && currentNativeBuild < minNativeBuild) {
        console.warn(
          `[OTA Native] Native base build outdated! current=${currentNativeBuild}, required=${minNativeBuild}`
        );
        return {
          status: "native_base_outdated",
          isAvailable: false,
          channel,
          minNativeRequired: minNativeBuild,
          currentNativeBuild,
          error: `Bản cập nhật yêu cầu phiên bản ứng dụng Build ${minNativeBuild} trở lên.`,
          updateInfo: {
            id: checkResult.manifest?.id || null,
            buildNumber: upstreamBuildNumber,
            minNativeBuild,
            currentNativeBuild,
            message: checkResult.manifest?.metadata?.message || "",
            channel: checkResult.manifest?.metadata?.channel || channel,
            createdAt: checkResult.manifest?.createdAt ? new Date(checkResult.manifest.createdAt) : new Date(),
            manifest: checkResult.manifest,
          },
        };
      }

      if (upstreamBuildNumber > 0) {
        if (currentActiveBuild > 0 && upstreamBuildNumber <= currentActiveBuild) {
          console.log(
            `[OTA Native] Upstream build (${upstreamBuildNumber}) <= current active build (${currentActiveBuild}). Up to date.`
          );
          return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
        }
        if (currentNativeBuild > 0 && upstreamBuildNumber <= currentNativeBuild) {
          console.log(
            `[OTA Native] Upstream build (${upstreamBuildNumber}) <= installed base APK build (${currentNativeBuild}). Up to date.`
          );
          return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentNativeBuild };
        }
      }

      const runningUpdateId = Updates.updateId || storage.getString(OTA_ACTIVE_UPDATE_ID_KEY) || "";
      if (runningUpdateId && checkResult.manifest?.id === runningUpdateId) {
        console.log(`[OTA Native] Running update matches manifest ID (${runningUpdateId}). Up to date.`);
        return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
      }

      console.log(`[OTA Native] New update available: ID=${checkResult.manifest?.id}, Build=${upstreamBuildNumber}`);
      return {
        status: "available",
        isAvailable: true,
        channel,
        updateInfo: {
          id: checkResult.manifest?.id || null,
          buildNumber: upstreamBuildNumber,
          minNativeBuild,
          currentNativeBuild,
          message: checkResult.manifest?.metadata?.message || "",
          channel: checkResult.manifest?.metadata?.channel || channel,
          createdAt: checkResult.manifest?.createdAt ? new Date(checkResult.manifest.createdAt) : new Date(),
          manifest: checkResult.manifest,
        },
      };
    } catch (nativeErr) {
      console.error("[OTA] Native checkForUpdateAsync error:", nativeErr?.message || nativeErr);
      return {
        status: "error",
        isAvailable: false,
        channel,
        error: nativeErr?.message || "Không thể kiểm tra cập nhật. Vui lòng thử lại sau.",
      };
    }
  }

  console.log("[OTA] Updates.isEnabled is false. Returning disabled status.");
  return { status: "disabled", isAvailable: false, channel };
}

/**
 * Downloads the update bundle and saves update metadata so it persists across reboots.
 *
 * @param {string} [channelOverride] Optional channel name to check/fetch
 * @param {object} [targetUpdateInfo] Update info metadata
 * @returns {Promise<{ status: 'downloaded' | 'disabled' | 'dev_mode' | 'error', channel?: string, manifest?: object, error?: string }>}
 */
export async function downloadAndApplyUpdate(channelOverride, targetUpdateInfo = null) {
  if (__DEV__) {
    console.log("[OTA] downloadAndApplyUpdate: Skipped (__DEV__ is true)");
    return { status: "dev_mode" };
  }

  const channel = channelOverride || getOtaChannel();
  console.log(
    `[OTA] downloadAndApplyUpdate initiated: channel="${channel}", targetId=${targetUpdateInfo?.id || "none"}, targetBuild=${targetUpdateInfo?.buildNumber || "none"}`
  );
  applyChannelOverride(channel);

  if (!Updates.isEnabled) {
    console.error("[OTA] Updates.isEnabled is false! Updates cannot be downloaded natively.");
    return { status: "disabled", error: "Tính năng cập nhật không khả dụng trong bản build này." };
  }

  try {
    console.log("[OTA] Invoking native Updates.fetchUpdateAsync()...");
    const fetchResult = await Updates.fetchUpdateAsync();
    console.log(
      `[OTA] fetchUpdateAsync result: isNew=${fetchResult?.isNew}, isRollBack=${fetchResult?.isRollBackToEmbedded}, manifestId=${fetchResult?.manifest?.id || targetUpdateInfo?.id || "none"}`
    );

    if (fetchResult?.isNew === false && !fetchResult?.manifest) {
      console.log(
        "[OTA] fetchUpdateAsync returned isNew=false. The app is already running the latest code. No update needed."
      );
      return {
        status: "up_to_date",
        channel,
      };
    }

    // Persist active build number and channel to storage so it survives app reboots
    const buildToSave =
      targetUpdateInfo?.buildNumber ||
      parseInt(fetchResult?.manifest?.metadata?.build_number, 10) ||
      getNativeBuildNumber();

    const updateIdToSave = targetUpdateInfo?.id || fetchResult?.manifest?.id || "";

    if (buildToSave > 0) {
      storage.set(OTA_ACTIVE_BUILD_KEY, buildToSave);
    }
    if (updateIdToSave) {
      storage.set(OTA_ACTIVE_UPDATE_ID_KEY, updateIdToSave);
    }
    storage.set(OTA_ACTIVE_CHANNEL_KEY, channel);

    console.log(
      `[OTA] Persisted active build to storage: buildNumber=${buildToSave}, updateId=${updateIdToSave}, channel=${channel}`
    );

    // Also persist header override to SharedPreferences
    applyChannelOverride(channel);

    return {
      status: "downloaded",
      manifest: fetchResult?.manifest || targetUpdateInfo?.manifest,
      channel,
    };
  } catch (error) {
    console.error(
      `[OTA] Updates.fetchUpdateAsync failed: ${error?.message || error} (code: ${error?.code || "none"})`
    );
    if (error?.stack) {
      console.error(`[OTA] Error stack: ${error.stack}`);
    }
    return {
      status: "error",
      channel,
      error: error?.message || "Không thể tải bản cập nhật.",
    };
  }
}

/**
 * Checks for a new update and downloads it if available (backward-compatible wrapper).
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
  if (check.status === "native_base_outdated") {
    return {
      status: "native_base_outdated",
      channel: check.channel,
      error: check.error,
      minNativeRequired: check.minNativeRequired,
      currentNativeBuild: check.currentNativeBuild,
      updateInfo: check.updateInfo,
    };
  }
  if (check.status === "error") {
    return { status: "error", channel: check.channel, error: check.error };
  }

  if (check.isAvailable) {
    const download = await downloadAndApplyUpdate(check.channel, check.updateInfo);
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
    console.log(`[OTA] reloadApp skipped (__DEV__: ${__DEV__}, Updates.isEnabled: ${Updates.isEnabled})`);
    return;
  }
  try {
    console.log("[OTA] Calling Updates.reloadAsync()...");
    await Updates.reloadAsync();
    console.log("[OTA] Updates.reloadAsync call returned.");
  } catch (err) {
    console.error("[OTA] Updates.reloadAsync error:", err?.message || err);
  }
}
