import { Platform, ToastAndroid, BackHandler } from "react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import { storage } from "../../global/storage";
import { MIN_NATIVE_BUILD_REQUIRED, getEmbeddedDefaultChannel } from "./otaConfig";
import i18n from "../../i18n";

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
export const OTA_ACTIVE_CREATED_AT_KEY = "ota_active_created_at";
export const OTA_ENABLED_KEY = "ota_enabled";
export const OTA_CHECK_STARTUP_KEY = "ota_check_startup";
// Update the user answered "Để sau" to at startup: not offered again at startup.
export const OTA_PROMPT_SKIPPED_ID_KEY = "ota_prompt_skipped_update_id";
// Update last downloaded + reloaded into. If the app still is not running it after
// that, the native launcher refused it, and offering it again would loop forever.
export const OTA_APPLY_ATTEMPT_ID_KEY = "ota_apply_attempt_update_id";

export const OTA_CHANNELS = {
  PRODUCTION: "production",
  PREVIEW: "preview",
};

function normalizeUpdateId(id) {
  return typeof id === "string" && id.trim() ? id.trim().toLowerCase() : "";
}

/**
 * Reads live runtime metadata directly from the native ExpoUpdates module and JS wrapper.
 * Handles both new base binaries and older base binaries (where `disableAntiBrickingMeasures`
 * could cause `Updates.isEmbeddedLaunch` to report `false` on embedded/emergency launches).
 */
export function getLiveUpdatesRuntime() {
  let nativeMod = null;
  try {
    nativeMod = requireOptionalNativeModule("ExpoUpdates");
  } catch {}

  const updateId = normalizeUpdateId(nativeMod?.updateId ?? Updates.updateId) || null;

  let manifest = null;
  if (nativeMod?.manifest && typeof nativeMod.manifest === "object") {
    manifest = nativeMod.manifest;
  } else if (typeof nativeMod?.manifestString === "string" && nativeMod.manifestString) {
    try {
      manifest = JSON.parse(nativeMod.manifestString);
    } catch {}
  }
  if ((!manifest || typeof manifest !== "object") && Updates.manifest && typeof Updates.manifest === "object") {
    manifest = Updates.manifest;
  }
  if (!manifest || typeof manifest !== "object") {
    manifest = {};
  }

  const isEmbeddedFlag = Boolean(nativeMod?.isEmbeddedLaunch ?? Updates.isEmbeddedLaunch);
  const isEmergencyLaunch = Boolean(nativeMod?.isEmergencyLaunch ?? Updates.isEmergencyLaunch);

  const hasOtaMetadata = Boolean(
    manifest.metadata && typeof manifest.metadata === "object"
  );
  const hasRemoteLaunchAsset = Boolean(manifest.launchAsset?.url);
  const hasManifestKeys = Object.keys(manifest).length > 0;

  // Embedded BareManifests only contain { id, commitTime, assets } (never `metadata` or `launchAsset.url`),
  // whereas every OTA manifest from our server includes `metadata` and `launchAsset.url`.
  // Checking this guarantees accurate embedded detection even on older base binaries where
  // `disableAntiBrickingMeasures: true` set `Updates.isEmbeddedLaunch = false`.
  const isEmbeddedLaunch =
    isEmbeddedFlag ||
    isEmergencyLaunch ||
    !updateId ||
    (hasManifestKeys && !hasOtaMetadata && !hasRemoteLaunchAsset);

  const parsedManifestBuild = parseInt(manifest?.metadata?.build_number, 10);
  const manifestBuildNumber =
    Number.isFinite(parsedManifestBuild) && parsedManifestBuild > 0
      ? parsedManifestBuild
      : 0;

  const manifestChannel =
    typeof manifest?.metadata?.channel === "string" && manifest.metadata.channel
      ? manifest.metadata.channel
      : null;

  const commitTimeRaw = nativeMod?.commitTime ?? Updates.createdAt ?? manifest?.createdAt ?? null;
  let createdAt = null;
  if (commitTimeRaw) {
    const parsedDate = new Date(commitTimeRaw);
    if (!Number.isNaN(parsedDate.getTime())) {
      createdAt = parsedDate;
    }
  }

  return {
    isEnabled: Boolean(nativeMod?.isEnabled ?? Updates.isEnabled),
    isEmbeddedLaunch,
    isEmergencyLaunch,
    updateId,
    manifest,
    manifestBuildNumber,
    manifestChannel,
    createdAt,
    runtimeVersion: nativeMod?.runtimeVersion ?? Updates.runtimeVersion ?? null,
    channel: nativeMod?.channel ?? Updates.channel ?? null,
  };
}

function clearStoredActiveOtaMetadata() {
  try {
    if (storage.contains(OTA_ACTIVE_BUILD_KEY)) storage.delete(OTA_ACTIVE_BUILD_KEY);
    if (storage.contains(OTA_ACTIVE_UPDATE_ID_KEY)) storage.delete(OTA_ACTIVE_UPDATE_ID_KEY);
    if (storage.contains(OTA_ACTIVE_CHANNEL_KEY)) storage.delete(OTA_ACTIVE_CHANNEL_KEY);
    if (storage.contains(OTA_ACTIVE_CREATED_AT_KEY)) storage.delete(OTA_ACTIVE_CREATED_AT_KEY);
  } catch {}
}

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
 * - If running embedded, returns the native binary build number.
 * - If running an OTA update, reads `manifest.metadata.build_number` directly from the
 *   live launched OTA manifest first (and keeps MMKV in sync), so consecutive OTA updates
 *   (including background `ON_LOAD` updates) always report the true running OTA build number
 *   instead of falling back to the embedded build number.
 */
export function getRunningOtaBuildNumber() {
  const nativeBuild = getNativeBuildNumber();
  const runtime = getLiveUpdatesRuntime();

  if (runtime.isEmbeddedLaunch) {
    return nativeBuild;
  }

  const storedBuild = storage.getNumber(OTA_ACTIVE_BUILD_KEY) || 0;
  const storedUpdateId = normalizeUpdateId(storage.getString(OTA_ACTIVE_UPDATE_ID_KEY));

  // Primary source of truth: the live manifest of the currently launched OTA bundle.
  if (runtime.manifestBuildNumber > 0) {
    if (
      storedBuild !== runtime.manifestBuildNumber ||
      (runtime.updateId && storedUpdateId !== runtime.updateId)
    ) {
      try {
        storage.set(OTA_ACTIVE_BUILD_KEY, runtime.manifestBuildNumber);
        if (runtime.updateId) {
          storage.set(OTA_ACTIVE_UPDATE_ID_KEY, runtime.updateId);
        }
        if (runtime.manifestChannel) {
          storage.set(OTA_ACTIVE_CHANNEL_KEY, runtime.manifestChannel);
        }
        if (runtime.createdAt) {
          storage.set(OTA_ACTIVE_CREATED_AT_KEY, runtime.createdAt.getTime());
        }
      } catch {}
    }
    return runtime.manifestBuildNumber;
  }

  // Fallback when manifest metadata is absent: check stored MMKV metadata
  if (runtime.updateId && storedUpdateId && runtime.updateId === storedUpdateId && storedBuild > 0) {
    return storedBuild;
  }

  if (storedBuild > nativeBuild) {
    return storedBuild;
  }

  return nativeBuild;
}

/**
 * Synchronizes the native binary APK/IPA build number and live expo-updates runtime
 * with MMKV storage:
 * 1. If running an embedded bundle (e.g. after upgrading to a newer base APK/IPA or rollback),
 *    clears any stale OTA build/updateId entries so the UI cleanly reflects the embedded build.
 * 2. If running an OTA bundle (e.g. applied silently via `ON_LOAD` on a 2nd consecutive OTA),
 *    syncs MMKV to the live OTA manifest's build number, updateId, channel, and timestamp.
 */
export function syncNativeAndOtaBuild() {
  try {
    const nativeBuild = getNativeBuildNumber();
    const runtime = getLiveUpdatesRuntime();

    if (runtime.isEmbeddedLaunch) {
      clearStoredActiveOtaMetadata();
      return;
    }

    if (runtime.manifestBuildNumber > 0) {
      storage.set(OTA_ACTIVE_BUILD_KEY, runtime.manifestBuildNumber);
      if (runtime.updateId) {
        storage.set(OTA_ACTIVE_UPDATE_ID_KEY, runtime.updateId);
      }
      if (runtime.manifestChannel) {
        storage.set(OTA_ACTIVE_CHANNEL_KEY, runtime.manifestChannel);
      }
      if (runtime.createdAt) {
        storage.set(OTA_ACTIVE_CREATED_AT_KEY, runtime.createdAt.getTime());
      }
      return;
    }

    const storedBuild = storage.getNumber(OTA_ACTIVE_BUILD_KEY) || 0;
    if (nativeBuild > 0 && storedBuild > 0 && nativeBuild > storedBuild) {
      clearStoredActiveOtaMetadata();
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
  const storedUpdateId = normalizeUpdateId(storage.getString(OTA_ACTIVE_UPDATE_ID_KEY)) || null;

  try {
    const runtime = getLiveUpdatesRuntime();
    const isOtaActive = !runtime.isEmbeddedLaunch && Boolean(runtime.updateId);
    const currentUpdateId = runtime.isEmbeddedLaunch
      ? runtime.updateId
      : runtime.updateId || storedUpdateId;

    return {
      isEnabled: runtime.isEnabled,
      isEmbeddedLaunch: runtime.isEmbeddedLaunch,
      updateId: currentUpdateId,
      channel: (isOtaActive && runtime.manifestChannel) || runtime.channel || activeChannel,
      activeChannel,
      runtimeVersion: runtime.runtimeVersion,
      createdAt: runtime.createdAt,
      nativeBuildNumber,
      activeBuildNumber,
      isOtaActive,
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
      activeBuildNumber: nativeBuildNumber,
      isOtaActive: false,
      error: err?.message,
    };
  }
}

/**
 * Reads and prints native expo-updates log entries for debugging initialization failures.
 */
export async function logNativeUpdatesLogs() {
  try {
    if (typeof Updates.readLogEntriesAsync === "function") {
      const entries = await Updates.readLogEntriesAsync(86400000);
      if (entries && entries.length > 0) {
        console.warn(`[OTA Native Logs] Found ${entries.length} log entry(ies):`);
        entries.slice(-10).forEach((entry) => {
          console.warn(`[OTA Native Log] [${entry.code || "INFO"}] ${entry.message}`);
        });
      } else {
        console.log("[OTA Native Logs] No entries found in expo-updates log.");
      }
    }
  } catch (err) {
    console.warn("[OTA Native Logs] Could not read native logs:", err?.message);
  }
}

/**
 * Queries the self-hosted manifest or native expo-updates to check if an update is available.
 *
 * Implements intelligent checks:
 * 1. Minimum native build check: blocks OTA if base APK is older than min_native_build.
 * 2. Build number & timestamp comparison: blocks downgrades (< active or < native) while allowing
 *    both higher build numbers and newer consecutive OTA releases with equal build numbers.
 * 3. Update ID matching: prevents re-downloading the currently running update.
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
  const runtime = getLiveUpdatesRuntime();
  const liveUpdateId = runtime.updateId || "";
  const activeTime = runtime.createdAt
    ? runtime.createdAt.getTime()
    : !runtime.isEmbeddedLaunch
    ? storage.getNumber(OTA_ACTIVE_CREATED_AT_KEY) || 0
    : 0;

  console.log(
    `[OTA] checkUpdateAvailable started (channel: "${channel}", force: ${force}, nativeBuild: ${currentNativeBuild}, activeOtaBuild: ${currentActiveBuild}, embedded: ${runtime.isEmbeddedLaunch})`
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

  // 1. If native expo-updates is enabled, native checkForUpdateAsync() is the primary source of truth.
  // It verifies runtime version compatibility, checks the native database, compares commitTime/createdAt
  // against the embedded/running bundle, and evaluates selection policy.
  if (Updates.isEnabled) {
    try {
      console.log(`[OTA] Checking for update natively on channel "${channel}"...`);
      const checkResult = await Updates.checkForUpdateAsync();
      console.log(
        `[OTA] Native checkForUpdateAsync result: isAvailable=${checkResult?.isAvailable}, id=${checkResult?.manifest?.id || "none"}`
      );

      if (!checkResult?.isAvailable) {
        console.log("[OTA] Native checkResult.isAvailable is false. Client is up to date.");
        return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
      }

      // Native confirmed a newer update is available!
      const manifest = checkResult.manifest || {};
      const manifestId = normalizeUpdateId(manifest.id);
      const parsedUpstreamBuild = parseInt(manifest.metadata?.build_number, 10);
      const upstreamBuildNumber =
        Number.isFinite(parsedUpstreamBuild) && parsedUpstreamBuild > 0
          ? parsedUpstreamBuild
          : currentNativeBuild;
      const minNativeBuild =
        parseInt(manifest.metadata?.min_native_build, 10) || MIN_NATIVE_BUILD_REQUIRED;

      if (liveUpdateId && manifestId && manifestId === liveUpdateId) {
        console.log(`[OTA Native] Upstream update ID matches running update (${liveUpdateId}). Up to date.`);
        return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
      }

      // Check if installed base APK is too old for this OTA update
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
            id: manifest.id,
            buildNumber: upstreamBuildNumber,
            minNativeBuild,
            currentNativeBuild,
            message: manifest.metadata?.message || "",
            channel: manifest.metadata?.channel || channel,
            createdAt: manifest.createdAt ? new Date(manifest.createdAt) : new Date(),
            manifest,
          },
        };
      }

      if (upstreamBuildNumber > 0 && currentNativeBuild > 0 && upstreamBuildNumber < currentNativeBuild) {
        console.log(
          `[OTA Native] Upstream build (${upstreamBuildNumber}) < native build (${currentNativeBuild}). Blocking update downgrade.`
        );
        return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
      }

      if (upstreamBuildNumber > 0 && currentActiveBuild > 0 && upstreamBuildNumber < currentActiveBuild) {
        console.log(
          `[OTA Native] Upstream build (${upstreamBuildNumber}) < active build (${currentActiveBuild}). Blocking update downgrade.`
        );
        return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
      }

      // An update not newer than the running bundle can never launch: the native launcher
      // (patched DatabaseLauncher / AppLauncherWithDatabase) drops OTAs whose commitTime is
      // <= the embedded one, and otherwise picks the newest. Offering it showed the prompt
      // on every launch while the app kept running the same bundle.
      {
        const serverTime = manifest.createdAt ? new Date(manifest.createdAt).getTime() : 0;
        if (activeTime > 0 && serverTime > 0 && serverTime <= activeTime) {
          console.log(
            `[OTA Native] Server update time (${serverTime}) <= running bundle time (${activeTime}). Up to date.`
          );
          return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
        }
      }

      console.log(`[OTA Native] Valid new update available: ID=${manifest.id}, Build=${upstreamBuildNumber}`);
      return {
        status: "available",
        isAvailable: true,
        channel,
        updateInfo: {
          id: manifest.id,
          buildNumber: upstreamBuildNumber || currentActiveBuild || currentNativeBuild,
          minNativeBuild,
          currentNativeBuild,
          message: manifest.metadata?.message || "",
          channel: manifest.metadata?.channel || channel,
          createdAt: manifest.createdAt ? new Date(manifest.createdAt) : new Date(),
          manifest,
        },
      };
    } catch (nativeErr) {
      console.warn("[OTA] Native checkForUpdateAsync error, falling back to direct HTTP check:", nativeErr?.message || nativeErr);
    }
  }

  // 2. Direct HTTP manifest check (fallback when native call encounters network error or for diagnostics)
  try {
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const runtimeVersion =
      runtime.runtimeVersion ||
      Constants.expoConfig?.runtimeVersion ||
      "7.4.10";
    const url = `https://api.chuyenbienhoa.com/v1.0/ota/manifest?channel=${encodeURIComponent(
      channel
    )}&runtime-version=${encodeURIComponent(runtimeVersion)}&platform=${platform}&current_update_id=${encodeURIComponent(
      liveUpdateId
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
        return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
      }
      if (data?.id) {
        const manifestId = normalizeUpdateId(data.id);
        const upstreamBuildNumber = parseInt(data.metadata?.build_number, 10) || 0;
        const minNativeBuild =
          parseInt(data.metadata?.min_native_build, 10) || MIN_NATIVE_BUILD_REQUIRED;

        // Check if currently running update ID matches
        if (liveUpdateId && manifestId && manifestId === liveUpdateId) {
          console.log(`[OTA] Upstream update ID matches running update (${liveUpdateId}). Up to date.`);
          return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
        }

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

        // Upstream OTA version must be at least as new as the installed native APK.
        if (upstreamBuildNumber > 0 && currentNativeBuild > 0 && upstreamBuildNumber < currentNativeBuild) {
          console.log(
            `[OTA HTTP] Upstream build (${upstreamBuildNumber}) < native build (${currentNativeBuild}). Blocking update downgrade.`
          );
          return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
        }

        // Block downgrades (e.g. switching preview -> older production).
        if (upstreamBuildNumber > 0 && currentActiveBuild > 0 && upstreamBuildNumber < currentActiveBuild) {
          console.log(
            `[OTA HTTP] Upstream build (${upstreamBuildNumber}) < active build (${currentActiveBuild}). Blocking update downgrade.`
          );
          return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
        }

        // Check timestamps against active/embedded update if build numbers are equal
        // (allows consecutive OTA pushes with the same build number while blocking older channels).
        // Same rule as the native path: not newer than the running bundle = never launched.
        {
          const serverTime = data.createdAt ? new Date(data.createdAt).getTime() : 0;
          if (activeTime > 0 && serverTime > 0 && serverTime <= activeTime) {
            console.log(
              `[OTA] Server update time (${serverTime}) <= running bundle time (${activeTime}). Up to date.`
            );
            return { status: "up_to_date", isAvailable: false, channel, buildNumber: currentActiveBuild };
          }
        }

        if (!Updates.isEnabled) {
          console.log("[OTA] Updates.isEnabled is false in this environment.");
          logNativeUpdatesLogs().catch(() => {});
          return { status: "disabled", isAvailable: false, channel };
        }

        console.log(
          `[OTA] Update is available via HTTP check: ID=${data.id}, Build=${upstreamBuildNumber}, Channel="${data.metadata?.channel || channel}"`
        );
        return {
          status: "available",
          isAvailable: true,
          channel,
          updateInfo: {
            id: data.id,
            buildNumber: upstreamBuildNumber || currentActiveBuild || currentNativeBuild,
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
    console.error("[OTA] Direct manifest check error:", httpErr?.message || httpErr);
  }

  if (!Updates.isEnabled) {
    logNativeUpdatesLogs().catch(() => {});
    return { status: "disabled", isAvailable: false, channel };
  }

  return {
    status: "error",
    isAvailable: false,
    channel,
    error: "Không thể kiểm tra bản cập nhật. Vui lòng thử lại sau.",
  };
}

/**
 * The user answered "Để sau" to this update at startup: don't offer it again at startup
 * (Settings > App updates still does). With checkAutomatically ON_LOAD it is usually
 * fetched in the background and applied on a later cold start anyway.
 */
export function rememberSkippedStartupUpdate(updateId) {
  const id = normalizeUpdateId(updateId);
  if (!id) return;
  try {
    storage.set(OTA_PROMPT_SKIPPED_ID_KEY, id);
  } catch {}
}

/**
 * Whether the startup check may show the prompt for this update.
 * - not after the user said "Để sau" to the same update;
 * - not when it was already downloaded and reloaded into but the app still runs
 *   another bundle (the native launcher refused it) - prompting again would loop.
 */
export function shouldPromptAtStartup(updateInfo) {
  const id = normalizeUpdateId(updateInfo?.id);
  if (!id) return true;
  try {
    if (normalizeUpdateId(storage.getString(OTA_PROMPT_SKIPPED_ID_KEY)) === id) {
      console.log(`[OTA Startup] Update ${id} was postponed by the user. Not prompting.`);
      return false;
    }
    const attempted = normalizeUpdateId(storage.getString(OTA_APPLY_ATTEMPT_ID_KEY));
    const running = getLiveUpdatesRuntime().updateId || "";
    if (attempted === id && running !== id) {
      console.warn(
        `[OTA Startup] Update ${id} was already applied once but the app still runs ${running || "the embedded bundle"}. Not prompting again.`
      );
      return false;
    }
  } catch {}
  return true;
}

/**
 * Downloads the update bundle and saves update metadata so it persists across reboots.
 *
 * @param {string} [channelOverride] Optional channel name to check/fetch
 * @param {object} [targetUpdateInfo] Update info metadata
 * @returns {Promise<{ status: 'downloaded' | 'disabled' | 'dev_mode' | 'up_to_date' | 'error', channel?: string, manifest?: object, error?: string }>}
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

  const currentNativeBuild = getNativeBuildNumber();
  const currentActiveBuild = getRunningOtaBuildNumber();
  const runtime = getLiveUpdatesRuntime();
  const liveUpdateId = runtime.updateId || "";
  const requestedTargetId = normalizeUpdateId(targetUpdateInfo?.id);

  // Prevent downgrading below the currently active OTA build or the base APK/IPA build
  if (targetUpdateInfo?.buildNumber && currentActiveBuild > 0 && targetUpdateInfo.buildNumber < currentActiveBuild) {
    console.log(
      `[OTA] targetUpdateInfo.buildNumber (${targetUpdateInfo.buildNumber}) < active build (${currentActiveBuild}). Blocking download downgrade.`
    );
    return { status: "up_to_date", channel };
  }

  if (targetUpdateInfo?.buildNumber && currentNativeBuild > 0 && targetUpdateInfo.buildNumber < currentNativeBuild) {
    console.log(
      `[OTA] targetUpdateInfo.buildNumber (${targetUpdateInfo.buildNumber}) < native build (${currentNativeBuild}). Blocking download downgrade.`
    );
    return { status: "up_to_date", channel };
  }

  if (requestedTargetId && liveUpdateId && requestedTargetId === liveUpdateId) {
    console.log(
      `[OTA] targetUpdateInfo.id (${requestedTargetId}) matches currently running update ID. Already applied.`
    );
    return { status: "up_to_date", channel };
  }

  if (!Updates.isEnabled) {
    console.error("[OTA] Updates.isEnabled is false! Updates cannot be downloaded natively.");
    logNativeUpdatesLogs().catch(() => {});
    return { status: "disabled", error: "Tính năng cập nhật không khả dụng trong bản build này." };
  }

  try {
    console.log("[OTA] Invoking native Updates.fetchUpdateAsync()...");
    const fetchResult = await Updates.fetchUpdateAsync();
    console.log(
      `[OTA] fetchUpdateAsync result: isNew=${fetchResult?.isNew}, isRollBack=${fetchResult?.isRollBackToEmbedded}, manifestId=${fetchResult?.manifest?.id || targetUpdateInfo?.id || "none"}`
    );

    if (fetchResult?.isRollBackToEmbedded) {
      clearStoredActiveOtaMetadata();
      applyChannelOverride(channel);
      return { status: "downloaded", channel };
    }

    const fetchedManifest = fetchResult?.manifest || targetUpdateInfo?.manifest || null;
    const targetId = normalizeUpdateId(fetchResult?.manifest?.id || targetUpdateInfo?.id);

    if (fetchResult?.isNew === false && !fetchResult?.manifest) {
      if (!targetId || (liveUpdateId && liveUpdateId === targetId)) {
        console.log(
          "[OTA] fetchUpdateAsync returned isNew=false and client already runs this update. Up to date."
        );
        return {
          status: "up_to_date",
          channel,
        };
      }
      console.log(
        "[OTA] fetchUpdateAsync returned isNew=false, but newer update is cached/pending. Proceeding with reload."
      );
    }

    // Persist active build number, normalized update ID, created time, and channel to storage.
    // Never fall back to getNativeBuildNumber() ahead of currentActiveBuild when manifest is omitted on cached updates!
    const parsedManifestBuild = parseInt(fetchedManifest?.metadata?.build_number, 10);
    const buildToSave =
      targetUpdateInfo?.buildNumber ||
      (Number.isFinite(parsedManifestBuild) && parsedManifestBuild > 0 ? parsedManifestBuild : 0) ||
      currentActiveBuild ||
      currentNativeBuild;

    const updateIdToSave = targetId || liveUpdateId;
    const channelToSave = fetchedManifest?.metadata?.channel || channel;

    if (buildToSave > 0) {
      storage.set(OTA_ACTIVE_BUILD_KEY, buildToSave);
    }
    if (updateIdToSave) {
      storage.set(OTA_ACTIVE_UPDATE_ID_KEY, updateIdToSave);
    }
    if (targetId) {
      storage.set(OTA_APPLY_ATTEMPT_ID_KEY, targetId);
    }
    storage.set(OTA_ACTIVE_CHANNEL_KEY, channelToSave);

    const createdAt = targetUpdateInfo?.createdAt || fetchedManifest?.createdAt;
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime();
      if (createdTime > 0) {
        storage.set(OTA_ACTIVE_CREATED_AT_KEY, createdTime);
      }
    }

    console.log(
      `[OTA] Persisted active build to storage: buildNumber=${buildToSave}, updateId=${updateIdToSave}, channel=${channelToSave}`
    );

    // Also persist header override to SharedPreferences / UserDefaults
    applyChannelOverride(channel);

    return {
      status: "downloaded",
      manifest: fetchedManifest,
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
 * Relaunches the app via Expo Updates to apply the newly downloaded OTA bundle.
 * Updates.reloadAsync() tells the Expo native loader to restart the React runtime
 * using the newly cached JS bundle.
 */
export async function reloadApp() {
  if (__DEV__) {
    console.log("[OTA] reloadApp skipped in __DEV__");
    return;
  }
  // Last resort on Android: relaunch natively (new build), else just exit so the
  // next launch loads the new bundle.
  const relaunchAndroid = () => {
    if (Platform.OS !== "android") return;
    try {
      const Native = require("../../../modules/cbh-call-ui").default;
      if (typeof Native?.restartApp === "function") {
        Native.restartApp();
        return;
      }
    } catch {}
    try {
      BackHandler.exitApp();
    } catch {}
  };
  if (!Updates.isEnabled) {
    relaunchAndroid();
    return;
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[OTA] Calling Updates.reloadAsync() (attempt ${attempt})...`);
      await Updates.reloadAsync();
      return;
    } catch (err) {
      console.error("[OTA] reloadApp error:", err?.message || err);
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  relaunchAndroid();
}

let isForcedUpdateInProgress = false;
let lastOtaCheckTimestamp = 0;

function compareSemver(v1, v2) {
  const parts1 = String(v1 || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = String(v2 || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks if server has issued a forced OTA update directive and executes it immediately,
 * bypassing user in-app toggles.
 *
 * Supports:
 * - `min_version` / `min_build`: Oldest version affected.
 * - `max_version` / `max_build`: Highest version forced to upgrade.
 * - `channel`: "all" (forces every branch to upgrade to the latest build in that branch) or specific channel.
 *
 * @param {object} otaDirective { force: boolean, min_version?: string|null, max_version?: string|null, min_build?: number|null, max_build?: number|null, channel?: string|null, message?: string|null }
 * @returns {Promise<{ enforced: boolean, updated?: boolean, upToDate?: boolean, error?: string }>}
 */
export async function checkAndExecuteForcedOtaUpdate(otaDirective) {
  if (!otaDirective || !otaDirective.force) {
    return { enforced: false };
  }

  if (isForcedUpdateInProgress) {
    console.log("[OTA Force] Forced update already in progress. Skipping duplicate call.");
    return { enforced: true, inProgress: true };
  }

  if (__DEV__) {
    console.log("[OTA Force] App in __DEV__ mode. Skipping forced OTA.");
    return { enforced: false, devMode: true };
  }

  if (!Updates.isEnabled) {
    console.log("[OTA Force] Updates.isEnabled is false in this environment.");
    return { enforced: false, disabled: true };
  }

  const currentActiveBuild = getRunningOtaBuildNumber();
  const currentAppVersion = Application?.nativeApplicationVersion || "0.0.0";
  const currentChannel = getOtaChannel();

  // 1. Channel check:
  // If directive channel is specified and not "all", it only affects clients on that specific channel.
  const directiveChannel = otaDirective.channel;
  if (directiveChannel && directiveChannel !== "all" && directiveChannel !== currentChannel) {
    console.log(
      `[OTA Force] Directive targets channel "${directiveChannel}", but current device is on "${currentChannel}". Skipping.`
    );
    return { enforced: false, channelMismatch: true };
  }

  // When channel is "all", client updates to the latest version in its own active branch/channel!
  const targetChannel = (!directiveChannel || directiveChannel === "all") ? currentChannel : directiveChannel;

  // 2. Minimum build/version check:
  // If device is already at or above the minimum required version/build, it is already up to date.
  const minBound = otaDirective.min_version ?? otaDirective.min_build;
  if (minBound !== undefined && minBound !== null && minBound !== "") {
    if (!isNaN(minBound)) {
      const minBuildNum = parseInt(minBound, 10);
      if (currentActiveBuild >= minBuildNum && (!otaDirective.max_version && !otaDirective.max_build)) {
        console.log(
          `[OTA Force] Current active build (${currentActiveBuild}) is already at or above minimum required build (${minBuildNum}). Already up to date.`
        );
        return { enforced: false, aboveMinVersion: true, upToDate: true };
      }
    } else {
      if (compareSemver(currentAppVersion, String(minBound)) >= 0 && (!otaDirective.max_version && !otaDirective.max_build)) {
        console.log(
          `[OTA Force] Current app version (${currentAppVersion}) is already at or above minimum required version (${minBound}). Already up to date.`
        );
        return { enforced: false, aboveMinVersion: true, upToDate: true };
      }
    }
  }

  // 3. Maximum version/build check (Highest version forced to upgrade):
  // Clients newer than max_version/max_build are already up to date and NOT forced to upgrade.
  const maxBound = otaDirective.max_version ?? otaDirective.max_build;
  if (maxBound !== undefined && maxBound !== null && maxBound !== "") {
    if (!isNaN(maxBound)) {
      const maxBuildNum = parseInt(maxBound, 10);
      if (currentActiveBuild > maxBuildNum) {
        console.log(
          `[OTA Force] Current active build (${currentActiveBuild}) is higher than maximum forced build (${maxBuildNum}). Already up to date.`
        );
        return { enforced: false, aboveMaxVersion: true, upToDate: true };
      }
    } else {
      if (compareSemver(currentAppVersion, String(maxBound)) > 0) {
        console.log(
          `[OTA Force] Current app version (${currentAppVersion}) is higher than maximum forced version (${maxBound}). Already up to date.`
        );
        return { enforced: false, aboveMaxVersion: true, upToDate: true };
      }
    }
  }

  isForcedUpdateInProgress = true;

  try {
    console.log(
      `[OTA Force] Executing forced OTA update check on channel "${targetChannel}" (activeBuild=${currentActiveBuild}, range=[${minBound || "any"}, ${maxBound || "any"}])...`
    );

    // Call checkUpdateAvailable with force = true to bypass isOtaEnabled()
    const checkResult = await checkUpdateAvailable(targetChannel, true);

    if (checkResult.status === "available" && checkResult.updateInfo) {
      const updatingToast = i18n?.t
        ? i18n.t("ota.forceUpdatingToast", "Hệ thống đang tự động tải bản cập nhật mới...")
        : "Hệ thống đang tự động tải bản cập nhật mới...";
      const updatedToast = i18n?.t
        ? i18n.t("ota.forceUpdatedToast", "Bản cập nhật đã tải xong. Ứng dụng sẽ tự khởi động lại...")
        : "Bản cập nhật đã tải xong. Ứng dụng sẽ tự khởi động lại...";

      // Native Toast on Android
      if (Platform.OS === "android") {
        try {
          ToastAndroid.showWithGravity(updatingToast, ToastAndroid.LONG, ToastAndroid.BOTTOM);
        } catch {}
      }

      // Schedule system notification
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "CBH Youth Online",
            body: otaDirective.message || updatingToast,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });
      } catch {}

      console.log(`[OTA Force] Downloading forced update bundle (ID: ${checkResult.updateInfo.id})...`);
      const downloadResult = await downloadAndApplyUpdate(checkResult.channel, checkResult.updateInfo);

      if (downloadResult.status === "downloaded") {
        if (Platform.OS === "android") {
          try {
            ToastAndroid.showWithGravity(updatedToast, ToastAndroid.LONG, ToastAndroid.BOTTOM);
          } catch {}
        }

        console.log("[OTA Force] Update downloaded successfully. Triggering app reload in 1500ms...");
        setTimeout(() => {
          reloadApp();
        }, 1500);

        return { enforced: true, updated: true };
      } else {
        console.error("[OTA Force] Download failed:", downloadResult.error);
        return { enforced: true, error: downloadResult.error };
      }
    } else if (checkResult.status === "up_to_date") {
      console.log("[OTA Force] App is already on the latest available OTA bundle.");
      return { enforced: false, upToDate: true };
    } else if (checkResult.status === "native_base_outdated") {
      console.warn("[OTA Force] Native base APK outdated for forced OTA bundle:", checkResult.error);
      return { enforced: true, baseOutdated: true, error: checkResult.error };
    }

    return { enforced: false, status: checkResult.status };
  } catch (err) {
    console.error("[OTA Force] Exception in forced OTA update:", err?.message || err);
    return { enforced: false, error: err?.message };
  } finally {
    isForcedUpdateInProgress = false;
  }
}

/**
 * Fetches remote app config and executes forced OTA if server mandated it.
 * Throttled to at most once per 30 seconds.
 */
export async function syncRemoteOtaConfig(axiosInstance = null) {
  const now = Date.now();
  if (now - lastOtaCheckTimestamp < 30000) {
    return { throttled: true };
  }
  lastOtaCheckTimestamp = now;

  try {
    const api = axiosInstance || require("../api/axiosInstance").default;
    const res = await api.get("/v1.0/app/config", { timeout: 4000 });
    const otaDirective = res?.data?.ota_update;
    if (otaDirective?.force) {
      return await checkAndExecuteForcedOtaUpdate(otaDirective);
    }
    return { enforced: false, config: otaDirective };
  } catch (err) {
    return { enforced: false, error: err?.message };
  }
}
