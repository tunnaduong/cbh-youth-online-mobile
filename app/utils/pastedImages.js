import { Platform } from "react-native";

// react-native-paste-input is a native module. A binary built before it was
// added doesn't contain it, and importing it there throws - so load it
// defensively and let the composer fall back to a plain input on such builds
// (a JS update must never be able to crash an older binary).
//
// On Android, PasteInput renders a custom native Fabric component (PasteTextInputNativeComponent),
// which registers PasteTextInputShadowNode instead of React Native's AndroidTextInputShadowNode.
// When passed as inputComponent into MarkdownTextInput, live-markdown's decorator shadow node
// attempts to dynamic_cast children[0] to AndroidTextInputShadowNode, which evaluates to null and
// causes a SIGSEGV null pointer dereference at overwriteTextLayoutManager().
// On iOS, PasteInput wraps standard TextInput via ISA swizzling, so it works seamlessly.
let PasteInput = null;
try {
  PasteInput = require("@mattermost/react-native-paste-input").default;
} catch (error) {
  PasteInput = null;
}

export const PasteInputComponent = PasteInput;

// What a keyboard (Gboard / iOS stickers, GIFs, images) or the paste menu
// hands over, kept to images: [{ uri, type, fileName, fileSize }].
export const imageFilesFromPaste = (error, files) => {
  if (error || !Array.isArray(files)) return [];
  return files.filter((file) => file?.uri && String(file.type || "").startsWith("image/"));
};
