import { Platform } from "react-native";
import { MMKV, Mode } from "react-native-mmkv";

// `id` must be given whenever a config object is passed: MMKV only falls back
// to "mmkv.default" when the constructor gets no argument at all, and a
// missing id crashes at launch ("Value is undefined, expected a String").
// Keep "mmkv.default" so the data saved before this change is still read.
//
// MULTI_PROCESS (Android only): the chat bubble (modules/hmy-bubble) runs the
// chat screen in its own process, which shares these files with the app.
// iOS has no second process, so it stays on the default mode.
export const storage = new MMKV({
  id: "mmkv.default",
  ...(Platform.OS === "android" ? { mode: Mode.MULTI_PROCESS } : null),
});
