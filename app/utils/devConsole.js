import AsyncStorage from "@react-native-async-storage/async-storage";

// Lightweight in-app debug console. Captures console.log/warn/error output
// so we can see what actually happened on a device we don't have physical
// access to (e.g. "why does picking a Live Photo on Android fail but a
// normal photo doesn't") without needing a USB-attached logcat/Metro session.
//
// Capture only happens while dev mode is on - toggling it off wipes
// everything already collected. This is intentional: it's meant to be
// opt-in and disposable, not a silent always-on log of user activity.

const DEV_MODE_KEY = "dev_console_enabled";
const LOGS_KEY = "dev_console_logs";
const MAX_LOGS = 500;

let devModeEnabled = false;
let logs = [];
let otaRingBuffer = [];
const MAX_OTA_BUFFER = 100;
let listeners = [];
let idCounter = 0;
let initialized = false;
let originalConsole = null;

const notifyListeners = () => {
  listeners.forEach((fn) => fn(logs));
};

// Written at most once a second: serialising up to 500 entries and writing
// them on every single log line made the app stutter with dev mode on.
let persistTimer = null;
const persistLogs = () => {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs)).catch(() => {});
  }, 1000);
};

const stringifyArg = (arg) => {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.stack || arg.message;
  try {
    return JSON.stringify(arg);
  } catch (e) {
    return String(arg);
  }
};

const addLog = (level, args) => {
  const isOta = args.some(
    (a) => typeof a === "string" && (a.includes("[OTA]") || a.includes("[OTA Modal]") || a.includes("[OTA Screen]") || a.includes("[OTA Startup]"))
  );

  const entry = {
    id: `${Date.now()}_${idCounter++}`,
    level,
    message: args.map(stringifyArg).join(" "),
    timestamp: Date.now(),
  };

  if (isOta) {
    otaRingBuffer = [entry, ...otaRingBuffer].slice(0, MAX_OTA_BUFFER);
  }

  if (!devModeEnabled) return;

  logs = [entry, ...logs].slice(0, MAX_LOGS);
  notifyListeners();
  persistLogs();
};

// Patches global console methods once so any existing console.log/warn/error
// call anywhere in the app (including ones we'll never think to instrument
// individually) gets captured for free.
const patchConsole = () => {
  if (originalConsole) return;
  originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = (...args) => {
    // In a release build with dev mode off nobody reads plain logs, yet each
    // call still formats its arguments (whole API responses in places) and
    // sends them to the native logger.
    // OTA logs are always captured into otaRingBuffer so diagnostics are never lost.
    const isOta = args.some(
      (a) => typeof a === "string" && (a.includes("[OTA]") || a.includes("[OTA Modal]") || a.includes("[OTA Screen]") || a.includes("[OTA Startup]"))
    );
    if (!__DEV__ && !devModeEnabled && !isOta) return;
    originalConsole.log(...args);
    addLog("log", args);
  };
  console.warn = (...args) => {
    originalConsole.warn(...args);
    addLog("warning", args);
  };
  console.error = (...args) => {
    originalConsole.error(...args);
    addLog("error", args);
  };
};

export const initDevConsole = async () => {
  if (initialized) return;
  initialized = true;
  patchConsole();
  try {
    const stored = await AsyncStorage.getItem(DEV_MODE_KEY);
    devModeEnabled = stored === "true";
    if (devModeEnabled) {
      const storedLogs = await AsyncStorage.getItem(LOGS_KEY);
      logs = storedLogs ? JSON.parse(storedLogs) : [];
      if (otaRingBuffer.length > 0) {
        const existingIds = new Set(logs.map((l) => l.id));
        const newOta = otaRingBuffer.filter((l) => !existingIds.has(l.id));
        if (newOta.length > 0) {
          logs = [...newOta, ...logs].slice(0, MAX_LOGS);
        }
      }
    } else {
      // Dev mode isn't on - make sure nothing lingers from a previous
      // session where it was.
      await AsyncStorage.removeItem(LOGS_KEY);
      logs = [];
    }
  } catch (e) {
    devModeEnabled = false;
    logs = [];
  }
};

export const isDevModeEnabled = () => devModeEnabled;

export const setDevModeEnabled = async (enabled) => {
  devModeEnabled = !!enabled;
  await AsyncStorage.setItem(DEV_MODE_KEY, enabled ? "true" : "false");
  if (!enabled) {
    logs = [];
    await AsyncStorage.removeItem(LOGS_KEY);
  } else {
    // When enabled, prepopulate with recent OTA logs so the user immediately
    // sees what happened during OTA checks even if dev mode was off at startup!
    if (otaRingBuffer.length > 0) {
      const existingIds = new Set(logs.map((l) => l.id));
      const newOta = otaRingBuffer.filter((l) => !existingIds.has(l.id));
      logs = [...newOta, ...logs].slice(0, MAX_LOGS);
    }
  }
  notifyListeners();
  persistLogs();
};

export const getLogs = () => logs;

export const clearLogs = () => {
  logs = [];
  notifyListeners();
  persistLogs();
};

export const subscribeDevConsole = (fn) => {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
};
