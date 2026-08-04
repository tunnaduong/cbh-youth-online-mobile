import React, { useState, useCallback, useContext, useEffect, useRef } from "react";
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
  Share,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../../contexts/AuthContext";
import { useChatSocket } from "../../../contexts/ChatSocketContext";
import LiquidButton from "../../../components/LiquidButton";
import {
  getGroupDetails,
  renameGroupConversation,
  updateGroupAvatar,
  removeGroupParticipant,
  leaveGroupConversation,
  deleteGroupConversation,
  addGroupDeputy,
  removeGroupDeputy,
  transferGroupOwnership,
  getGroupInviteLink,
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
  const [renameValue, setRenameValue] = useState("");
  const [renameVisible, setRenameVisible] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [invitingLoading, setInvitingLoading] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const handleScroll = (e) => {
    scrollY.setValue(Math.max(0, e.nativeEvent.contentOffset.y));
  };

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

  const handleChangeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;

    setUploadingAvatar(true);
    try {
      const res = await updateGroupAvatar(conversationId, result.assets[0].uri);
      setGroup((prev) => (prev ? { ...prev, avatar_url: res.data.avatar_url } : prev));
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("chatConversation.updateAvatarError", "Không thể đổi ảnh đại diện nhóm."),
      });
    } finally {
      setUploadingAvatar(false);
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

  const handleMakeDeputy = async (participant) => {
    try {
      await addGroupDeputy(conversationId, participant.id);
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === participant.id ? { ...p, role: "deputy" } : p
              ),
            }
          : prev
      );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: error?.response?.data?.message || t("chatConversation.makeDeputyError", "Không thể chỉ định phó nhóm."),
      });
    }
  };

  const handleRemoveDeputy = async (participant) => {
    try {
      await removeGroupDeputy(conversationId, participant.id);
      setGroup((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === participant.id ? { ...p, role: "member" } : p
              ),
            }
          : prev
      );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: error?.response?.data?.message || t("chatConversation.removeDeputyError", "Không thể gỡ vai trò phó nhóm."),
      });
    }
  };

  const confirmTransferOwnership = (participant) => {
    Alert.alert(
      t("chatConversation.transferOwnershipTitle", "Chuyển quyền trưởng nhóm?"),
      t("chatConversation.transferOwnershipBody", "{{name}} sẽ trở thành trưởng nhóm mới thay bạn.", {
        name: participant.profile_name || participant.username,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chatConversation.transferOwnershipAction", "Chuyển quyền"),
          onPress: async () => {
            try {
              await transferGroupOwnership(conversationId, participant.id);
              fetchGroup();
            } catch (error) {
              Toast.show({
                type: "error",
                text1:
                  error?.response?.data?.message ||
                  t("chatConversation.transferOwnershipError", "Không thể chuyển quyền trưởng nhóm."),
              });
            }
          },
        },
      ]
    );
  };

  const openParticipantActions = (participant) => {
    if (participant.id === userInfo?.id || participant.role === "owner") return;

    const options = [];

    if (group.is_owner) {
      if (participant.role === "deputy") {
        options.push({
          text: t("chatConversation.removeDeputyAction", "Gỡ vai trò phó nhóm"),
          onPress: () => handleRemoveDeputy(participant),
        });
      } else {
        options.push({
          text: t("chatConversation.makeDeputyAction", "Chỉ định làm phó nhóm"),
          onPress: () => handleMakeDeputy(participant),
        });
      }
      options.push({
        text: t("chatConversation.transferOwnershipAction", "Chuyển quyền trưởng nhóm"),
        onPress: () => confirmTransferOwnership(participant),
      });
    }

    if (group.is_owner || (group.is_deputy && participant.role === "member")) {
      options.push({
        text: t("chatConversation.removeMemberAction", "Xóa"),
        style: "destructive",
        onPress: () => confirmRemoveParticipant(participant),
      });
    }

    if (options.length === 0) return;

    options.push({ text: t("common.cancel"), style: "cancel" });

    Alert.alert(participant.profile_name || participant.username, null, options);
  };

  const handleInvite = async () => {
    if (invitingLoading) return;
    setInvitingLoading(true);
    try {
      const res = await getGroupInviteLink(conversationId);
      await Share.share({ message: res.data.invite_url });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("chatConversation.inviteLinkError", "Không thể tạo liên kết mời."),
      });
    } finally {
      setInvitingLoading(false);
    }
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

  const confirmDeleteGroup = () => {
    Alert.alert(
      t("chatConversation.deleteGroupTitle", "Xóa nhóm?"),
      t("chatConversation.deleteGroupBody", "Nhóm và toàn bộ tin nhắn sẽ bị xóa vĩnh viễn đối với tất cả mọi người."),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chatConversation.deleteGroupAction", "Xóa nhóm"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteGroupConversation(conversationId);
              navigation.pop(2);
            } catch (error) {
              Toast.show({
                type: "error",
                text1:
                  error?.response?.data?.message ||
                  t("chatConversation.deleteGroupError", "Không thể xóa nhóm."),
              });
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading || !group) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: theme.background }]}>
        <View
          style={[styles.header, { paddingTop: insets.top, height: 58 + insets.top, backgroundColor: "transparent" }]}
          pointerEvents="box-none"
        >
          <LiquidButton providerId="GroupInfoScreen" size={44} scrollY={scrollY} alwaysBorder onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={theme.primary} />
          </LiquidButton>
        </View>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const headerHeight = 58 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top, height: headerHeight, backgroundColor: "transparent" }]}
        pointerEvents="box-none"
      >
        <LiquidButton
          providerId="GroupInfoScreen"
          size={44}
          scrollY={scrollY}
          alwaysBorder
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
        </LiquidButton>
        <Animated.Text
          style={[styles.headerTitle, { color: theme.text, opacity: titleOpacity }]}
          numberOfLines={1}
        >
          {t("chatConversation.groupInfo", "Thông tin nhóm")}
        </Animated.Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={group.participants}
        keyExtractor={(item) => String(item.id)}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.groupHeader}>
            <TouchableOpacity onPress={handleChangeAvatar} disabled={uploadingAvatar}>
              {group.avatar_url ? (
                <Image source={{ uri: group.avatar_url }} style={styles.groupAvatarImage} />
              ) : (
                <View style={[styles.groupAvatar, { backgroundColor: theme.iconBackground }]}>
                  <Ionicons name="people" size={34} color={theme.subText} />
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={14} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.groupNameRow} onPress={openRename} activeOpacity={0.6}>
              <Text style={[styles.groupName, { color: theme.text }]} numberOfLines={2}>
                {group.name}
              </Text>
              <Ionicons name="pencil-outline" size={16} color={theme.subText} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
            <Text style={[styles.membersCount, { color: theme.subText }]}>
              {t("chatConversation.membersCount", "{{count}} thành viên", { count: group.participants.length })}
            </Text>

            <TouchableOpacity
              style={[styles.actionRow, { borderColor: theme.border }]}
              onPress={() => navigation.navigate("AddGroupMembersScreen", { conversationId })}
            >
              <View style={[styles.actionIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="person-add-outline" size={16} color="#fff" />
              </View>
              <Text style={[styles.actionText, { color: theme.text }]}>
                {t("chatConversation.addMembers", "Thêm thành viên")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionRow, { borderColor: theme.border }]}
              onPress={handleInvite}
              disabled={invitingLoading}
            >
              <View style={[styles.actionIcon, { backgroundColor: theme.primary }]}>
                {invitingLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="link-outline" size={16} color="#fff" />
                )}
              </View>
              <Text style={[styles.actionText, { color: theme.text }]}>
                {t("chatConversation.inviteViaLink", "Mời qua liên kết")}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { color: theme.subText }]}>
              {t("chatConversation.members", "Thành viên")}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const canAct =
            item.id !== userInfo?.id &&
            item.role !== "owner" &&
            (group.is_owner || (group.is_deputy && item.role === "member"));
          return (
            <TouchableOpacity
              style={styles.participantRow}
              activeOpacity={canAct ? 0.6 : 1}
              onPress={canAct ? () => openParticipantActions(item) : undefined}
            >
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
                <View style={[styles.roleBadge, { backgroundColor: theme.iconBackground }]}>
                  <Text style={[styles.roleBadgeText, { color: theme.primary }]}>
                    {t("chatConversation.owner", "Trưởng nhóm")}
                  </Text>
                </View>
              )}
              {item.role === "deputy" && (
                <View style={[styles.roleBadge, { backgroundColor: theme.iconBackground }]}>
                  <Text style={[styles.roleBadgeText, { color: theme.subText }]}>
                    {t("chatConversation.deputy", "Phó nhóm")}
                  </Text>
                </View>
              )}
              {canAct && (
                <Ionicons name="chevron-forward" size={18} color={theme.subText} style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <View>
            <TouchableOpacity style={styles.leaveRow} onPress={confirmLeaveGroup} disabled={leaving}>
              {leaving ? (
                <ActivityIndicator size="small" color="#e53935" />
              ) : (
                <>
                  <Ionicons name="exit-outline" size={20} color="#e53935" />
                  <Text style={styles.leaveText}>{t("chatConversation.leaveGroupAction", "Rời nhóm")}</Text>
                </>
              )}
            </TouchableOpacity>
            {group.is_owner && (
              <TouchableOpacity style={styles.leaveRow} onPress={confirmDeleteGroup} disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator size="small" color="#e53935" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color="#e53935" />
                    <Text style={styles.leaveText}>{t("chatConversation.deleteGroupAction", "Xóa nhóm")}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={{ paddingTop: headerHeight + 8, paddingBottom: 40 + insets.bottom }}
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
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
  groupAvatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 12,
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  groupNameRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24 },
  groupName: { fontSize: 19, fontWeight: "700", textAlign: "center" },
  membersCount: { fontSize: 13, marginTop: 4, marginBottom: 20 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionText: { fontSize: 15, fontWeight: "500" },
  sectionLabel: {
    alignSelf: "stretch",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginTop: 8,
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
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 6 },
  roleBadgeText: { fontSize: 11, fontWeight: "700" },
  leaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
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
