import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

// Downloads a remote image/video to the device's photo library. Used from
// the chat message reaction menu's "Download" option, for both image and
// video messages, and works the same whether it's your own message or
// someone else's.
export async function downloadMediaToLibrary(url, type = "image") {
  if (!url) throw new Error("No URL to download");

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("PERMISSION_DENIED");
  }

  const extension = type === "video" ? "mp4" : (url.split(".").pop() || "jpg").split("?")[0];
  const fileName = `cbh_${Date.now()}.${extension}`;
  const localUri = `${FileSystem.cacheDirectory}${fileName}`;

  const { uri } = await FileSystem.downloadAsync(url, localUri);
  const asset = await MediaLibrary.createAssetAsync(uri);

  // Group saved media into an app-named album so it doesn't just dump into
  // the camera roll's top level - iOS/Android both support this via the
  // same createAlbumAsync/addAssetsToAlbumAsync pair.
  try {
    const albumName = "CBH Online";
    const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);
    if (existingAlbum) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
    } else {
      await MediaLibrary.createAlbumAsync(albumName, asset, false);
    }
  } catch (e) {
    // Album grouping is a nicety - the asset is already saved to the
    // library either way, so don't fail the whole download over this.
  }

  if (Platform.OS !== "web") {
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }

  return asset;
}
