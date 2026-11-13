import { Platform } from "react-native";
import NativeModule from "../../../modules/cbh-call-ui";

/**
 * The operating system's own incoming-call UI (modules/cbh-call-ui):
 * - iOS: CallKit, fed by VoIP pushes (PushKit) - the system call screen, also
 *   on the lock screen and when the app is killed.
 * - Android: a CallStyle notification with a full-screen intent - the app opens
 *   over the lock screen and the phone rings until the call is handled.
 *
 * Everything here is a safe no-op on a build without the native module, so an
 * OTA update to an older binary keeps the previous behaviour.
 */
const Native = NativeModule;

export const nativeCallUiAvailable = !!Native;

/** iOS rings through CallKit, so JS must not play its own ringtone. */
export const ringsThroughCallKit = nativeCallUiAvailable && Platform.OS === "ios";

const safe = (fn, fallback = undefined) => {
  try {
    return fn();
  } catch (e) {
    console.warn("[nativeCallUi]", e?.message);
    return fallback;
  }
};

const callerNameOf = (call) =>
  call?.caller?.profile_name || call?.caller?.username || "CBH Youth Online";

export function setNativeCallSession(apiBase, token) {
  if (!Native || !apiBase || !token) return;
  safe(() => Native.setSession(String(apiBase), String(token)));
}

export function clearNativeCallSession() {
  if (!Native) return;
  safe(() => Native.clearSession());
}

export function reportIncomingCallToOs(call) {
  if (!Native || !call?.id || Platform.OS !== "ios") return;
  safe(() =>
    Promise.resolve(
      Native.reportIncomingCall(
        JSON.stringify(call),
        callerNameOf(call),
        call.type === "video"
      )
    ).catch(() => {})
  );
}

/** JS is ringing on its own screen: drop the Android ringing notification. */
export function dismissOsIncomingCall(callId) {
  if (!Native || callId == null) return;
  safe(() => Native.dismissIncoming(String(callId)));
}

/** Answered inside the app: close the system call UI without ending the call. */
export function markAnsweredInApp(callId) {
  if (!Native || callId == null) return;
  safe(() => Native.endCall(String(callId), "answeredElsewhere"));
}

/** The call is over: remove any system call UI / lock-screen override. */
export function osCallEnded(callId) {
  if (!Native || callId == null) return;
  safe(() => Native.callEnded(String(callId)));
}

export function getVoipToken() {
  if (!Native || Platform.OS !== "ios") return null;
  return safe(() => Native.getVoipToken(), null);
}

/** Actions taken in the system UI before JS listened (cold start). */
export function consumePendingCallActions() {
  if (!Native) return [];
  return parseActions(safe(() => Native.consumePendingActions(), []) || []);
}

function parseActions(list) {
  return list
    .map((item) => {
      try {
        return { action: item.action, call: JSON.parse(item.call || "{}") };
      } catch {
        return null;
      }
    })
    .filter((a) => a && a.action && a.call?.id != null);
}

export function addCallActionListener(listener) {
  if (!Native?.addListener) return { remove() {} };
  return Native.addListener("onCallAction", (event) => {
    const [parsed] = parseActions([event]);
    if (parsed) listener(parsed);
  });
}

export function addVoipTokenListener(listener) {
  if (!Native?.addListener || Platform.OS !== "ios") return { remove() {} };
  return Native.addListener("onVoipToken", (event) => {
    if (event?.token) listener(event.token);
  });
}

export function canUseFullScreenIntent() {
  if (!Native || Platform.OS !== "android") return true;
  return safe(() => Native.canUseFullScreenIntent(), true) !== false;
}

export function openFullScreenIntentSettings() {
  if (!Native || Platform.OS !== "android") return;
  safe(() => Native.openFullScreenIntentSettings());
}
