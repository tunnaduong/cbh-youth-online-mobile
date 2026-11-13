import { MMKV, Mode } from "react-native-mmkv";

// MULTI_PROCESS: the Android chat bubble (modules/hmy-bubble) runs the chat
// screen in its own process, which shares these files with the app.
export const storage = new MMKV({ mode: Mode.MULTI_PROCESS });
