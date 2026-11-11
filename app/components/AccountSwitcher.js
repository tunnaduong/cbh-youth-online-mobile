import React, { useCallback, useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import FastImage from "./FastImage";
import UserNameRow from "./profile/UserNameRow";
import StyledUsername from "./profile/StyledUsername";
import { AvatarFrameWrap } from "./profile/AvatarFrame";
import { useOwnProfileTheme } from "../utils/ownProfileTheme";
import {
  MAX_SAVED_ACCOUNTS,
  getSavedAccounts,
  removeSavedAccount,
} from "../utils/savedAccounts";

const avatarUri = (username) =>
  `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`;

// Rows of saved accounts. Tap to switch, long-press to remove from the device.
// `excludeUserId` hides the currently active account unless `showCurrent` is true.
export const SavedAccountList = ({
  excludeUserId,
  showCurrent = false,
  onSwitched,
  onClose,
  showAdd = true,
  title,
  style,
}) => {
  const { switchAccount, addAccount, userInfo, username, profileName } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const ownTheme = useOwnProfileTheme(username, showCurrent);
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

  const handleAddAccount = () => {
    onClose?.();
    addAccount?.();
  };

  const canAddMore = showAdd && accounts.length < MAX_SAVED_ACCOUNTS;
  const hasCurrentRow = showCurrent && !!username;

  if (!canAddMore && others.length === 0 && !hasCurrentRow) return null;

  const dividerColor = isDarkMode ? "rgba(255, 255, 255, 0.07)" : "rgba(15, 23, 42, 0.06)";
  const avatarBorderColor = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";

  return (
    <View style={style}>
      {!!title && (
        <Text
          style={{
            color: theme.subText,
            fontSize: 13,
            fontWeight: "600",
            paddingHorizontal: 16,
            paddingBottom: 6,
          }}
        >
          {title}
        </Text>
      )}

      {/* Active account row (Instagram / Threads style) */}
      {hasCurrentRow && (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onClose?.()}
          style={[
            styles.accountRow,
            (others.length > 0 || canAddMore) && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: dividerColor,
            },
          ]}
        >
          <AvatarFrameWrap theme={ownTheme} size={46}>
            <View
              style={[
                styles.avatarWrap,
                {
                  borderColor: theme.primary,
                  borderWidth: 1.5,
                  backgroundColor: theme.iconBackground,
                },
              ]}
            >
              <FastImage
                source={{ uri: avatarUri(username) }}
                style={styles.avatarImage}
              />
            </View>
          </AvatarFrameWrap>
          <View style={styles.accountInfo}>
            <UserNameRow
              name={profileName || userInfo?.profile_name || username}
              theme={ownTheme}
              variant="compact"
              style={{ fontSize: 15.5, fontWeight: "700", color: theme.text }}
            />
            <StyledUsername
              theme={ownTheme}
              username={username}
              variant="compact"
              style={{ color: theme.subText, fontSize: 13, marginTop: 1 }}
              numberOfLines={1}
            />
          </View>
          <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
        </TouchableOpacity>
      )}

      {/* Other saved accounts */}
      {others.map((account, idx) => {
        const isLast = idx === others.length - 1 && !canAddMore;
        const isSwitching = switchingId === account.user.id;
        const accTheme = account.user.profile_theme;
        return (
          <TouchableOpacity
            key={account.user.id}
            style={[
              styles.accountRow,
              !isLast && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: dividerColor,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => onSwitch(account)}
            onLongPress={() => onRemove(account)}
            disabled={!!switchingId}
          >
            <AvatarFrameWrap theme={accTheme} size={46}>
              <View
                style={[
                  styles.avatarWrap,
                  {
                    borderColor: avatarBorderColor,
                    borderWidth: 1,
                    backgroundColor: theme.iconBackground,
                  },
                ]}
              >
                <FastImage
                  source={{ uri: avatarUri(account.user.username) }}
                  style={styles.avatarImage}
                />
              </View>
            </AvatarFrameWrap>
            <View style={styles.accountInfo}>
              <UserNameRow
                name={account.user.profile_name || account.user.username}
                theme={accTheme}
                variant="compact"
                style={{ fontSize: 15.5, fontWeight: "600", color: theme.text }}
              />
              <StyledUsername
                theme={accTheme}
                username={account.user.username}
                variant="compact"
                style={{ color: theme.subText, fontSize: 13, marginTop: 1 }}
                numberOfLines={1}
              />
            </View>
            {isSwitching ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons
                name="ellipse-outline"
                size={22}
                color={isDarkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}
              />
            )}
          </TouchableOpacity>
        );
      })}

      {/* Add account row */}
      {canAddMore && (
        <TouchableOpacity
          style={styles.accountRow}
          activeOpacity={0.7}
          onPress={handleAddAccount}
          disabled={!!switchingId}
        >
          <View
            style={[
              styles.addIconCircle,
              {
                backgroundColor: isDarkMode
                  ? "rgba(74, 222, 128, 0.14)"
                  : "rgba(49, 149, 39, 0.10)",
              },
            ]}
          >
            <Ionicons name="add" size={24} color={theme.primary} />
          </View>
          <Text
            style={{
              flex: 1,
              color: theme.text,
              fontSize: 15.5,
              fontWeight: "600",
            }}
          >
            {t("sidebar.addAccount")}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Collapsible "Switch account" block shown under the profile header in the sidebar.
const AccountSwitcher = () => {
  const { userInfo } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 13,
          borderBottomWidth: open ? StyleSheet.hairlineWidth : 0,
          borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9",
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: theme.iconBackground,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="swap-horizontal-outline" size={20} color={theme.primary} />
        </View>
        <Text style={{ flex: 1, marginLeft: 12, color: theme.text, fontSize: 16, fontWeight: "500" }}>
          {t("sidebar.switchAccount")}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-forward"}
          size={18}
          color={theme.subText}
        />
      </TouchableOpacity>
      {open && <SavedAccountList excludeUserId={userInfo?.id} />}
    </View>
  );
};

const styles = StyleSheet.create({
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  accountInfo: {
    flex: 1,
    minWidth: 0,
  },
  addIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AccountSwitcher;
