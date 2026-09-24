import { createContext, useContext } from "react";

// Lets AuthContext "cold restart" the app in-process: the root component
// keys the whole provider tree on a counter, so bumping it unmounts every
// context (auth, chat socket, push registration, feed caches, navigation)
// and mounts them again from scratch, exactly like a fresh launch would,
// without asking the native side to relaunch the React host.
//
// We used to do this with expo-updates' reloadAsync(). That relaunch loads
// the newest *downloaded* update, and on iOS activating a freshly downloaded
// OTA bundle that way crashes the app on expo-updates 55
// (https://github.com/expo/expo/issues/45772) - which is exactly the state a
// device is in most of the time here, since OTA updates ship often and
// CheckOnLaunch is ALWAYS. Remounting in JS sidesteps the native path.
export const SessionResetContext = createContext(() => {});

export const useSessionReset = () => useContext(SessionResetContext);
