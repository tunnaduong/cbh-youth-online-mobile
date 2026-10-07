import { Keyboard, Platform } from "react-native";

// Android only tells React Native about the keyboard when it appears and
// when it goes away ("keyboardDidShow" / "keyboardDidHide"). If it changes
// HEIGHT while it stays open - the user shrinks it, switches to a shorter
// layout, hides the suggestion strip - nothing fires, and anything positioned
// from the height remembered at "show" (mention list, editor toolbar, text
// sheet) stays where the taller keyboard put it.
//
// react-native-keyboard-controller does report those changes. It is loaded in
// a try block: JavaScript can reach a build that does not have it.
let KeyboardEvents = null;
try {
  KeyboardEvents = require("react-native-keyboard-controller").KeyboardEvents;
} catch {
  KeyboardEvents = null;
}

/**
 * Keep a "keyboard height" state right while an open keyboard is resized.
 * Call it inside the effect that already listens to the keyboard, with the
 * same setter, and call what it returns in the cleanup:
 *
 *   const offResize = trackAndroidKeyboardResize(setKeyboardHeight);
 *   return () => { show.remove(); hide.remove(); offResize(); };
 *
 * It only ever acts on Android, and only on a resize: opening and closing
 * stay with the screen's own listeners. The library and React Native do not
 * have to measure the keyboard the same way (the navigation bar may or may
 * not be counted), so the difference between the two is taken when the
 * keyboard opens and applied to the library's later heights.
 */
export function trackAndroidKeyboardResize(setHeight) {
  if (Platform.OS !== "android" || !KeyboardEvents?.addListener) return () => {};

  let libraryHeight = null; // the library's height of the open keyboard
  let nativeHeight = 0; // React Native's height of the open keyboard
  let offset = null; // nativeHeight - libraryHeight, fixed per opening

  const pair = () => {
    if (offset === null && libraryHeight !== null && nativeHeight > 0) {
      offset = nativeHeight - libraryHeight;
    }
  };

  const subscriptions = [
    Keyboard.addListener("keyboardDidShow", (event) => {
      nativeHeight = event?.endCoordinates?.height || 0;
      pair();
    }),
    Keyboard.addListener("keyboardDidHide", () => {
      nativeHeight = 0;
      libraryHeight = null;
      offset = null;
    }),
    KeyboardEvents.addListener("keyboardDidShow", (event) => {
      const next = event?.height || 0;
      if (next <= 0) return;

      const resized = libraryHeight !== null && offset !== null && next !== libraryHeight;
      libraryHeight = next;
      if (resized) {
        setHeight(Math.max(0, next + offset));
      } else {
        pair();
      }
    }),
  ];

  return () => subscriptions.forEach((subscription) => subscription.remove());
}
