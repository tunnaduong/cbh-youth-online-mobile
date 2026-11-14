import React, { useState, useRef } from "react";
import FloatingScreenHeader from "../../../components/FloatingScreenHeader";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
  const { theme, isDarkMode } = useTheme();
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

  const headerHeight = 64 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FloatingScreenHeader
        title={t("chatConversation.addMembers", "Thêm thành viên")}
        onBack={() => navigation.goBack()}
        scrollY={scrollY}
        right={
          <TouchableOpacity onPress={handleAdd} disabled={!canSubmit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.addText, { color: canSubmit ? theme.primary : theme.placeholder }]}>
              {t("common.add", "Thêm")}
            </Text>
          )}
        </TouchableOpacity>
        }
      />

      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140, zIndex: 0 }}
        pointerEvents="none"
      />

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
