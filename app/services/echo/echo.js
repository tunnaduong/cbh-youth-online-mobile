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
const reconnectListeners = new Set();

/** cb() runs each time the socket is connected again after having been down. */
export function onEchoReconnect(cb) {
  reconnectListeners.add(cb);
  return () => reconnectListeners.delete(cb);
}

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
    // Notice a dead socket (mobile network switch, doze) in ~35s instead of ~2min.
    activityTimeout: 25000,
    pongTimeout: 10000,
    authorizer,
  };

  echoInstance = new Echo({
    broadcaster: "reverb",
    key: REVERB_APP_KEY,
    ...connectionOptions,
    client: new Pusher(REVERB_APP_KEY, connectionOptions),
  });

  // Messages sent while the socket was down are never replayed: tell the
  // screens to re-read the REST API every time the socket comes back.
  let wasDown = false;
  echoInstance.connector.pusher.connection.bind("state_change", (states) => {
    console.log("[Echo] connection state:", states.previous, "->", states.current);
    if (states.current === "connected") {
      if (wasDown) reconnectListeners.forEach((cb) => cb());
      wasDown = false;
    } else if (states.current !== "connecting") {
      wasDown = true;
    }
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
export function reconnectEchoIfNeeded(awayMs = 0) {
  const connection = echoInstance?.connector?.pusher?.connection;
  if (!connection) return;

  const state = connection.state;
  // "connected" after a long time in the background is often a dead socket the
  // OS froze: drop it and connect afresh (channels are re-subscribed by pusher-js).
  if (state === "connected" && awayMs > 20000) {
    console.log("[Echo] foregrounded after", awayMs, "ms - refreshing the connection");
    connection.disconnect();
    connection.connect();
    return;
  }
  if (state !== "connected" && state !== "connecting") {
    console.log("[Echo] app foregrounded with connection state:", state, "- reconnecting");
    connection.connect();
  }
}
