// react-native-paste-input was previously imported here for keyboard stickers.
// However, under React Native Fabric (New Architecture),
// MarkdownTextInput's native decorator (MarkdownTextInputDecoratorShadowNode)
// dynamic_casts its child ShadowNode to AndroidTextInputShadowNode (Android)
// and TextInputShadowNode (iOS). Wrapping PasteInput causes that cast to fail,
// resulting in a nullptr dereference and fatal SIGSEGV native crash when opening
// chat or post comments.
// Therefore, PasteInputComponent is disabled so MarkdownTextInput always wraps
// standard TextInput.
export const PasteInputComponent = null;

// What a keyboard (Gboard / iOS stickers, GIFs, images) or the paste menu
// hands over, kept to images: [{ uri, type, fileName, fileSize }].
export const imageFilesFromPaste = (error, files) => {
  if (error || !Array.isArray(files)) return [];
  return files.filter((file) => file?.uri && String(file.type || "").startsWith("image/"));
};
