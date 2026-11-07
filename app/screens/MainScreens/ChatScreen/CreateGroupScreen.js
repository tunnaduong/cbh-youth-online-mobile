import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { createGroupConversation } from "../../../services/api/Api";
import UserMultiSelectPicker from "../../../components/UserMultiSelectPicker";
import LiquidButton from "../../../components/LiquidButton";

const CreateGroupScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const handleScroll = (e) => {
    scrollY.setValue(Math.max(0, e.nativeEvent.contentOffset.y));
  };

  const canCreate = name.trim().length > 0 && selected.length > 0 && !creating;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const response = await createGroupConversation(
        name.trim(),
        selected.map((u) => u.id)
      );
      const newConversationId = response.data.id;
      navigation.pop();
      setTimeout(() => {
        navigation.navigate("ConversationScreen", { conversationId: newConversationId });
      }, 100);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("chatConversation.createGroupError", "Không thể tạo nhóm. Vui lòng thử lại."),
      });
    } finally {
      setCreating(false);
    }
  };

  const headerHeight = 58 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.ambientGlow, { height: insets.top + 140 }]}
        pointerEvents="none"
      />
      <View
        style={[styles.header, { paddingTop: insets.top, height: headerHeight, backgroundColor: "transparent" }]}
        pointerEvents="box-none"
      >
        <LiquidButton providerId="CreateGroupScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text
          style={[styles.headerTitle, { color: theme.primary, opacity: titleOpacity }]}
          numberOfLines={1}
        >
          {t("chatConversation.createGroup", "Tạo nhóm")}
        </Animated.Text>
        <LiquidButton
          size={44}
          scrollY={scrollY}
          providerId="CreateGroupScreen"
          style={{ width: "auto", minWidth: 60, paddingHorizontal: 12 }}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          {creating ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.createText, { color: canCreate ? theme.primary : theme.subText }]}>
              {t("chatConversation.create", "Tạo")}
            </Text>
          )}
        </LiquidButton>
      </View>

      <AndroidGlassBackdrop providerId="CreateGroupScreen" style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 64 + insets.top, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
      >
        <View style={[styles.nameBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.nameInput, { color: theme.text }]}
            placeholder={t("chatConversation.groupNamePlaceholder", "Tên nhóm...")}
            placeholderTextColor={theme.placeholder}
            value={name}
            onChangeText={setName}
            maxLength={255}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: theme.subText }]}>
          {t("chatConversation.addMembers", "Thêm thành viên")}
        </Text>

        <UserMultiSelectPicker selected={selected} onChange={setSelected} />
      </ScrollView>
      </AndroidGlassBackdrop>
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
  createText: { fontSize: 16, fontWeight: "600" },
  nameBox: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  ambientGlow: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0 },
  nameInput: { flex: 1, fontSize: 16 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginBottom: 8,
  },
});

export default CreateGroupScreen;
