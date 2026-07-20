import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "../../../services/api/Api";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";

const SettingItem = ({
  icon,
  title,
  description,
  onPress,
  value,
  isSwitch,
  lastItem = false,
  disabled = false,
  theme,
}) => (
  <View style={[styles.settingItem, lastItem && styles.lastSettingItem, { borderBottomColor: theme.border }]}>
    <View style={styles.settingItemLeft}>
      {icon && (
        <View style={[styles.settingItemIcon, { backgroundColor: theme.iconBackground }]}>
          <Ionicons name={icon} size={20} color={theme.primary} />
        </View>
      )}
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={[styles.settingItemText, { color: theme.text }, disabled && { color: theme.subText }]}>
          {title}
        </Text>
        {description && (
          <Text style={[styles.settingItemDescription, { color: theme.subText }]}>{description}</Text>
        )}
      </View>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        disabled={disabled}
        trackColor={{ true: theme.primary }}
      />
    ) : (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        <Ionicons name="chevron-forward" size={18} color={theme.subText} />
      </TouchableOpacity>
    )}
  </View>
);

const SettingSection = ({ title, children, theme }) => {
  const childrenArray = React.Children.toArray(children);

  return (
    <View style={styles.sectionWrapper}>
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
      <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {childrenArray.map((child, index) =>
          React.cloneElement(child, {
            lastItem: index === childrenArray.length - 1,
            key: index,
            theme,
          })
        )}
      </View>
    </View>
  );
};

export default function NotificationSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State for toggles
  const [pushEnabled, setPushEnabled] = useState(true);
  const [likesEnabled, setLikesEnabled] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [mentionsEnabled, setMentionsEnabled] = useState(true);

  // These are handled by email_social in the backend currently
  // We'll map them together for now
  const [followsEnabled, setFollowsEnabled] = useState(true);
  const [messagesEnabled, setMessagesEnabled] = useState(true);

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [newsEnabled, setNewsEnabled] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 10, 60],
    outputRange: [0, 0, 0],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await getNotificationSettings();
      const settings = response.data || response;

      // Map backend settings to UI state
      const level = settings.notification_level || 'all';

      setPushEnabled(level !== 'none');
      setMentionsEnabled(level === 'mentions' || level === 'all');
      setLikesEnabled(level === 'all');
      setCommentsEnabled(level === 'all');

      setEmailEnabled(!!settings.email_contact);
      setNewsEnabled(!!settings.email_marketing);
      setFollowsEnabled(!!settings.email_social);
      setMessagesEnabled(!!settings.email_social); // Sharing the same backend setting for now

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch notification settings:", error);
      Toast.show({
        type: "error",
        text1: t('security.errorTitle'),
        text2: t('notificationSettings.loadingError'),
      });
      setLoading(false);
    }
  };

  const saveSettings = async (updates) => {
    // Determine notification_level based on the updates or current state
    const isPushEnabled = updates.hasOwnProperty('pushEnabled') ? updates.pushEnabled : pushEnabled;
    const isLikesEnabled = updates.hasOwnProperty('likesEnabled') ? updates.likesEnabled : likesEnabled;
    const isCommentsEnabled = updates.hasOwnProperty('commentsEnabled') ? updates.commentsEnabled : commentsEnabled;
    const isMentionsEnabled = updates.hasOwnProperty('mentionsEnabled') ? updates.mentionsEnabled : mentionsEnabled;

    let notification_level = 'none';
    if (isPushEnabled) {
      if (isLikesEnabled || isCommentsEnabled) {
        notification_level = 'all';
      } else if (isMentionsEnabled) {
        notification_level = 'mentions';
      } else {
        // Fallback: if push is enabled but everything else is off, maybe just 'mentions' as minimal?
        // Or strictly 'none' if user turned off all sub-toggles?
        // Let's assume 'mentions' is the minimum meaningful 'on' state besides 'all'
        notification_level = 'mentions';
      }
    }

    const payload = {
      notification_level,
      email_contact: updates.hasOwnProperty('emailEnabled') ? updates.emailEnabled : emailEnabled,
      email_marketing: updates.hasOwnProperty('newsEnabled') ? updates.newsEnabled : newsEnabled,
      email_social: updates.hasOwnProperty('followsEnabled') ? updates.followsEnabled : followsEnabled,
    };

    // Handle shared logic for social
    if (updates.hasOwnProperty('messagesEnabled')) {
      payload.email_social = updates.messagesEnabled;
    }

    try {
      // Optimistic update
      if (updates.hasOwnProperty('pushEnabled')) setPushEnabled(updates.pushEnabled);
      if (updates.hasOwnProperty('likesEnabled')) setLikesEnabled(updates.likesEnabled);
      if (updates.hasOwnProperty('commentsEnabled')) setCommentsEnabled(updates.commentsEnabled);
      if (updates.hasOwnProperty('mentionsEnabled')) setMentionsEnabled(updates.mentionsEnabled);
      if (updates.hasOwnProperty('emailEnabled')) setEmailEnabled(updates.emailEnabled);
      if (updates.hasOwnProperty('newsEnabled')) setNewsEnabled(updates.newsEnabled);
      if (updates.hasOwnProperty('followsEnabled')) setFollowsEnabled(updates.followsEnabled);
      if (updates.hasOwnProperty('messagesEnabled')) setMessagesEnabled(updates.messagesEnabled);

      // Also sync linked states if necessary (e.g. if likes enabled -> mentions should probably be visible/enabled, but here we just send to backend)
      // If we turn OFF mentions, but Likes are ON, backend force 'all' which includes mentions.
      // So front-end state should reflect that eventually.

      await updateNotificationSettings(payload);

    } catch (error) {
      console.error("Failed to update notification settings:", error);
      Toast.show({
        type: "error",
        text1: t('security.errorTitle'),
        text2: t('notificationSettings.saveError'),
      });
      // Revert could be implemented here
      fetchSettings();
    }
  };

  const handleToggle = (key, value) => {
    saveSettings({ [key]: value });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* Floating header */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: theme.background,
            opacity: headerBgOpacity,
          }}
        />
        <View style={{ paddingTop: insets.top, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56 + insets.top }}>
          <View style={{ width: 44 }}>
            <LiquidButton size={44} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, {
              color: theme.primary,
              flex: 1,
              textAlign: 'center',
              opacity: headerTitleOpacity,
            }]}
            numberOfLines={1}
          >
            {t('notificationSettings.title')}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        contentContainerStyle={{ paddingTop: 56 + insets.top, paddingBottom: insets.bottom + 16 }}
      >
        <SettingSection title={t('notificationSettings.pushNotifications')} theme={theme}>
          <SettingItem
            icon="notifications-outline"
            title={t('notificationSettings.allowPush')}
            description={t('notificationSettings.allowPushDesc')}
            isSwitch
            value={pushEnabled}
            onPress={(v) => handleToggle('pushEnabled', v)}
            theme={theme}
          />
        </SettingSection>

        {pushEnabled && (
          <>
            <SettingSection title={t('notificationSettings.interactions')} theme={theme}>
              <SettingItem
                icon="heart-outline"
                title={t('notificationSettings.likes')}
                isSwitch
                value={likesEnabled}
                onPress={(v) => handleToggle('likesEnabled', v)}
                theme={theme}
              />
              <SettingItem
                icon="chatbubble-outline"
                title={t('notificationSettings.comments')}
                isSwitch
                value={commentsEnabled}
                onPress={(v) => handleToggle('commentsEnabled', v)}
                theme={theme}
              />
              <SettingItem
                icon="at-outline"
                title={t('notificationSettings.mentions')}
                isSwitch
                value={mentionsEnabled}
                onPress={(v) => handleToggle('mentionsEnabled', v)}
                lastItem
                theme={theme}
              />
            </SettingSection>

            <SettingSection title={t('notificationSettings.connections')} theme={theme}>
              <SettingItem
                icon="person-add-outline"
                title={t('notificationSettings.newFollowers')}
                isSwitch
                value={followsEnabled}
                onPress={(v) => {
                  handleToggle('followsEnabled', v);
                  setMessagesEnabled(v); // Sync simply for UI, backend treats as one
                }}
                theme={theme}
              />
              <SettingItem
                icon="mail-outline"
                title={t('notificationSettings.messages')}
                isSwitch
                value={messagesEnabled}
                onPress={(v) => {
                  handleToggle('messagesEnabled', v);
                  setFollowsEnabled(v); // Sync simply for UI
                }}
                lastItem
                theme={theme}
              />
            </SettingSection>
          </>
        )}

        <SettingSection title={t('notificationSettings.other')} theme={theme}>
          <SettingItem
            icon="mail-open-outline"
            title={t('notificationSettings.emailNotifications')}
            description={t('notificationSettings.emailNotificationsDesc')}
            isSwitch
            value={emailEnabled}
            onPress={(v) => handleToggle('emailEnabled', v)}
            theme={theme}
          />
          <SettingItem
            icon="newspaper-outline"
            title={t('notificationSettings.newsUpdates')}
            isSwitch
            value={newsEnabled}
            onPress={(v) => handleToggle('newsEnabled', v)}
            lastItem
            theme={theme}
          />
        </SettingSection>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  settingSection: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  settingItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingItemText: {
    fontSize: 16,
    marginLeft: 12,
    flexShrink: 1,
  },
  settingItemDescription: {
    fontSize: 12,
    marginTop: 2,
    marginLeft: 12,
  },
});
