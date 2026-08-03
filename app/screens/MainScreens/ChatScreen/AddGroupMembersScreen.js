import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { addGroupParticipants } from "../../../services/api/Api";
import UserMultiSelectPicker from "../../../components/UserMultiSelectPicker";

const AddGroupMembersScreen = ({ navigation, route }) => {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const canSubmit = selected.length > 0 && !saving;

  const handleAdd = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await addGroupParticipants(conversationId, selected.map((u) => u.id));
      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: "error",
        text1:
          error?.response?.data?.message ||
          t("chatConversation.addMembersError", "Không thể thêm thành viên."),
      });
    } finally {
      setSaving(false);
    }
  };

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
        <Text style={[styles.headerTitle, { color: theme.primary }]}>
          {t("chatConversation.addMembers", "Thêm thành viên")}
        </Text>
        <TouchableOpacity onPress={handleAdd} disabled={!canSubmit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.addText, { color: canSubmit ? theme.primary : theme.placeholder }]}>
              {t("common.add", "Thêm")}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}>
        <UserMultiSelectPicker
          selected={selected}
          onChange={setSelected}
          excludeConversationId={conversationId}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  addText: { fontSize: 16, fontWeight: "600" },
});

export default AddGroupMembersScreen;
