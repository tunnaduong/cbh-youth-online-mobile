import React, { useState, useCallback, useContext, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../../contexts/AuthContext";
import { useChatSocket } from "../../../contexts/ChatSocketContext";
import {
  getGroupDetails,
  renameGroupConversation,
  removeGroupParticipant,
  leaveGroupConversation,
} from "../../../services/api/Api";

const avatarUrl = (u) =>
  u.avatar_url || `https://api.chuyenbienhoa.com/v1.0/users/${u.username}/avatar`;

const GroupInfoScreen = ({ navigation, route }) => {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { userInfo } = useContext(AuthContext);
  const { onMessageSent } = useChatSocket();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameVisible, setRenameVisible] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const fetchGroup = useCallback(async () => {
    try {
      const res = await getGroupDetails(conversationId);
      setGroup(res.data);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("chatConversation.loadGroupError", "Không thể tải thông tin nhóm."),
      });
    } finally {
      setLoading(false);
    }
  }, [conversationId, t]);

  useFocusEffect(
    useCallback(() => {
      fetchGroup();
    }, [fetchGroup])
  );

  // Refresh whenever a group-management system message (member added/removed/
  // renamed/ownership transferred) arrives in real time.
  useEffect(() => {
    return onMessageSent(conversationId, (e) => {
      if (e?.message?.type === "system") {
        fetchGroup();
      }
    });
  }, [conversationId, onMessageSent, fetchGroup]);

  const openRename = () => {
    setRenameValue(group?.name || "");
    setRenameVisible(true);
  };

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || savingName) return;
    setSavingName(true);
    try {
      await renameGroupConversation(conversationId, trimmed);
      setGroup((prev) => (prev ? { ...prev, name: trimmed } : prev));
      setRenameVisible(false);
    } catch (error) {
      Toast.show({
        type: "error",
        text1:
          error?.response?.data?.message ||
          t("chatConversation.renameGroupError", "Không thể đổi tên nhóm."),
      });
    } finally {
      setSavingName(false);
    }
  };

  const confirmRemoveParticipant = (participant) => {
    Alert.alert(
      t("chatConversation.removeMemberTitle", "Xóa thành viên?"),
      t("chatConversation.removeMemberBody", "{{name}} sẽ bị xóa khỏi nhóm.", {
        name: participant.profile_name || participant.username,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chatConversation.removeMemberAction", "Xóa"),
          style: "destructive",
          onPress: async () => {
            try {
              await removeGroupParticipant(conversationId, participant.id);
              setGroup((prev) =>
                prev
                  ? { ...prev, participants: prev.participants.filter((p) => p.id !== participant.id) }
                  : prev
              );
            } catch (error) {
              Toast.show({
                type: "error",
                text1:
                  error?.response?.data?.message ||
                  t("chatConversation.removeMemberError", "Không thể xóa thành viên."),
              });
            }
          },
        },
      ]
    );
  };

  const confirmLeaveGroup = () => {
    Alert.alert(
      t("chatConversation.leaveGroupTitle", "Rời nhóm?"),
      t("chatConversation.leaveGroupBody", "Bạn sẽ không nhận được tin nhắn từ nhóm này nữa."),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chatConversation.leaveGroupAction", "Rời nhóm"),
          style: "destructive",
          onPress: async () => {
            setLeaving(true);
            try {
              await leaveGroupConversation(conversationId);
              navigation.pop(2);
            } catch (error) {
              Toast.show({
                type: "error",
                text1:
                  error?.response?.data?.message ||
                  t("chatConversation.leaveGroupError", "Không thể rời nhóm."),
              });
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !group) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const isOwner = group.is_owner;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: 50 + insets.top, backgroundColor: theme.background, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {t("chatConversation.groupInfo", "Thông tin nhóm")}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={group.participants}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={styles.groupHeader}>
            <View style={[styles.groupAvatar, { backgroundColor: theme.iconBackground }]}>
              <Ionicons name="people" size={34} color={theme.subText} />
            </View>
            <TouchableOpacity
              style={styles.groupNameRow}
              onPress={isOwner ? openRename : undefined}
              activeOpacity={isOwner ? 0.6 : 1}
            >
              <Text style={[styles.groupName, { color: theme.text }]} numberOfLines={2}>
                {group.name}
              </Text>
              {isOwner && <Ionicons name="pencil-outline" size={16} color={theme.subText} style={{ marginLeft: 6 }} />}
            </TouchableOpacity>
            <Text style={[styles.membersCount, { color: theme.subText }]}>
              {t("chatConversation.membersCount", "{{count}} thành viên", { count: group.participants.length })}
            </Text>

            <TouchableOpacity
              style={[styles.addMembersRow, { borderColor: theme.border }]}
              onPress={() => navigation.navigate("AddGroupMembersScreen", { conversationId })}
            >
              <View style={[styles.addMembersIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="person-add-outline" size={16} color="#fff" />
              </View>
              <Text style={[styles.addMembersText, { color: theme.text }]}>
                {t("chatConversation.addMembers", "Thêm thành viên")}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { color: theme.subText }]}>
              {t("chatConversation.members", "Thành viên")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.participantRow}>
            <Image source={{ uri: avatarUrl(item) }} style={styles.participantAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.participantName, { color: theme.text }]} numberOfLines={1}>
                {item.profile_name || item.username}
              </Text>
              <Text style={[styles.participantHandle, { color: theme.subText }]} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
            {item.role === "owner" && (
              <View style={[styles.ownerBadge, { backgroundColor: theme.iconBackground }]}>
                <Text style={[styles.ownerBadgeText, { color: theme.primary }]}>
                  {t("chatConversation.owner", "Trưởng nhóm")}
                </Text>
              </View>
            )}
            {isOwner && item.role !== "owner" && item.id !== userInfo?.id && (
              <TouchableOpacity
                onPress={() => confirmRemoveParticipant(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ marginLeft: 8 }}
              >
                <Ionicons name="close-circle-outline" size={22} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.leaveRow}
            onPress={confirmLeaveGroup}
            disabled={leaving}
          >
            {leaving ? (
              <ActivityIndicator size="small" color="#e53935" />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color="#e53935" />
                <Text style={styles.leaveText}>{t("chatConversation.leaveGroupAction", "Rời nhóm")}</Text>
              </>
            )}
          </TouchableOpacity>
        }
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      />

      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {t("chatConversation.renameGroup", "Đổi tên nhóm")}
            </Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              value={renameValue}
              onChangeText={setRenameValue}
              maxLength={255}
              autoFocus
              placeholderTextColor={theme.placeholder}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setRenameVisible(false)}>
                <Text style={{ color: theme.subText, fontSize: 15 }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleRename} disabled={savingName}>
                {savingName ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Text style={{ color: theme.primary, fontSize: 15, fontWeight: "600" }}>
                    {t("common.save", "Lưu")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  groupHeader: { alignItems: "center", paddingTop: 24, paddingBottom: 8 },
  groupAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  groupNameRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  groupName: { fontSize: 19, fontWeight: "700", textAlign: "center" },
  membersCount: { fontSize: 13, marginTop: 4, marginBottom: 20 },
  addMembersRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  addMembersIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  addMembersText: { fontSize: 15, fontWeight: "500" },
  sectionLabel: {
    alignSelf: "stretch",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginBottom: 4,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  participantAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  participantName: { fontSize: 15, fontWeight: "600" },
  participantHandle: { fontSize: 12, marginTop: 1 },
  ownerBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ownerBadgeText: { fontSize: 11, fontWeight: "700" },
  leaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 12,
  },
  leaveText: { color: "#e53935", fontSize: 15, fontWeight: "600" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalBox: { width: "100%", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 16,
  },
  modalButton: { paddingVertical: 6, paddingHorizontal: 4 },
});

export default GroupInfoScreen;
