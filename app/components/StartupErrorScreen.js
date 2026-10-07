import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
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
    return `${app.nativeApplicationVersion} (${app.nativeBuildVersion})`;
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
});
