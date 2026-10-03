import { Image } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/**
 * Compression of photos and videos on the device before upload. The API no
 * longer compresses uploads itself, so every place that sends media goes
 * through here first.
 *
 * Photos use expo-image-manipulator (always available).
 *
 * Videos need a native encoder: `react-native-compressor`. It is loaded
 * optionally - when the package isn't installed in the build, videos are
 * sent as they are (on iOS the picker already exports 720p H.264, see
 * VIDEO_EXPORT_PRESET). To enable it everywhere:
 *   npx expo install react-native-compressor   (then make a new native build)
 */
let VideoCompressor = null;
try {
  // In a try block so Metro treats the package as optional.
  VideoCompressor = require("react-native-compressor").Video;
} catch {
  VideoCompressor = null;
}

// Same limits the server job used for photos: 1470px wide, quality 85.
const IMAGE_MAX_WIDTH = 1470;
const IMAGE_QUALITY = 0.85;

// 720p H.264 at the bitrate ceiling the server job used.
const VIDEO_MAX_SIZE = 1280;
const VIDEO_BITRATE = 4700000;

export const canCompressVideo = () => !!VideoCompressor;

const imageSize = (uri) =>
  new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });

/**
 * Downscale (to 1470px wide) and re-encode a photo. Resolves to the original
 * uri for GIFs (would lose the animation) or when anything fails.
 *
 * @param {string} uri
 * @returns {Promise<string>} uri of the file to upload
 */
export async function compressImageForUpload(uri) {
  if (!uri || /\.gif(\?|$)/i.test(uri)) return uri;

  try {
    const size = await imageSize(uri);
    const actions = size && size.width > IMAGE_MAX_WIDTH ? [{ resize: { width: IMAGE_MAX_WIDTH } }] : [];
    // PNG keeps transparency (and its extension, which the upload code uses
    // to pick the MIME type); everything else becomes JPEG.
    const isPng = /\.png(\?|$)/i.test(uri);
    const result = await manipulateAsync(uri, actions, {
      compress: IMAGE_QUALITY,
      format: isPng ? SaveFormat.PNG : SaveFormat.JPEG,
    });
    return result.uri || uri;
  } catch {
    return uri;
  }
}

/**
 * Compress a video to 720p H.264. Resolves to `{ uri, compressed }`:
 * `compressed` is false (and `uri` the original) when the native compressor
 * isn't in this build or the compression failed.
 *
 * @param {string} uri
 * @param {(ratio: number) => void} [onProgress]  0..1
 */
export async function compressVideoForUpload(uri, onProgress) {
  if (!uri || !VideoCompressor) return { uri, compressed: false };

  try {
    const result = await VideoCompressor.compress(
      uri,
      {
        compressionMethod: "manual",
        maxSize: VIDEO_MAX_SIZE,
        bitrate: VIDEO_BITRATE,
        // MB - tiny clips aren't worth re-encoding.
        minimumFileSizeForCompress: 3,
      },
      (progress) => onProgress?.(progress)
    );
    if (!result || result === uri) return { uri, compressed: false };
    return { uri: result, compressed: true };
  } catch {
    return { uri, compressed: false };
  }
}
