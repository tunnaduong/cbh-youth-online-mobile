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
let listeners = [];
let idCounter = 0;
let initialized = false;
let originalConsole = null;

const notifyListeners = () => {
  listeners.forEach((fn) => fn(logs));
};

const persistLogs = () => {
  AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs)).catch(() => {});
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
  if (!devModeEnabled) return;
  const entry = {
    id: `${Date.now()}_${idCounter++}`,
    level,
    message: args.map(stringifyArg).join(" "),
    timestamp: Date.now(),
  };
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
  devModeEnabled = enabled;
  await AsyncStorage.setItem(DEV_MODE_KEY, enabled ? "true" : "false");
  if (!enabled) {
    logs = [];
    await AsyncStorage.removeItem(LOGS_KEY);
  }
  notifyListeners();
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
