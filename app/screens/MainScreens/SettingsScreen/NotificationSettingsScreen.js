import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "../../../services/api/Api";

const SettingItem = ({
  icon,
  title,
  description,
  onPress,
  value,
  isSwitch,
  lastItem = false,
  disabled = false,
}) => (
  <View style={[styles.settingItem, lastItem && styles.lastSettingItem]}>
    <View style={styles.settingItemLeft}>
      {icon && (
        <View style={styles.settingItemIcon}>
          <Ionicons name={icon} size={22} color="#666" />
        </View>
      )}
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={[styles.settingItemText, disabled && { color: "#999" }]}>
          {title}
        </Text>
        {description && (
          <Text style={styles.settingItemDescription}>{description}</Text>
        )}
      </View>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        disabled={disabled}
        trackColor={{ true: "#319527" }}
      />
    ) : (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
    )}
  </View>
);

const SettingSection = ({ title, children }) => {
  const childrenArray = React.Children.toArray(children);

  return (
    <View style={styles.settingSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {childrenArray.map((child, index) =>
          React.cloneElement(child, {
            lastItem: index === childrenArray.length - 1,
            key: index,
          })
        )}
      </View>
    </View>
  );
};

export default function NotificationSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
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
        text1: "Lỗi",
        text2: "Không thể tải cài đặt thông báo",
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
        text1: "Lỗi",
        text2: "Không thể lưu cài đặt",
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
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#319527" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView>
        <SettingSection title="Thông báo đẩy">
          <SettingItem
            icon="notifications-outline"
            title="Cho phép thông báo"
            description="Nhận thông báo trên thiết bị này"
            isSwitch
            value={pushEnabled}
            onPress={(v) => handleToggle('pushEnabled', v)}
          />
        </SettingSection>

        {pushEnabled && (
          <>
            <SettingSection title="Tương tác">
              <SettingItem
                icon="heart-outline"
                title="Lượt thích"
                isSwitch
                value={likesEnabled}
                onPress={(v) => handleToggle('likesEnabled', v)}
              />
              <SettingItem
                icon="chatbubble-outline"
                title="Bình luận"
                isSwitch
                value={commentsEnabled}
                onPress={(v) => handleToggle('commentsEnabled', v)}
              />
              <SettingItem
                icon="at-outline"
                title="Nhắc đến"
                isSwitch
                value={mentionsEnabled}
                onPress={(v) => handleToggle('mentionsEnabled', v)}
                lastItem
              />
            </SettingSection>

            <SettingSection title="Kết nối">
              <SettingItem
                icon="person-add-outline"
                title="Người theo dõi mới"
                isSwitch
                value={followsEnabled}
                onPress={(v) => {
                  handleToggle('followsEnabled', v);
                  setMessagesEnabled(v); // Sync simply for UI, backend treats as one
                }}
              />
              <SettingItem
                icon="mail-outline"
                title="Tin nhắn"
                isSwitch
                value={messagesEnabled}
                onPress={(v) => {
                  handleToggle('messagesEnabled', v);
                  setFollowsEnabled(v); // Sync simply for UI
                }}
                lastItem
              />
            </SettingSection>
          </>
        )}

        <SettingSection title="Khác">
          <SettingItem
            icon="mail-open-outline"
            title="Email thông báo"
            description="Nhận cập nhật qua email"
            isSwitch
            value={emailEnabled}
            onPress={(v) => handleToggle('emailEnabled', v)}
          />
          <SettingItem
            icon="newspaper-outline"
            title="Tin tức & Cập nhật"
            isSwitch
            value={newsEnabled}
            onPress={(v) => handleToggle('newsEnabled', v)}
            lastItem
          />
        </SettingSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#319527",
  },
  settingSection: {
    marginBottom: 24,
    backgroundColor: "#FAFAFA",
    margin: 15,
    borderRadius: 15,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#319527",
    marginLeft: 16,
    marginBottom: 8,
  },
  sectionContent: {
    // backgroundColor: "#fff",
  },
  settingItemIcon: {
    backgroundColor: "#F1F1F1",
    padding: 7,
    borderRadius: 30,
    marginRight: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5E5",
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
    color: "#000",
  },
  settingItemDescription: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
});
