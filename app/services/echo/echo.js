import Echo from "laravel-echo";
// The React Native build of pusher-js only exports `Pusher` as a named export
// (module.exports.Pusher = ...), unlike the web build's default export.
import { Pusher } from "pusher-js/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = "https://api.chuyenbienhoa.com";
const REVERB_APP_KEY = "7l9nmxw0nga4rfkooehp";
const REVERB_HOST = "ws.chuyenbienhoa.com";
const REVERB_PORT = 443;
const REVERB_SCHEME = "https";

let echoInstance = null;

/**
 * Lazily creates a singleton Laravel Echo client wired to the Reverb server.
 * RN has no `window.Pusher` global, so a Pusher client is built explicitly and
 * passed in as `client` (unlike the web app, which relies on the global lookup).
 * The authorizer re-reads the bearer token from AsyncStorage on every channel
 * subscription attempt so it stays correct across login/logout.
 */
export function getEcho() {
  if (echoInstance) return echoInstance;

  // NOTE: `authorizer` is a real pusher-js Pusher-constructor option, not an Echo
  // option - it must be passed into `new Pusher(...)` below, not into `new Echo(...)`,
  // since we build our own `client` explicitly (RN has no `window.Pusher` global for
  // Echo to fall back to). Putting it on the outer Echo options silently does nothing,
  // and pusher-js then falls back to its default relative `/pusher/auth` endpoint,
  // which is meaningless in RN (no page origin to resolve it against).
  const authorizer = (channel) => ({
    authorize: (socketId, callback) => {
      AsyncStorage.getItem("auth_token")
        .then((token) =>
          fetch(`${API_BASE_URL}/broadcasting/auth`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: `socket_id=${encodeURIComponent(
              socketId
            )}&channel_name=${encodeURIComponent(channel.name)}`,
          })
        )
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Broadcast auth failed: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          console.log("[Echo] auth OK for", channel.name, data);
          callback(false, data);
        })
        .catch((error) => {
          console.log("[Echo] auth FAILED for", channel.name, error?.message || error);
          callback(true, error);
        });
    },
  });

  const connectionOptions = {
    // pusher-js unconditionally requires a `cluster` key even when wsHost/wsPort
    // point at a self-hosted Reverb server - it's unused here, just to satisfy validation.
    cluster: "",
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT,
    forceTLS: REVERB_SCHEME === "https",
    enabledTransports: ["ws", "wss"],
    disableStats: true,
    authorizer,
  };

  echoInstance = new Echo({
    broadcaster: "reverb",
    key: REVERB_APP_KEY,
    ...connectionOptions,
    client: new Pusher(REVERB_APP_KEY, connectionOptions),
  });

  // TEMP DIAGNOSTICS - remove once realtime chat is confirmed working
  echoInstance.connector.pusher.connection.bind("state_change", (states) => {
    console.log("[Echo] connection state:", states.previous, "->", states.current);
  });
  echoInstance.connector.pusher.connection.bind("error", (err) => {
    console.log("[Echo] connection error:", JSON.stringify(err));
  });

  return echoInstance;
}

export function disconnectEcho() {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
}

/** The socket id of this device, used as `X-Socket-Id` so `->toOthers()` excludes it. */
export function getSocketId() {
  return echoInstance?.socketId() || null;
}

/**
 * The OS suspends a backgrounded app's network/socket connections, so the
 * Reverb connection silently goes stale while the app is backgrounded (e.g.
 * screen locked, switched to another app) - pusher-js doesn't know to retry
 * the instant the app comes back to the foreground, so a message that
 * arrived during that window never got delivered live, only becoming
 * visible after a full screen remount (which re-fetches from the REST API
 * and rejoins the channel from scratch). Call this whenever the app
 * transitions back to the foreground to force a reconnect if the
 * connection isn't already healthy.
 */
export function reconnectEchoIfNeeded() {
  const connection = echoInstance?.connector?.pusher?.connection;
  if (!connection) return;

  const state = connection.state;
  if (state !== "connected" && state !== "connecting") {
    console.log("[Echo] app foregrounded with connection state:", state, "- reconnecting");
    connection.connect();
  }
}
