import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  AppState,
} from "react-native";

// Shown by index.js instead of crashing when a fatal error reaches the root
// (see the comment there). Plain React Native only: the theme, i18n or any
// other app module may be the very thing that failed to load.

// Translated when i18n loaded; otherwise the Vietnamese default.
const tr = (key, fallback) => {
  try {
    const i18n = require("../i18n").default;
    return i18n?.isInitialized ? i18n.t(key, { defaultValue: fallback }) : fallback;
  } catch {
    return fallback;
  }
};

const reload = async () => {
  try {
    await require("expo-updates").reloadAsync();
  } catch {
    try {
      require("react-native").DevSettings.reload();
    } catch {}
  }
};

// Self-repair: a broken bundle that reached users through OTA would otherwise
// leave them on this screen until they reinstall. While it is shown, ask the
// update server for a newer bundle and, if there is one, download it and
// reload into it. expo-updates is used directly - not services/ota/otaService,
// which imports MMKV storage and the rest of the app (any of which may be what
// failed, as with "createMMKV ... Value is undefined"). The channel override
// set from Settings is persisted natively, so the check uses the user's channel.
//
// Loop guard (AsyncStorage, not MMKV): each update id is applied automatically
// once. If the app comes back here still not running it, the update did not
// take or crashes too, and the user gets a button instead of an endless reload.
const ATTEMPT_KEY = "startup_error_ota_attempt";

const readAttempt = async () => {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    return JSON.parse((await AsyncStorage.getItem(ATTEMPT_KEY)) || "null");
  } catch {
    return null;
  }
};

const writeAttempt = async (id) => {
  try {
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem(ATTEMPT_KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {}
};

// status: idle | checking | downloading | applying | none | failed | blocked | unsupported
function useRecoveryUpdate() {
  const [status, setStatus] = React.useState("idle");
  const busy = React.useRef(false);

  const run = React.useCallback(async (manual = false) => {
    if (busy.current) return;
    let Updates;
    try {
      Updates = require("expo-updates");
    } catch {
      setStatus("unsupported");
      return;
    }
    if (__DEV__ || !Updates?.isEnabled) {
      setStatus("unsupported");
      return;
    }
    busy.current = true;
    try {
      setStatus("checking");
      const check = await Updates.checkForUpdateAsync();
      const targetId = check?.isRollBackToEmbedded
        ? "rollback-to-embedded"
        : check?.manifest?.id || null;
      const runningId = Updates.isEmbeddedLaunch ? null : Updates.updateId || null;
      if (!check?.isAvailable && !check?.isRollBackToEmbedded) {
        setStatus("none");
        return;
      }
      if (targetId && targetId === runningId) {
        setStatus("none");
        return;
      }
      const last = await readAttempt();
      if (!manual && last?.id && last.id === targetId) {
        // Already applied once and we are back here: let the user decide.
        setStatus("blocked");
        return;
      }
      setStatus("downloading");
      await Updates.fetchUpdateAsync();
      setStatus("applying");
      await writeAttempt(targetId);
      await Updates.reloadAsync();
    } catch {
      setStatus("failed");
    } finally {
      busy.current = false;
    }
  }, []);

  React.useEffect(() => {
    run(false);
    // The fix may be published while the screen is open: check again when the
    // user comes back to the app.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run(false);
    });
    return () => sub?.remove?.();
  }, [run]);

  return { status, retry: () => run(true) };
}

const copy = async (text) => {
  try {
    await require("expo-clipboard").setStringAsync(text);
  } catch {}
};

// Facts about the native side, appended to the error so a report shows what
// was missing - e.g. on iOS 15 the native modules could not be found at all.
// Every probe is guarded: this runs when something is already broken.
const diagnostics = () => {
  const lines = [];
  const probe = (label, fn) => {
    try {
      lines.push(`${label}: ${fn()}`);
    } catch (e) {
      lines.push(`${label}: threw ${e?.message ?? e}`);
    }
  };
  const RN = require("react-native");
  probe("OS", () => `${RN.Platform.OS} ${RN.Platform.Version}`);
  probe("App", () => {
    const app = require("expo-application");
    let otaLabel = "";
    try {
      const { storage } = require("../global/storage");
      const Updates = require("expo-updates");
      const manifestBuild = parseInt(Updates?.manifest?.metadata?.build_number, 10);
      const otaBuild =
        (Number.isFinite(manifestBuild) && manifestBuild > 0 ? manifestBuild : 0) ||
        storage?.getNumber?.("ota_active_build_number");
      if (otaBuild && !Updates?.isEmbeddedLaunch) {
        otaLabel = ` [OTA Build ${otaBuild}]`;
      } else if (Updates?.isEmbeddedLaunch) {
        otaLabel = " [Embedded]";
      }
    } catch {}
    return `${app.nativeApplicationVersion} (${app.nativeBuildVersion})${otaLabel}`;
  });
  probe("OTA", () => {
    try {
      const Updates = require("expo-updates");
      const { storage } = require("../global/storage");
      const manifestBuild = parseInt(Updates?.manifest?.metadata?.build_number, 10);
      const otaBuild =
        (Number.isFinite(manifestBuild) && manifestBuild > 0 ? manifestBuild : 0) ||
        storage?.getNumber?.("ota_active_build_number");
      const channel =
        Updates?.manifest?.metadata?.channel ||
        Updates?.channel ||
        storage?.getString?.("ota_channel") ||
        "default";
      const isEmbedded = Updates?.isEmbeddedLaunch;
      const updateId = Updates?.updateId || storage?.getString?.("ota_active_update_id") || "none";
      const buildInfo = isEmbedded ? "embedded launch" : otaBuild ? `Build ${otaBuild}` : "unknown";
      return `${buildInfo} (channel: ${channel}, id: ${updateId}, embedded: ${Boolean(isEmbedded)})`;
    } catch {
      try {
        const Updates = require("expo-updates");
        return Updates.isEmbeddedLaunch
          ? "embedded (no OTA active)"
          : `updateId: ${Updates.updateId || "none"}`;
      } catch (e) {
        return "not available";
      }
    }
  });
  probe("Bridgeless", () => String(global.RN$Bridgeless));
  probe("__turboModuleProxy", () => typeof global.__turboModuleProxy);
  probe("nativeModuleProxy", () => typeof global.nativeModuleProxy);
  probe("expo.modules", () =>
    global.expo?.modules ? Object.keys(global.expo.modules).length + " modules" : "missing"
  );
  for (const name of [
    "PlatformConstants",
    "SourceCode",
    "DeviceInfo",
    "ImageLoader",
    "WorkletsModule",
    "ReanimatedModule",
  ]) {
    probe(`TurboModule ${name}`, () => (RN.TurboModuleRegistry.get(name) ? "found" : "null"));
  }
  probe("NativeModules", () => Object.keys(RN.NativeModules ?? {}).length + " keys");
  return lines.join("\n");
};

export default function StartupErrorScreen({ error }) {
  const dark = useColorScheme() === "dark";
  const [copied, setCopied] = React.useState(false);
  const { status: otaStatus, retry: retryOta } = useRecoveryUpdate();
  const updating = otaStatus === "downloading" || otaStatus === "applying";
  const details = React.useMemo(
    () =>
      [
        error?.name && error?.message ? `${error.name}: ${error.message}` : String(error ?? ""),
        error?.stack || "",
        diagnostics(),
      ]
        .filter(Boolean)
        .join("\n\n"),
    [error]
  );

  const fg = dark ? "#fff" : "#111";
  const sub = dark ? "#aaa" : "#555";

  return (
    <View style={[styles.container, { backgroundColor: dark ? "#111" : "#fff" }]}>
      <Text style={[styles.title, { color: fg }]}>
        {tr("startupError.title", "Ứng dụng gặp lỗi khi khởi động")}
      </Text>
      <Text style={[styles.body, { color: sub }]}>
        {tr(
          "startupError.body",
          "Hãy thử mở lại. Nếu lỗi vẫn còn, sao chép nội dung bên dưới và gửi cho đội ngũ CBH Youth Online."
        )}
      </Text>
      <OtaStatusCard status={otaStatus} dark={dark} onRetry={retryOta} />
      <ScrollView style={[styles.details, { borderColor: dark ? "#333" : "#ddd" }]}>
        <Text selectable style={[styles.mono, { color: fg }]}>
          {details}
        </Text>
      </ScrollView>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, styles.secondary, { borderColor: "#319527" }]}
          onPress={() => copy(details).then(() => setCopied(true))}
        >
          <Text style={[styles.buttonText, { color: "#319527" }]}>
            {copied ? tr("startupError.copied", "Đã sao chép") : tr("startupError.copy", "Sao chép lỗi")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: "#319527" }]} onPress={reload}>
          <Text style={[styles.buttonText, { color: "#fff" }]}>
            {tr("startupError.reload", "Mở lại")}
          </Text>
        </TouchableOpacity>
      </View>
      {updating ? (
        <View style={[styles.overlay, { backgroundColor: dark ? "#111" : "#fff" }]}>
          <ActivityIndicator size="large" color="#319527" />
          <Text style={[styles.overlayTitle, { color: fg }]}>
            {otaStatus === "applying"
              ? tr("startupError.otaApplying", "Đang khởi động lại với bản mới...")
              : tr("startupError.otaDownloading", "Đang tải bản cập nhật sửa lỗi...")}
          </Text>
          <Text style={[styles.overlayBody, { color: sub }]}>
            {tr("startupError.otaWait", "Ứng dụng sẽ tự mở lại khi xong. Đừng tắt ứng dụng.")}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// One line under the intro saying what the update check found.
function OtaStatusCard({ status, dark, onRetry }) {
  if (status === "idle" || status === "unsupported" || status === "downloading" || status === "applying") {
    return null;
  }
  const sub = dark ? "#aaa" : "#555";
  const text = {
    checking: tr("startupError.otaChecking", "Đang tìm bản cập nhật sửa lỗi..."),
    none: tr("startupError.otaNone", "Chưa có bản cập nhật mới. Ứng dụng sẽ tự kiểm tra lại khi bạn quay lại."),
    failed: tr("startupError.otaFailed", "Không kiểm tra được bản cập nhật. Hãy kiểm tra kết nối mạng."),
    blocked: tr("startupError.otaBlocked", "Bản cập nhật đã được cài nhưng ứng dụng vẫn lỗi."),
  }[status];
  const canRetry = status === "none" || status === "failed" || status === "blocked";
  return (
    <View style={[styles.otaCard, { borderColor: "#319527" }]}>
      {status === "checking" ? <ActivityIndicator size="small" color="#319527" /> : null}
      <Text style={[styles.otaText, { color: sub }]}>{text}</Text>
      {canRetry ? (
        <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.otaAction}>
            {status === "blocked"
              ? tr("startupError.otaRetry", "Cài lại")
              : tr("startupError.otaCheck", "Kiểm tra")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  details: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
  mono: { fontFamily: "Courier", fontSize: 12 },
  row: { flexDirection: "row", gap: 12 },
  button: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  secondary: { borderWidth: 1.5 },
  buttonText: { fontSize: 15, fontWeight: "600" },
  otaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  otaText: { flex: 1, fontSize: 13, lineHeight: 18 },
  otaAction: { color: "#319527", fontSize: 14, fontWeight: "700" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  overlayTitle: { fontSize: 17, fontWeight: "700", marginTop: 16, textAlign: "center" },
  overlayBody: { fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
});
