import React, { useRef } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import HomeStyleHeader from "../HomeStyleHeader";
import { tint } from "../settings/SettingsUI";
import { AndroidGlassBackdrop } from "../GlassModules";
import CustomLoading from "../CustomLoading";
import Dropdown from "../Dropdown";
import FastImage from "../FastImage";
import VideoThumbnail from "../VideoThumbnail";
import { getSubforumIcon, getSectionIcon } from "../../utils/forumUtils";
import { TOOLBAR_HEIGHT } from "./MarkdownToolbar";
import {
  PostEditorField,
  PostEditorMentions,
  PostEditorTabs,
  PostEditorToolbar,
} from "./PostEditorParts";

// Everything the create-post and edit-post screens show, so the two can't
// drift apart: the app's floating header (close button + title that fades on
// scroll + the publish/save action), the editor card, the post settings card,
// the attachments card and the primary button. Presentation only - the
// screens keep their own state, pickers and submit logic and pass them in.

// Height of the floating header below the status bar (same as the other
// native screens).
const HEADER_HEIGHT = 64;
// Card padding + screen padding on each side, for the HTML preview's width.
const PREVIEW_PADDING = 32;
const MEDIA_TILE = 104;

// A row of the settings card: round icon, label (+ hint), control on the right.
function SettingRow({ icon, color = "#3B82F6", title, hint, last, wide, dimmed, theme, isDarkMode, children }) {
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDarkMode ? "#282B34" : "#F1F5F9" },
        dimmed && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint(color, isDarkMode) }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={wide ? styles.rowTextWide : styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={wide ? 2 : 1}>
          {title}
        </Text>
        {hint ? <Text style={[styles.rowHint, { color: theme.subText }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// Section title with a tinted round icon.
function SectionTitle({ icon, color, theme, isDarkMode, children }) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionIcon, { backgroundColor: tint(color, isDarkMode) }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.sectionTitle, { color: theme.subText }]}>{children}</Text>
    </View>
  );
}

export default function PostComposerLayout({
  editor,
  // Header
  headerTitle,
  onClose,
  submitLabel,
  onSubmit,
  submitDisabled = false,
  // Shows the app's loader in place of the form (edit: the post is loading).
  loading = false,
  // { text, actionLabel, onAction, onDismiss } - e.g. "your draft was restored"
  banner,
  // Title + body
  title,
  onChangeTitle,
  titlePlaceholder,
  contentPlaceholder,
  onMarkdownHelp,
  onRulesHelp,
  // Settings
  categoryOptions,
  category,
  onChangeCategory,
  privacyOptions,
  privacy,
  onChangePrivacy,
  anonymous,
  // Leave out to show the switch locked (a post can't change it once made).
  onToggleAnonymous,
  // Attachments: images are [{ uri }], videos [{ uri }], documents [{ name }]
  images = [],
  videos = [],
  documents = [],
  onPickMedia,
  onPickImage,
  onPickVideo,
  onPickDocument,
  onRemoveImage,
  onRemoveVideo,
  onRemoveDocument,
}) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Both screens using this layout are opened with `presentation: "modal"`.
  // On iOS that is a sheet which already starts below the status bar, while
  // the safe-area inset still reports the notch - adding it left an empty
  // band above the header. Android shows the modal full screen, so there the
  // inset is real.
  const topInset = Platform.OS === "ios" ? 0 : insets.top;
  const cardStyle = [styles.card, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }];
  const hasMedia = images.length > 0 || videos.length > 0;
  const actionDisabled = submitDisabled || loading;

  const attachActions = [];
  if (onPickMedia) {
    attachActions.push({
      key: "media",
      color: "#3B82F6",
      icon: "images-outline",
      label: t("createPost.addMedia", "Ảnh/Video"),
      onPress: onPickMedia,
    });
  } else {
    if (onPickImage) {
      attachActions.push({
        key: "image",
        color: "#3B82F6",
        icon: "image-outline",
        label: t("createPost.addImage"),
        onPress: onPickImage,
      });
    }
    if (onPickVideo) {
      attachActions.push({
        key: "video",
        color: "#EF4444",
        icon: "videocam-outline",
        label: t("createPost.addVideo"),
        onPress: onPickVideo,
      });
    }
  }
  if (onPickDocument) {
    attachActions.push({
      key: "document",
      color: "#F59E0B",
      icon: "document-attach-outline",
      label: t("createPost.addDocument"),
      onPress: onPickDocument,
    });
  }

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
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140, zIndex: 0 }}
        pointerEvents="none"
      />
      {/* Same top header as the forum: tinted close button, big green title
          with the sparkle, and the publish / save action as a green pill. It
          stays put (the action must always be reachable while writing). */}
      <View style={{ paddingTop: topInset + 8 }}>
        <HomeStyleHeader
          icon="close"
          title={headerTitle}
          onBack={onClose}
          right={
            <TouchableOpacity
              onPress={onSubmit}
              disabled={actionDisabled}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              style={[
                styles.headerPill,
                { backgroundColor: actionDisabled ? theme.iconBackground : theme.primary },
              ]}
            >
              <Text style={[styles.headerPillText, { color: actionDisabled ? theme.subText : "#fff" }]}>
                {submitLabel}
              </Text>
            </TouchableOpacity>
          }
        />
      </View>

      <AndroidGlassBackdrop providerId="PostComposer" style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.loading}>
            <CustomLoading size={56} />
          </View>
        ) : (
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: 16,
              paddingTop: 4,
              paddingBottom: insets.bottom + 32 + (editor.toolbarVisible ? TOOLBAR_HEIGHT : 0),
            }}
            bottomOffset={TOOLBAR_HEIGHT + 24}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {banner ? (
              <View style={[styles.banner, { backgroundColor: tint("#22C55E", isDarkMode), borderColor: "transparent" }]}>
                <Ionicons name="document-text" size={18} color={theme.primary} />
                <Text style={[styles.bannerText, { color: theme.text }]}>{banner.text}</Text>
                {banner.onAction && (
                  <TouchableOpacity onPress={banner.onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[styles.bannerAction, { color: theme.primary }]}>{banner.actionLabel}</Text>
                  </TouchableOpacity>
                )}
                {banner.onDismiss && (
                  <TouchableOpacity
                    onPress={banner.onDismiss}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.close")}
                  >
                    <Ionicons name="close" size={18} color={theme.subText} />
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Title + body */}
            <View style={[cardStyle, styles.editorCard]}>
              <TextInput
                style={[styles.titleInput, { color: theme.text }]}
                placeholder={titlePlaceholder}
                placeholderTextColor={theme.subText}
                value={title}
                onChangeText={onChangeTitle}
                returnKeyType="next"
                onSubmitEditing={() => {
                  editor.setMode("write");
                  editor.inputRef.current?.focus();
                }}
              />
              <View style={[styles.divider, { backgroundColor: isDarkMode ? "#282B34" : "#F1F5F9" }]} />
              <PostEditorTabs editor={editor} />
              <PostEditorField
                editor={editor}
                placeholder={contentPlaceholder}
                previewPadding={PREVIEW_PADDING}
              />
              <View style={[styles.helpRow, { borderTopColor: isDarkMode ? "#282B34" : "#F1F5F9" }]}>
                <TouchableOpacity
                  onPress={onMarkdownHelp}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={[styles.chip, { backgroundColor: tint("#8B5CF6", isDarkMode) }]}
                >
                  <Ionicons name="logo-markdown" size={14} color="#8B5CF6" />
                  <Text style={[styles.chipText, { color: theme.text }]}>{t("createPost.markdown")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onRulesHelp}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={[styles.chip, { backgroundColor: tint("#22C55E", isDarkMode) }]}
                >
                  <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
                  <Text style={[styles.chipText, { color: theme.text }]}>{t("createPost.rules")}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Where it goes and who sees it */}
            <SectionTitle icon="options" color="#6366F1" theme={theme} isDarkMode={isDarkMode}>{t("createPost.sectionSettings")}</SectionTitle>
            <View style={cardStyle}>
              <SettingRow
                icon="albums"
                color="#8B5CF6"
                title={t("createPost.categoryLabel")}
                theme={theme}
                isDarkMode={isDarkMode}
              >
                <Dropdown
                  options={categoryOptions}
                  placeholder={t("createPost.categoryShort")}
                  selectedValue={category}
                  onValueChange={onChangeCategory}
                  containerStyle={styles.rowDropdownContainer}
                  style={styles.rowDropdown}
                  textStyle={styles.rowDropdownText}
                  arrowSize={16}
                  modalTitle={t("createPost.chooseCategory")}
                  headerIcon="clover"
                />
              </SettingRow>
              <SettingRow icon="eye" color="#3B82F6" title={t("createPost.privacyLabel")} theme={theme} isDarkMode={isDarkMode}>
                <Dropdown
                  options={privacyOptions}
                  placeholder={t("createPost.privacyPublic")}
                  selectedValue={privacy}
                  onValueChange={onChangePrivacy}
                  containerStyle={styles.rowDropdownContainer}
                  style={styles.rowDropdown}
                  textStyle={styles.rowDropdownText}
                  arrowSize={16}
                  modalTitle={t("createPost.privacyLabel")}
                  headerIcon="eye-outline"
                />
              </SettingRow>
              <SettingRow
                icon="eye-off"
                color="#EC4899"
                title={t("createPost.anonymous")}
                hint={t("createPost.anonymousDesc")}
                theme={theme}
                isDarkMode={isDarkMode}
                dimmed={!onToggleAnonymous}
                wide
                last
              >
                <Switch
                  value={!!anonymous}
                  onValueChange={onToggleAnonymous}
                  disabled={!onToggleAnonymous}
                  trackColor={{ true: "#EC4899" }}
                  accessibilityLabel={t("createPost.anonymous")}
                />
              </SettingRow>
            </View>

            {/* Attachments */}
            <SectionTitle icon="attach" color="#10B981" theme={theme} isDarkMode={isDarkMode}>{t("createPost.attachments")}</SectionTitle>
            <View style={cardStyle}>
              <View style={styles.attachActions}>
                {attachActions.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    style={[styles.attachAction, { backgroundColor: tint(item.color, isDarkMode) }]}
                  >
                    <Ionicons name={item.icon} size={22} color={item.color} />
                    <Text style={[styles.attachLabel, { color: theme.text }]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {hasMedia && (
                // Photos and videos share one row so attaching either feels
                // like the same action.
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mediaRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {images.map((image, index) => (
                    <View key={`image-${index}-${image.uri}`} style={styles.mediaTile}>
                      <FastImage
                        source={{ uri: image.uri }}
                        style={[styles.mediaImage, { borderColor: theme.border }]}
                      />
                      <TouchableOpacity
                        onPress={() => onRemoveImage(index)}
                        style={styles.removeBadge}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t("createPost.removeAttachment")}
                      >
                        <Ionicons name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {videos.map((video, index) => (
                    <VideoThumbnail
                      key={`video-${index}-${video.uri}`}
                      uri={video.uri}
                      width={MEDIA_TILE}
                      height={MEDIA_TILE}
                      borderRadius={14}
                      onRemove={() => onRemoveVideo(index)}
                    />
                  ))}
                </ScrollView>
              )}

              {documents.map((doc, index) => (
                <View
                  key={`document-${index}`}
                  style={[
                    styles.fileRow,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDarkMode ? "#282B34" : "#F1F5F9" },
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: tint("#F59E0B", isDarkMode) }]}>
                    <Ionicons name="document-text" size={20} color="#F59E0B" />
                  </View>
                  <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                    {doc.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onRemoveDocument(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("createPost.removeAttachment")}
                  >
                    <Ionicons name="close-circle" size={22} color={theme.subText} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primary, { backgroundColor: theme.primary }, actionDisabled && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={actionDisabled}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.primaryText}>{submitLabel}</Text>
              </View>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        )}
      </AndroidGlassBackdrop>

      {!loading && <PostEditorToolbar editor={editor} />}
      {!loading && <PostEditorMentions editor={editor} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerPill: { height: 38, paddingHorizontal: 18, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  headerPillText: { fontSize: 15, fontWeight: "800" },
  sectionHead: { flexDirection: "row", alignItems: "center", marginBottom: 10, marginLeft: 4 },
  sectionIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 8 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bannerAction: { fontSize: 13, fontWeight: "700" },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 24,
  },
  editorCard: { padding: 16 },
  titleInput: { fontSize: 20, fontWeight: "700", paddingVertical: 4, paddingHorizontal: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 12, marginBottom: 12 },
  helpRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowText: { marginLeft: 12, flexShrink: 0, maxWidth: "55%" },
  rowTextWide: { flex: 1, marginLeft: 12, marginRight: 12 },
  rowTitle: { fontSize: 16 },
  rowHint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  rowDropdownContainer: { flex: 1, marginVertical: 0, marginLeft: 12, alignItems: "flex-end" },
  rowDropdown: {
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  rowDropdownText: { fontSize: 15, textAlign: "right" },
  attachActions: { flexDirection: "row", gap: 8, padding: 12 },
  attachAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
  },
  attachLabel: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  mediaRow: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  mediaTile: { width: MEDIA_TILE, height: MEDIA_TILE },
  mediaImage: {
    width: MEDIA_TILE,
    height: MEDIA_TILE,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16 },
  fileName: { flex: 1, fontSize: 15 },
  primary: { borderRadius: 999, padding: 15, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
