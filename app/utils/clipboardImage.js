import * as FileSystem from "expo-file-system/legacy";

// expo-clipboard is a native module. An app binary built before it was added
// doesn't contain it, and requiring it there throws - so load it defensively
// and let the "paste image" option simply stay hidden on such builds (a JS
// update must never be able to crash an older binary).
let Clipboard = null;
try {
  Clipboard = require("expo-clipboard");
} catch (error) {
  Clipboard = null;
}

export const hasClipboardImage = async () => {
  try {
    return !!Clipboard && (await Clipboard.hasImageAsync());
  } catch (error) {
    return false;
  }
};

// Saves the clipboard image to a cache file and returns it shaped like an
// image-picker asset ({ uri, mimeType, fileSize }), or null if there is none.
export const readClipboardImage = async () => {
  if (!Clipboard) return null;
  const image = await Clipboard.getImageAsync({ format: "jpeg", jpegQuality: 0.85 });
  const base64 = image?.data?.replace(/^data:[^,]*,/, "");
  if (!base64) return null;

  const uri = `${FileSystem.cacheDirectory}pasted-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, mimeType: "image/jpeg", fileSize: Math.floor((base64.length * 3) / 4) };
};
