import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * Ensures that on iOS, all assets downloaded or bundled in OTA updates can be resolved
 * by Metro / expo-asset.
 *
 * Metro in JavaScript resolves assets by their MD5 packager hash (e.g. "286d67d3f74808a60a78d3ebf1a5fb57"),
 * whereas the OTA manifest and expo-updates store assets under their base64url SHA-256 key
 * (e.g. "XQdeDCh8T0RBtbXI_H6lzSfBG7YX7OoJdVlVvLGIkIM").
 * On iOS, expo-asset looks for the MD5 hash in ExpoUpdates.localAssets. If missing, it fails
 * to load font assets (breaking @expo/vector-icons) and returns empty URIs for images.
 *
 * This utility bridges the manifest asset URLs (which contain the MD5 hash as their filename)
 * directly into ExpoUpdates.localAssets so that every icon and asset resolves immediately.
 */
export function applyOtaLocalAssetsFix() {
  try {
    const ExpoUpdates = requireOptionalNativeModule("ExpoUpdates");
    if (!ExpoUpdates) return;

    const localAssets = ExpoUpdates.localAssets;
    if (!localAssets || typeof localAssets !== "object") return;

    let manifest = ExpoUpdates.manifest;
    if (!manifest && ExpoUpdates.manifestString) {
      try {
        manifest = JSON.parse(ExpoUpdates.manifestString);
      } catch (_) {}
    }

    if (manifest && typeof manifest === "object") {
      const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
      for (const asset of assets) {
        if (!asset) continue;
        const key = asset.key;
        const targetUri = (key && localAssets[key]) ? localAssets[key] : null;

        // Extract packager MD5 hash from URL (e.g. .../assets/286d67d3f74808a60a78d3ebf1a5fb57)
        if (asset.url) {
          const cleanUrl = String(asset.url).split("?")[0].split("#")[0];
          const lastPart = cleanUrl.split("/").pop();
          if (lastPart) {
            if (targetUri) {
              localAssets[lastPart] = targetUri;
              if (asset.fileExtension) {
                const ext = asset.fileExtension.replace(/^\./, "");
                localAssets[`${lastPart}.${ext}`] = targetUri;
                localAssets[`${lastPart}.${asset.fileExtension}`] = targetUri;
              }
            } else if (localAssets[lastPart]) {
              // Inverse map
              if (key) localAssets[key] = localAssets[lastPart];
            }
          }
        }

        const packagerHash = asset.packagerHash || asset.metadata?.packagerHash;
        if (packagerHash && targetUri) {
          localAssets[packagerHash] = targetUri;
          if (asset.fileExtension) {
            const ext = asset.fileExtension.replace(/^\./, "");
            localAssets[`${packagerHash}.${ext}`] = targetUri;
            localAssets[`${packagerHash}.${asset.fileExtension}`] = targetUri;
          }
        }
      }
    }

    // Also extract filenames/hashes from local file URIs already stored in localAssets
    for (const [key, uri] of Object.entries(localAssets)) {
      if (typeof uri === "string") {
        const cleanUri = decodeURIComponent(uri.split("?")[0].split("#")[0]);
        const filename = cleanUri.split("/").pop();
        if (filename && !localAssets[filename]) {
          localAssets[filename] = uri;
          const dotIdx = filename.lastIndexOf(".");
          if (dotIdx > 0) {
            const nameWithoutExt = filename.substring(0, dotIdx);
            if (!localAssets[nameWithoutExt]) {
              localAssets[nameWithoutExt] = uri;
            }
          }
        }
      }
    }
  } catch (err) {
    if (__DEV__) {
      console.warn("applyOtaLocalAssetsFix failed:", err);
    }
  }
}

// Run immediately on module import
applyOtaLocalAssetsFix();
