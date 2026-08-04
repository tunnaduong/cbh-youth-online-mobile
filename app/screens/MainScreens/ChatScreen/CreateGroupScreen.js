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

  const headerHeight = 50 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top, height: headerHeight, backgroundColor: "transparent" }]}
        pointerEvents="box-none"
      >
        <LiquidButton providerId="CreateGroupScreen" size={36} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
        </LiquidButton>
        <Animated.Text
          style={[styles.headerTitle, { color: theme.text, opacity: titleOpacity }]}
          numberOfLines={1}
        >
          {t("chatConversation.createGroup", "Tạo nhóm")}
        </Animated.Text>
        <TouchableOpacity onPress={handleCreate} disabled={!canCreate} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {creating ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[styles.createText, { color: canCreate ? theme.primary : theme.placeholder }]}>
              {t("chatConversation.create", "Tạo")}
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
  nameBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
  },
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
