// The app is portrait-only except where a screen asks otherwise (the game
// WebView). app.json allows every orientation natively ("orientation":
// "default"), so the lock is held from JS: lockPortrait() at launch,
// allowRotation() while such a screen is focused.
//
// The module is required lazily and optionally: a JS update running on a
// build made before expo-screen-orientation was added has no native module,
// and must keep working (it simply stays portrait, as that build's
// app.json says).
let ScreenOrientation = null;
try {
  ScreenOrientation = require("expo-screen-orientation");
} catch (e) {
  ScreenOrientation = null;
}

export function lockPortrait() {
  ScreenOrientation?.lockAsync?.(ScreenOrientation.OrientationLock.PORTRAIT_UP)?.catch(() => {});
}

export function allowRotation() {
  ScreenOrientation?.unlockAsync?.()?.catch(() => {});
}
