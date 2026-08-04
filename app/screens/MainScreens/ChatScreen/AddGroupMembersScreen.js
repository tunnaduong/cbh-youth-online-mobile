import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { addGroupParticipants } from "../../../services/api/Api";
import UserMultiSelectPicker from "../../../components/UserMultiSelectPicker";
import LiquidButton from "../../../components/LiquidButton";

const AddGroupMembersScreen = ({ navigation, route }) => {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const handleScroll = (e) => {
    scrollY.setValue(Math.max(0, e.nativeEvent.contentOffset.y));
  };

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

  const headerHeight = 58 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top, height: headerHeight, backgroundColor: "transparent" }]}
        pointerEvents="box-none"
      >
        <LiquidButton providerId="AddGroupMembersScreen" size={44} scrollY={scrollY} alwaysBorder onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
        </LiquidButton>
        <Animated.Text
          style={[styles.headerTitle, { color: theme.text, opacity: titleOpacity }]}
          numberOfLines={1}
        >
          {t("chatConversation.addMembers", "Thêm thành viên")}
        </Animated.Text>
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

      <ScrollView
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight + 8, paddingBottom: 24 }}
      >
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
  addText: { fontSize: 16, fontWeight: "600" },
});

export default AddGroupMembersScreen;
