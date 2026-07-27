import * as FileSystem from "expo-file-system/legacy";

// Mirrors the backend's video_files[] validation (post create/update
// endpoints): mp4, mov, avi, webm, mkv, 100MB max per file.
export const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "webm", "mkv"];
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const MIME_BY_EXTENSION = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

export const getVideoExtension = (uriOrName) =>
  (uriOrName || "").split(".").pop()?.toLowerCase();

export const getVideoMimeType = (extension) =>
  MIME_BY_EXTENSION[extension] || "video/mp4";

// Checks one picked video asset (from expo-image-picker) against the file
// type/size rules before it's uploaded. `asset.fileSize` isn't always
// populated by the picker (notably on some Android versions), so this falls
// back to asking the filesystem for the real size.
export const validateVideoAsset = async (asset) => {
  const extension = getVideoExtension(asset.fileName || asset.uri);

  if (!extension || !ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
    return { ok: false, reason: "type", extension, size: null };
  }

  let size = asset.fileSize ?? null;
  if (size == null) {
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      size = info?.size ?? null;
    } catch (error) {
      size = null;
    }
  }

  if (size != null && size > MAX_VIDEO_SIZE_BYTES) {
    return { ok: false, reason: "size", extension, size };
  }

  return { ok: true, reason: null, extension, size };
};
