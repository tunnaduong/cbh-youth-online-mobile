import React, { useCallback, useEffect, useImperativeHandle, useState } from "react";
import { View, Text, TouchableOpacity, Keyboard, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useTheme } from "../../../../contexts/ThemeContext";
import CommentBar from "../../../../components/CommentBar";
import ReplyComposerBar from "../../../../components/ReplyComposerBar";
import MentionSuggestions, { useMentionInput } from "../../../../components/MentionSuggestions";
import SlashCommandSuggestions, { useSlashCommandInput } from "../../../../components/SlashCommandSuggestions";
import { trackAndroidKeyboardResize } from "../../../../utils/keyboardResize";
import ChatGlassBar from "./ChatGlassBar";

// Height of the bar before it has been measured (one line, no reply / edit
// strip, plus the bottom inset added on top).
export const CHAT_COMPOSER_DEFAULT_HEIGHT = 52;

// The message composer, docked to the bottom as one flat glass bar (edit
// banner, reply strip, then the input row), plus the mention / slash-command
// popups above it.
//
// The text lives here, not in ConversationScreen: typing used to set state in
// the screen, which re-ran its whole (3,000-line) body and every modal on each
// keystroke. Now a keystroke re-renders only this component. The screen reads
// the text through `latestMessageRef` (kept current on every change, as before)
// and changes it through the ref handle: setText / clear / restoreIfEmpty.
const ChatComposer = React.forwardRef(
  (
    {
      inputRef,
      latestMessageRef,
      actions,
      sending,
      pendingImageUris,
      editingMessage,
      replyingTo,
      currentUsername,
      showScrollButton,
      isGroup,
      fetchMentionSuggestions,
      bottomInset,
      onHeightChange,
    },
    ref
  ) => {
    const { theme, isDarkMode } = useTheme();
    const { t } = useTranslation();
    const [message, setMessage] = useState("");

    // Every change of the text goes through here, so latestMessageRef is
    // always what the input shows - including a tapped mention suggestion,
    // which changes the text without going through onChangeText.
    const setText = useCallback(
      (text) => {
        latestMessageRef.current = text;
        setMessage(text);
      },
      [latestMessageRef]
    );

    useImperativeHandle(
      ref,
      () => ({
        setText,
        clear: () => setText(""),
        // A failed send puts its text back, unless something new was typed
        // meanwhile.
        restoreIfEmpty: (text) => {
          if (latestMessageRef.current) return;
          latestMessageRef.current = text;
          setMessage((current) => current || text);
        },
      }),
      [setText, latestMessageRef]
    );

    const {
      mentionProps,
      suggestions: mentionSuggestions,
      onSelectMention,
      loading: mentionSuggestionsLoading,
    } = useMentionInput({
      value: message,
      onChange: setText,
      fetchSuggestions: fetchMentionSuggestions,
    });

    const {
      slashProps,
      suggestions: slashSuggestions,
      onSelectCommand,
    } = useSlashCommandInput({ value: message, onChange: setText });

    const handleChangeText = (text) => {
      latestMessageRef.current = text;
      mentionProps.onChangeText(text);
      slashProps.onChangeText(text);
      actions.typing();
    };

    // Where the popups sit: just above the bar, which rides on the keyboard.
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    useEffect(() => {
      const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
      const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
      const offResize = trackAndroidKeyboardResize(setKeyboardHeight);
      return () => {
        show.remove();
        hide.remove();
        offResize();
      };
    }, []);

    // The `opened` lift is intentionally 20px short of the keyboard's real
    // height - that gap is absorbed by the bar's bottom padding (the safe
    // area inset, ~34 on notched iPhones / Android gesture nav). On devices
    // with no bottom safe area (iPhone 6s/7/8/SE) nothing absorbs it, so the
    // offset drops to 0 there and the bar lifts exactly to the keyboard's edge.
    const openedOffset = Math.min(20, Math.max(0, bottomInset));

    const [barHeight, setBarHeight] = useState(CHAT_COMPOSER_DEFAULT_HEIGHT + bottomInset);
    const handleBarLayout = (e) => {
      const height = Math.round(e.nativeEvent.layout.height);
      setBarHeight(height);
      onHeightChange?.(height);
    };
    const popupBottom = (keyboardHeight ? keyboardHeight - openedOffset : 0) + barHeight;

    const hasText = message.trim().length > 0;

    return (
      <>
        <KeyboardStickyView style={styles.sticky} offset={{ opened: openedOffset }}>
          {showScrollButton && (
            <TouchableOpacity
              onPress={actions.scrollToLatest}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("chatConversation.scrollToLatest")}
              style={[
                styles.scrollButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowOpacity: isDarkMode ? 0.4 : 0.15,
                  // Android's elevation shadow ignores the radius in dark mode.
                  elevation: isDarkMode ? 0 : 5,
                },
              ]}
            >
              <Ionicons name="chevron-down" size={22} color={theme.text} />
            </TouchableOpacity>
          )}
          <View onLayout={handleBarLayout} style={styles.barContainer}>
            <ChatGlassBar edge="bottom" style={{ width: "100%", paddingBottom: bottomInset }}>
              {editingMessage && (
                <View style={[styles.editBanner, { backgroundColor: isDarkMode ? "#1a1a1a" : "#f0f0f0" }]}>
                  <Ionicons name="pencil-outline" size={16} color={theme.primary} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary }} numberOfLines={1}>
                      {t("chatConversation.editingMessage", "Đang chỉnh sửa tin nhắn")}
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.subText }} numberOfLines={1}>
                      {editingMessage.originalContent}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={actions.cancelEdit} hitSlop={10} style={{ marginLeft: 8, padding: 4 }}>
                    <Ionicons name="close" size={18} color={theme.subText} />
                  </TouchableOpacity>
                </View>
              )}
              <ReplyComposerBar
                replyingTo={editingMessage ? null : replyingTo}
                currentUsername={currentUsername}
                onCancel={actions.cancelReply}
              />
              <CommentBar
                ref={inputRef}
                variant="flat"
                placeholderText={t("chat.typeMessage")}
                onSubmit={actions.submit}
                onChangeText={handleChangeText}
                value={message}
                disabled={(!hasText && pendingImageUris.length === 0) || sending}
                isSubmitting={sending}
                onPasteImages={editingMessage ? undefined : actions.pasteImages}
                selectedImages={editingMessage ? undefined : pendingImageUris}
                onClearImage={editingMessage ? undefined : actions.removePendingImage}
                allowBroadcastMention={isGroup}
                enableAiCommands
                leftAccessory={
                  <View style={{ flexDirection: "row" }}>
                    <TouchableOpacity
                      style={styles.accessoryButton}
                      onPress={actions.pickImage}
                      disabled={sending}
                      accessibilityRole="button"
                      accessibilityLabel={t("chatConversation.attachMedia")}
                    >
                      <Ionicons name="image" size={22} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.accessoryButton}
                      onPress={actions.pickDocument}
                      disabled={sending}
                      accessibilityRole="button"
                      accessibilityLabel={t("chatConversation.attachment")}
                    >
                      <Ionicons name="attach" size={24} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                }
                nativeID="chat-input"
              />
            </ChatGlassBar>
          </View>
        </KeyboardStickyView>

        {(mentionSuggestions.length > 0 || mentionSuggestionsLoading) && (
          <View style={[styles.popup, { bottom: popupBottom }]} pointerEvents="box-none">
            <MentionSuggestions
              suggestions={mentionSuggestions}
              onSelect={onSelectMention}
              loading={mentionSuggestionsLoading}
            />
          </View>
        )}
        {slashSuggestions.length > 0 && (
          <View style={[styles.popup, { bottom: popupBottom }]} pointerEvents="box-none">
            <SlashCommandSuggestions suggestions={slashSuggestions} onSelect={onSelectCommand} />
          </View>
        )}
      </>
    );
  }
);

const styles = StyleSheet.create({
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    zIndex: 10,
  },
  barContainer: {
    width: "100%",
    alignSelf: "stretch",
  },
  scrollButton: {
    alignSelf: "center",
    marginBottom: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  accessoryButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  popup: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
  },
});

export default React.memo(ChatComposer);
