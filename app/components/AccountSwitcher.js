import React, { useCallback, useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import FastImage from "./FastImage";
import {
  MAX_SAVED_ACCOUNTS,
  getSavedAccounts,
  removeSavedAccount,
} from "../utils/savedAccounts";

const avatarUri = (username) =>
  `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`;

// Rows of saved accounts. Tap to switch, long-press to remove from the device.
// `excludeUserId` hides the currently active account.
export const SavedAccountList = ({ excludeUserId, onSwitched, showAdd = true, title, style }) => {
  const { switchAccount, addAccount } = useContext(AuthContext);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [switchingId, setSwitchingId] = useState(null);

  const load = useCallback(() => {
    getSavedAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    load();
  }, [load, excludeUserId]);

  const others = accounts.filter((a) => a.user.id !== excludeUserId);

  const onSwitch = async (account) => {
    if (switchingId) return;
    setSwitchingId(account.user.id);
    try {
      await switchAccount(account);
      onSwitched?.();
    } catch (e) {
      Toast.show({ type: "error", text1: t("sidebar.sessionExpired") });
      load();
    } finally {
      setSwitchingId(null);
    }
  };

  const onRemove = (account) => {
    Alert.alert(
      t("sidebar.removeAccount"),
      t("sidebar.removeAccountConfirm", { username: account.user.username }),
      [
        { text: t("settings.cancel"), style: "cancel" },
        {
          text: t("sidebar.removeAccount"),
          style: "destructive",
          onPress: () => removeSavedAccount(account.user.id).then(setAccounts),
        },
      ]
    );
  };

  const rowStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  };

  if (!showAdd && others.length === 0) return null;

  return (
    <View style={style}>
      {!!title && (
        <Text style={{ color: theme.subText, fontSize: 13, paddingHorizontal: 16, paddingBottom: 4 }}>
          {title}
        </Text>
      )}
      {others.map((account) => (
        <TouchableOpacity
          key={account.user.id}
          style={rowStyle}
          onPress={() => onSwitch(account)}
          onLongPress={() => onRemove(account)}
          disabled={!!switchingId}
        >
          <FastImage
            source={{ uri: avatarUri(account.user.username) }}
            style={{ width: 36, height: 36, borderRadius: 18 }}
          />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: theme.text, fontWeight: "600" }}>
              {account.user.profile_name || account.user.username}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.subText, fontSize: 13 }}>
              @{account.user.username}
            </Text>
          </View>
          {switchingId === account.user.id && <ActivityIndicator size="small" />}
        </TouchableOpacity>
      ))}
      {showAdd && accounts.length < MAX_SAVED_ACCOUNTS && (
        <TouchableOpacity style={rowStyle} onPress={addAccount} disabled={!!switchingId}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: theme.subText,
              borderStyle: "dashed",
            }}
          >
            <Ionicons name="add" size={20} color={theme.text} />
          </View>
          <Text style={{ color: theme.text, fontWeight: "500" }}>
            {t("sidebar.addAccount")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Collapsible "Switch account" block shown under the profile header in the sidebar.
const AccountSwitcher = () => {
  const { userInfo } = useContext(AuthContext);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <Ionicons name="swap-horizontal-outline" size={20} color={theme.primary} />
        <Text style={{ flex: 1, color: theme.primary, fontWeight: "bold" }}>
          {t("sidebar.switchAccount")}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.subText}
        />
      </TouchableOpacity>
      {open && <SavedAccountList excludeUserId={userInfo?.id} />}
    </View>
  );
};

export default AccountSwitcher;
