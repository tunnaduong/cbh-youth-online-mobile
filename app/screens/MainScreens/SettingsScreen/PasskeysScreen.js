import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import AppToast from "../../../components/AppToast";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { apiErrorMessage } from "../../../utils/apiMessage";
import {
  createPasskey,
  deletePasskey,
  getPasskeys,
  passkeysSupported,
  PasskeyError,
} from "../../../services/passkey";

// A PasskeyError already carries a translated message; the rest comes from
// the API.
const messageOf = (error) =>
  error instanceof PasskeyError ? error.message : apiErrorMessage(error);

// "Passkeys": the passkeys this account can log in with, and adding one on
// this device with the system's own sheet (services/passkey.js).
export default function PasskeysScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const supported = passkeysSupported();
  const [passkeys, setPasskeys] = useState(null);
  const [passwordRequired, setPasswordRequired] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // The password is only asked for once "Add" has been tapped.
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");

  const apply = (data) => {
    setPasskeys(data.passkeys || []);
    setPasswordRequired(data.password_required !== false);
  };

  const load = useCallback(async () => {
    try {
      apply(await getPasskeys());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const closeAsk = () => {
    setAsking(false);
    setPassword("");
    setError("");
  };

  const add = async () => {
    if (adding || (passwordRequired && !password)) return;
    setAdding(true);
    setError("");
    try {
      apply(await createPasskey(passwordRequired ? password : undefined));
      closeAsk();
      Toast.show({ type: "success", text1: t("passkeys.added") });
    } catch (err) {
      // Closing the system sheet needs no message.
      if (!(err instanceof PasskeyError && err.cancelled)) setError(messageOf(err));
    } finally {
      setAdding(false);
    }
  };

  const startAdd = () => {
    setError("");
    if (passwordRequired) {
      setAsking(true);
    } else {
      // Nothing to ask first (account created through Google/Facebook/Apple).
      add();
    }
  };

  // Asks first: the passkey stops working for login the moment it is removed.
  const remove = (passkey) => {
    if (removingId !== null) return;

    Alert.alert(t("passkeys.removeTitle"), t("passkeys.removeConfirm"), [
      { text: t("security.cancel"), style: "cancel" },
      {
        text: t("passkeys.remove"),
        style: "destructive",
        onPress: async () => {
          setRemovingId(passkey.id);
          try {
            apply(await deletePasskey(passkey.id));
            Toast.show({ type: "success", text1: t("passkeys.removed") });
          } catch (err) {
            Toast.show({ type: "error", text1: t("common.error"), text2: messageOf(err) });
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
          <View style={styles.headerSide}>
            <LiquidButton size={44} scrollY={scrollY} providerId="PasskeysScreen" onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t("passkeys.title")}
          </Animated.Text>
          <View style={styles.headerSide} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="PasskeysScreen" style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Animated.ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            // The list starts below the floating header; without the offset
            // the spinner sits under the status bar.
            progressViewOffset={64 + insets.top}
          />
        }
      >
        <Text style={[styles.description, { color: theme.subText }]}>
          {t("passkeys.description")}
        </Text>

        {!supported && (
          <Text style={[styles.description, { color: theme.subText }]}>
            {t("passkeys.errors.notSupported")}
          </Text>
        )}

        {loadError ? (
          <Text style={{ color: theme.subText, textAlign: "center", marginTop: 24 }}>
            {t("passkeys.loadError")}
          </Text>
        ) : !passkeys ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            {passkeys.length === 0 ? (
              <Text style={[styles.description, { color: theme.subText }]}>
                {t("passkeys.empty")}
              </Text>
            ) : (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {passkeys.map((passkey, index) => (
                  <View
                    key={passkey.id}
                    style={[
                      styles.item,
                      index < passkeys.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.border,
                      },
                    ]}
                  >
                    <View style={[styles.itemIcon, { backgroundColor: theme.iconBackground }]}>
                      <Ionicons name="finger-print-outline" size={20} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
                        {passkey.name || t("passkeys.unnamed")}
                      </Text>
                      <Text style={[styles.itemSub, { color: theme.subText }]}>
                        {t("passkeys.createdAt", { time: dayjs(passkey.created_at).format("DD/MM/YYYY") })}
                      </Text>
                      <Text style={[styles.itemSub, { color: theme.subText }]}>
                        {passkey.last_used_at
                          ? t("passkeys.lastUsed", { time: dayjs(passkey.last_used_at).format("HH:mm DD/MM/YYYY") })
                          : t("passkeys.neverUsed")}
                      </Text>
                    </View>
                    {removingId === passkey.id ? (
                      <ActivityIndicator color={theme.primary} size="small" />
                    ) : (
                      <TouchableOpacity onPress={() => remove(passkey)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.removeText}>{t("passkeys.remove")}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {asking && (
              <View style={[styles.card, styles.askCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.itemSub, { color: theme.subText, marginBottom: 8 }]}>
                  {t("passkeys.passwordHint")}
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("passkeys.passwordPlaceholder")}
                  placeholderTextColor={theme.subText}
                  secureTextEntry
                  autoFocus
                  autoCapitalize="none"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={add}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {supported && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.primary,
                    { backgroundColor: theme.primary },
                    (adding || (asking && !password)) && { opacity: 0.6 },
                  ]}
                  onPress={asking ? add : startAdd}
                  disabled={adding || (asking && !password)}
                  activeOpacity={0.85}
                >
                  {adding ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.primaryText}>
                      {asking ? t("passkeys.create") : t("passkeys.add")}
                    </Text>
                  )}
                </TouchableOpacity>
                {asking && !adding && (
                  <TouchableOpacity style={styles.secondary} onPress={closeAsk}>
                    <Text style={{ color: theme.subText, fontWeight: "600" }}>{t("security.cancel")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </Animated.ScrollView>
      </KeyboardAvoidingView>
      </AndroidGlassBackdrop>

      <AppToast topOffset={60} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSide: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 16,
  },
  askCard: {
    padding: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  itemSub: {
    fontSize: 12,
    marginTop: 2,
  },
  removeText: {
    color: "#FF3B30",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  input: {
    width: "100%",
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  error: {
    color: "#FF3B30",
    fontSize: 14,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  actions: {
    gap: 4,
  },
  primary: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  secondary: {
    padding: 12,
    alignItems: "center",
  },
});
