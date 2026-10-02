import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { getProfile, updateProfile } from "../../../services/api/Api";
import FastImage from "../../../components/FastImage";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import StyledName from "../../../components/profile/StyledName";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";
import ProfileEffect from "../../../components/profile/ProfileEffect";
import ProfileFrame from "../../../components/profile/ProfileFrame";
import ProfilePreviewCard from "../../../components/profile/ProfilePreviewCard";
import PointsMilestones from "../../../components/profile/PointsMilestones";
import ThemeSheet, { OptionTile } from "../../../components/profile/ThemeSheet";
import { ColorPickerSheet, ColorSwatchButton } from "../../../components/profile/ColorPicker";
import { DEFAULT_ACCENT, DEFAULT_PRIMARY } from "../../../utils/profileTheme";

const DEFAULT_THEME = {
  primary_color: null,
  accent_color: null,
  banner_color: null,
  name_font: "default",
  name_effect: "none",
  name_colors: [DEFAULT_PRIMARY, DEFAULT_ACCENT],
  avatar_frame: "none",
  profile_effect: "none",
  profile_frame: "none",
};

const OPTION_FIELDS = ["name_font", "name_effect", "avatar_frame", "profile_effect", "profile_frame"];

const sameTheme = (a, b) =>
  Object.keys(DEFAULT_THEME).every((key) => JSON.stringify(a?.[key]) === JSON.stringify(b?.[key]));

// A saved theme can hold options the user is no longer ranked high enough
// for (their points dropped). Start editing from what others actually see,
// so the save bar only ever reflects what the user changes now.
const withoutLockedOptions = (theme, editor) =>
  OPTION_FIELDS.reduce(
    (result, field) => {
      const option = editor.options[field].find((o) => o.key === theme[field]);
      if (editor.can_customize && option && !option.unlocked) {
        result[field] = DEFAULT_THEME[field];
      }
      return result;
    },
    { ...DEFAULT_THEME, ...theme }
  );

function Section({ title, children, last }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.section, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

// Big rounded button used for every slot (Discord style).
function Slot({ label, onPress, children, style }) {
  const { isDarkMode } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.slot, { backgroundColor: isDarkMode ? "#404040" : "#f3f4f6" }, style]}
    >
      {children}
    </TouchableOpacity>
  );
}

function AddIcon() {
  return (
    <View style={styles.addIcon}>
      <Ionicons name="add" size={20} color="#1f2937" />
    </View>
  );
}

/**
 * Trình chỉnh sửa giao diện trang cá nhân kiểu Discord - bản mobile của
 * ProfileCustomizer bên web (/settings/appearance). Thẻ xem trước ở trên
 * cùng, các mục chỉnh ở giữa, mốc điểm ở dưới. Thanh "Đừng quên lưu thay
 * đổi!" hiện khi có thay đổi; rời màn hình khi chưa lưu sẽ bị hỏi lại.
 */
export default function ProfileCustomizerScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { username, getAvatarUrl, getCoverUrl } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [editor, setEditor] = useState(null);
  const [saved, setSaved] = useState(DEFAULT_THEME);
  const [draft, setDraft] = useState(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null);
  const shake = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const load = useCallback(async () => {
    const response = await getProfile(username);
    const data = response.data;
    setProfile(data);
    setEditor(data?.profile?.theme_editor || null);
    return data?.profile?.theme_editor || null;
  }, [username]);

  useEffect(() => {
    if (!username) return undefined;
    let cancelled = false;
    setLoading(true);
    load()
      .then((state) => {
        if (cancelled) return;
        const current = state?.saved ? withoutLockedOptions(state.saved, state) : DEFAULT_THEME;
        setSaved(current);
        setDraft(current);
      })
      .catch((error) => {
        console.error("Error loading profile customization:", error);
        if (!cancelled) Toast.show({ type: "error", text1: t("profileTheme.loadError", "Không thể tải dữ liệu. Vui lòng thử lại.") });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username, load, t]);

  // Photos are changed on EditProfileScreen; pick the new ones up on return
  // without touching the draft.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      load().catch(() => {});
    }, [load])
  );

  const dirty = !sameTheme(draft, saved);

  const shakeBar = useCallback(() => {
    shake.setValue(0);
    Animated.sequence(
      [8, -8, 6, -6, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 60, useNativeDriver: true }))
    ).start();
  }, [shake]);

  // Like Discord: leaving with unsaved changes is held back - the save bar
  // shakes and the user picks between staying and discarding.
  useEffect(() => {
    if (!dirty) return undefined;
    return navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
      shakeBar();
      Alert.alert(
        t("profileTheme.unsavedTitle", "Chưa lưu thay đổi"),
        t("profileTheme.unsavedMessage", "Bạn có muốn bỏ các thay đổi chưa lưu không?"),
        [
          { text: t("profileTheme.stay", "Ở lại"), style: "cancel" },
          {
            text: t("profileTheme.discard", "Bỏ thay đổi"),
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });
  }, [dirty, navigation, shakeBar, t]);

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const save = async (next) => {
    try {
      setSaving(true);
      await updateProfile(username, { profile_theme: next });
      const result = next || DEFAULT_THEME;
      setSaved(result);
      setDraft(result);
      setEditor((current) => ({ ...current, saved: next }));
      Toast.show({
        type: "success",
        text1: next ? t("profileTheme.saved", "Đã lưu thay đổi.") : t("profileTheme.restored", "Đã khôi phục mặc định."),
      });
    } catch (error) {
      console.error("Error saving profile theme:", error?.response?.data || error);
      Toast.show({
        type: "error",
        text1: error?.response?.data?.message || t("profileTheme.saveError", "Có lỗi xảy ra khi lưu."),
      });
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View pointerEvents="box-none" style={styles.headerWrap}>
      <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <View style={{ width: 44 }}>
          <LiquidButton size={44} scrollY={scrollY} providerId="ProfileCustomizerScreen" onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </LiquidButton>
        </View>
        <Animated.Text style={[styles.headerTitle, { color: theme.primary, opacity: headerTitleOpacity }]} numberOfLines={1}>
          {t("profileTheme.title", "Giao diện hồ sơ")}
        </Animated.Text>
        <View style={{ width: 44 }} />
      </View>
    </View>
  );

  if (loading || !editor || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {header}
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={{ color: theme.subText }}>{t("profileTheme.loadError", "Không thể tải dữ liệu. Vui lòng thử lại.")}</Text>
          )}
        </View>
      </View>
    );
  }

  const optionOf = (field, key) => editor.options[field].find((o) => o.key === key);
  const optionLabel = (field, key) =>
    field === "name_font" ? t(`profileTheme.fonts.${key}`, key) : t(`profileTheme.options.${field}.${key}`, key);

  // Points still needed to save the draft (0 = can save).
  const lockedPoints = Math.max(
    editor.can_customize ? 0 : editor.required_points || 0,
    ...OPTION_FIELDS.map((field) => {
      const option = optionOf(field, draft[field]);
      return option && !option.unlocked ? option.required_points : 0;
    })
  );

  const profileName = profile.profile?.profile_name || profile.username;
  const avatarUrl = getAvatarUrl ? getAvatarUrl(username) : profile.profile?.profile_picture;
  const coverUrl = profile.profile?.cover_photo_url ? (getCoverUrl ? getCoverUrl(username) : profile.profile.cover_photo_url) : null;
  const sampleBackground = isDarkMode ? ["#525252", "#262626"] : ["#9ca3af", "#4b5563"];

  const avatar = (size, previewTheme) => (
    <AvatarFrameWrap theme={previewTheme} size={size}>
      <FastImage source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#fff" }} />
    </AvatarFrameWrap>
  );

  const pickers = {
    avatar_frame: {
      title: t("profileTheme.groups.avatar_frame", "Khung ảnh đại diện"),
      render: (key) => (
        <>
          <View style={{ marginVertical: 4 }}>{avatar(52, { ...draft, avatar_frame: key })}</View>
          <Text style={[styles.tileLabel, { color: theme.text }]}>{optionLabel("avatar_frame", key)}</Text>
        </>
      ),
    },
    profile_effect: {
      title: t("profileTheme.groups.profile_effect", "Hiệu ứng hồ sơ"),
      render: (key) => (
        <>
          <View style={styles.tileSample}>
            <LinearGradient colors={sampleBackground} style={StyleSheet.absoluteFill} />
            <ProfileEffect theme={{ ...draft, profile_effect: key }} replayKey={picker} />
          </View>
          <Text style={[styles.tileLabel, { color: theme.text }]}>{optionLabel("profile_effect", key)}</Text>
        </>
      ),
    },
    profile_frame: {
      title: t("profileTheme.groups.profile_frame", "Khung hồ sơ"),
      render: (key) => (
        <>
          <View style={[styles.tileSample, { backgroundColor: isDarkMode ? "#404040" : "#e5e7eb" }]}>
            <ProfileFrame theme={{ ...draft, profile_frame: key }} radius={10} />
          </View>
          <Text style={[styles.tileLabel, { color: theme.text }]}>{optionLabel("profile_frame", key)}</Text>
        </>
      ),
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {header}
      <AndroidGlassBackdrop providerId="ProfileCustomizerScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        contentContainerStyle={{
          paddingTop: 64 + insets.top,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + (dirty ? 110 : 24),
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ProfilePreviewCard
          theme={draft}
          username={username}
          profileName={profileName}
          avatarUrl={avatarUrl}
          coverUrl={coverUrl}
          bio={profile.profile?.bio}
          joinedAt={profile.profile?.joined_at}
          points={editor.current_points}
          effectReplayKey={draft.profile_effect}
        />

        {!editor.can_customize ? (
          <View style={[styles.notice, { backgroundColor: isDarkMode ? "#422006" : "#fef3c7" }]}>
            <Ionicons name="lock-closed" size={16} color="#b45309" />
            <Text style={[styles.noticeText, { color: isDarkMode ? "#fde68a" : "#92400e" }]}>
              {t("profileTheme.lockedNotice", "Cần {{points}} điểm để tùy chỉnh giao diện. Bạn vẫn có thể xem thử.", {
                points: editor.required_points,
              })}
            </Text>
          </View>
        ) : null}

        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Section title={t("profileTheme.sections.avatar", "Ảnh đại diện & Khung")}>
            <View style={styles.grid2}>
              <Slot label={t("profileTheme.changeAvatar", "Đổi ảnh đại diện")} onPress={() => navigation.navigate("EditProfileScreen")}>
                <FastImage source={{ uri: avatarUrl }} style={styles.slotAvatar} />
              </Slot>
              <Slot label={t("profileTheme.groups.avatar_frame", "Khung ảnh đại diện")} onPress={() => setPicker("avatar_frame")}>
                {draft.avatar_frame === "none" ? <AddIcon /> : avatar(56, draft)}
              </Slot>
            </View>
            <View style={styles.hintRow}>
              {!editor.animated_avatar.unlocked ? <Ionicons name="lock-closed" size={11} color={theme.subText} /> : null}
              <Text style={[styles.hint, { color: theme.subText }]}>
                {t("profileTheme.gifHint", "GIF động · {{points}} điểm", { points: editor.animated_avatar.required_points })}
              </Text>
            </View>
          </Section>

          <Section title={t("profileTheme.sections.banner", "Ảnh bìa")}>
            <View style={styles.grid2}>
              <Slot
                label={t("profileTheme.bannerColor", "Màu ảnh bìa")}
                onPress={() => setPicker("banner_color")}
                style={
                  draft.banner_color
                    ? { backgroundColor: draft.banner_color }
                    : { borderWidth: 1, borderStyle: "dashed", borderColor: theme.subText }
                }
              >
                {!draft.banner_color ? <Ionicons name="color-palette-outline" size={26} color={theme.subText} /> : null}
              </Slot>
              <Slot label={t("profileTheme.changeCover", "Đổi ảnh bìa")} onPress={() => navigation.navigate("EditProfileScreen")}>
                {coverUrl ? (
                  <FastImage source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={28} color={theme.subText} />
                )}
              </Slot>
            </View>
            {draft.banner_color ? (
              <TouchableOpacity onPress={() => update({ banner_color: null })} style={styles.linkButton}>
                <Text style={[styles.link, { color: theme.primary }]}>{t("profileTheme.clearBanner", "Bỏ màu ảnh bìa")}</Text>
              </TouchableOpacity>
            ) : null}
          </Section>

          <Section title={t("profileTheme.sections.effects", "Hiệu ứng & Khung hồ sơ")}>
            <View style={styles.grid2}>
              <Slot label={t("profileTheme.groups.profile_effect", "Hiệu ứng hồ sơ")} onPress={() => setPicker("profile_effect")}>
                {draft.profile_effect === "none" ? (
                  <AddIcon />
                ) : (
                  <>
                    <LinearGradient colors={sampleBackground} style={StyleSheet.absoluteFill} />
                    <ProfileEffect theme={draft} replayKey={draft.profile_effect} />
                    <Text style={styles.slotCaptionLight}>{optionLabel("profile_effect", draft.profile_effect)}</Text>
                  </>
                )}
              </Slot>
              <Slot label={t("profileTheme.groups.profile_frame", "Khung hồ sơ")} onPress={() => setPicker("profile_frame")}>
                {draft.profile_frame === "none" ? (
                  <AddIcon />
                ) : (
                  <>
                    <ProfileFrame theme={draft} radius={14} />
                    <Text style={[styles.slotCaption, { color: theme.text }]}>{optionLabel("profile_frame", draft.profile_frame)}</Text>
                  </>
                )}
              </Slot>
            </View>
          </Section>

          <Section title={t("profileTheme.sections.name", "Kiểu tên")}>
            <Slot label={t("profileTheme.sections.name", "Kiểu tên")} onPress={() => setPicker("name")} style={styles.nameSlot}>
              <StyledName theme={draft} style={[styles.slotName, { color: theme.text }]} numberOfLines={1}>
                {profileName}
              </StyledName>
            </Slot>
          </Section>

          <Section title={t("profileTheme.sections.colors", "Màu giao diện")} last={!editor.saved}>
            <View style={styles.colorRow}>
              <ColorSwatchButton
                color={draft.primary_color}
                fallback={DEFAULT_PRIMARY}
                label={t("profileTheme.primaryColor", "Màu chính")}
                onPress={() => setPicker("primary_color")}
              />
              <ColorSwatchButton
                color={draft.accent_color}
                fallback={DEFAULT_ACCENT}
                label={t("profileTheme.accentColor", "Màu phụ")}
                onPress={() => setPicker("accent_color")}
              />
            </View>
            {draft.primary_color || draft.accent_color ? (
              <TouchableOpacity onPress={() => update({ primary_color: null, accent_color: null })} style={styles.linkButton}>
                <Text style={[styles.link, { color: theme.primary }]}>{t("profileTheme.clearColors", "Bỏ màu giao diện")}</Text>
              </TouchableOpacity>
            ) : null}
          </Section>

          {editor.saved ? (
            <View style={styles.section}>
              <TouchableOpacity
                disabled={saving}
                onPress={() =>
                  Alert.alert(t("profileTheme.restoreTitle", "Khôi phục giao diện mặc định?"), undefined, [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("profileTheme.restore", "Khôi phục"), style: "destructive", onPress: () => save(null) },
                  ])
                }
                style={styles.restoreButton}
              >
                <Text style={styles.restoreText}>{t("profileTheme.restoreDefault", "Khôi phục mặc định")}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <PointsMilestones
          editor={editor}
          theme={draft}
          avatarUrl={avatarUrl}
          onTry={(field, key) => update({ [field]: key })}
        />
      </Animated.ScrollView>
      </AndroidGlassBackdrop>

      {Object.entries(pickers).map(([field, config]) => (
        <OptionPickerSheet
          key={field}
          visible={picker === field}
          title={config.title}
          options={editor.options[field]}
          value={draft[field]}
          renderOption={config.render}
          onApply={(key) => update({ [field]: key })}
          onClose={() => setPicker(null)}
        />
      ))}
      <NameStyleSheet
        visible={picker === "name"}
        theme={draft}
        options={editor.options}
        profileName={profileName}
        optionLabel={optionLabel}
        onApply={update}
        onClose={() => setPicker(null)}
      />
      {["banner_color", "primary_color", "accent_color"].map((field) => (
        <ColorPickerSheet
          key={field}
          visible={picker === field}
          title={
            field === "banner_color"
              ? t("profileTheme.bannerColor", "Màu ảnh bìa")
              : field === "primary_color"
                ? t("profileTheme.primaryColor", "Màu chính")
                : t("profileTheme.accentColor", "Màu phụ")
          }
          value={draft[field] || (field === "accent_color" ? DEFAULT_ACCENT : field === "banner_color" ? "#9ca3af" : DEFAULT_PRIMARY)}
          onApply={(hex) => update({ [field]: hex })}
          onClose={() => setPicker(null)}
        />
      ))}

      {dirty ? (
        <Animated.View
          style={[
            styles.saveBar,
            {
              bottom: insets.bottom + 12,
              backgroundColor: isDarkMode ? "#0a0a0a" : "#171717",
              transform: [{ translateX: shake }],
            },
          ]}
        >
          <Text style={styles.saveText} numberOfLines={2}>
            {lockedPoints
              ? t("profileTheme.previewOnly", "Đang xem thử — cần {{points}} điểm để lưu", { points: lockedPoints })
              : t("profileTheme.unsaved", "Đừng quên lưu thay đổi!")}
          </Text>
          <View style={styles.saveActions}>
            <TouchableOpacity onPress={() => setDraft(saved)} disabled={saving} style={styles.resetButton}>
              <Text style={styles.resetText}>{t("profileTheme.reset", "Đặt lại")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => save(draft)}
              disabled={saving || lockedPoints > 0}
              style={[
                styles.saveButton,
                { backgroundColor: lockedPoints ? "rgba(255,255,255,0.15)" : theme.primary },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.saveButtonText, lockedPoints ? { color: "rgba(255,255,255,0.6)" } : null]}>
                  {t("profileTheme.save", "Lưu")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Lưới chọn một tuỳ chọn (khung avatar, hiệu ứng, khung hồ sơ). */
function OptionPickerSheet({ visible, title, options, value, renderOption, onApply, onClose }) {
  const [selected, setSelected] = useState(value);

  useEffect(() => {
    if (visible) setSelected(value);
  }, [visible, value]);

  return (
    <ThemeSheet
      visible={visible}
      title={title}
      onClose={onClose}
      onApply={() => {
        onApply(selected);
        onClose();
      }}
    >
      <View style={styles.grid3}>
        {options.map((option) => (
          <OptionTile
            key={option.key}
            option={option}
            selected={selected === option.key}
            onPress={() => setSelected(option.key)}
            style={styles.tile3}
          >
            {renderOption(option.key)}
          </OptionTile>
        ))}
      </View>
    </ThemeSheet>
  );
}

/** "Kiểu tên" (Display Name Style của Discord): phông, hiệu ứng và màu tên. */
function NameStyleSheet({ visible, theme: draftTheme, options, profileName, optionLabel, onApply, onClose }) {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const [style, setStyle] = useState(null);
  const [colorIndex, setColorIndex] = useState(null);

  useEffect(() => {
    if (visible) {
      setStyle({
        name_font: draftTheme.name_font,
        name_effect: draftTheme.name_effect,
        name_colors: draftTheme.name_colors,
      });
    }
  }, [visible, draftTheme]);

  if (!style) return null;

  const preview = { ...draftTheme, ...style };
  const set = (patch) => setStyle((current) => ({ ...current, ...patch }));

  return (
    <>
      <ThemeSheet
        visible={visible && colorIndex === null}
        title={t("profileTheme.sections.name", "Kiểu tên")}
        onClose={onClose}
        onApply={() => {
          onApply(style);
          onClose();
        }}
      >
        <View style={[styles.namePreview, { backgroundColor: isDarkMode ? "#404040" : "#f3f4f6" }]}>
          <StyledName theme={preview} style={[styles.namePreviewText, { color: theme.text }]} numberOfLines={2}>
            {profileName}
          </StyledName>
        </View>

        <Text style={[styles.sheetLabel, { color: theme.text }]}>{t("profileTheme.font", "Phông chữ")}</Text>
        <View style={styles.grid3}>
          {options.name_font.map((option) => (
            <OptionTile
              key={option.key}
              option={option}
              selected={style.name_font === option.key}
              onPress={() => set({ name_font: option.key })}
              style={styles.tile3}
            >
              <StyledName
                theme={{ ...preview, name_font: option.key, name_effect: "none" }}
                style={[styles.fontSample, { color: theme.text }]}
                numberOfLines={1}
              >
                {optionLabel("name_font", option.key)}
              </StyledName>
            </OptionTile>
          ))}
        </View>

        <Text style={[styles.sheetLabel, { color: theme.text }]}>{t("profileTheme.effect", "Hiệu ứng")}</Text>
        <View style={styles.grid3}>
          {options.name_effect.map((option) => (
            <OptionTile
              key={option.key}
              option={option}
              selected={style.name_effect === option.key}
              onPress={() => set({ name_effect: option.key })}
              style={styles.tile3}
            >
              <StyledName theme={{ ...preview, name_effect: option.key }} style={[styles.effectSample, { color: theme.text }]}>
                Aa
              </StyledName>
              <Text style={[styles.tileLabel, { color: theme.text }]}>{optionLabel("name_effect", option.key)}</Text>
            </OptionTile>
          ))}
        </View>

        {style.name_effect !== "none" ? (
          <>
            <Text style={[styles.sheetLabel, { color: theme.text }]}>{t("profileTheme.color", "Màu")}</Text>
            <View style={styles.nameColors}>
              {(style.name_effect === "gradient" ? [0, 1] : [0]).map((index) => (
                <TouchableOpacity
                  key={index}
                  accessibilityLabel={t("profileTheme.nameColor", "Chọn màu tên {{index}}", { index: index + 1 })}
                  onPress={() => setColorIndex(index)}
                  style={[styles.nameColor, { backgroundColor: style.name_colors[index], borderColor: theme.border }]}
                />
              ))}
            </View>
          </>
        ) : null}
      </ThemeSheet>

      {/* Two RN Modals can't be stacked reliably, so the name sheet steps
          aside while its color picker is open. */}
      <ColorPickerSheet
        visible={visible && colorIndex !== null}
        title={t("profileTheme.color", "Màu")}
        value={style.name_colors[colorIndex ?? 0]}
        onApply={(hex) =>
          set({ name_colors: style.name_colors.map((c, i) => (i === colorIndex ? hex : c)) })
        }
        onClose={() => setColorIndex(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600" },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, padding: 12 },
  noticeText: { flex: 1, fontSize: 13 },
  panel: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  section: { paddingVertical: 14 },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 10 },
  grid2: { flexDirection: "row", gap: 8 },
  slot: {
    flex: 1,
    height: 96,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  slotAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#fff" },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  slotCaption: { fontSize: 12, fontWeight: "500" },
  slotCaptionLight: { fontSize: 12, fontWeight: "500", color: "#fff" },
  nameSlot: { flex: 0, height: 64, paddingHorizontal: 12 },
  slotName: { fontSize: 20, fontWeight: "bold" },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  hint: { fontSize: 12 },
  colorRow: { flexDirection: "row", gap: 8 },
  linkButton: { marginTop: 6, alignSelf: "flex-start" },
  link: { fontSize: 13, fontWeight: "500" },
  restoreButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: { color: "#ef4444", fontWeight: "600" },
  grid3: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile3: { width: "31.5%", minHeight: 90 },
  tileSample: { width: "100%", height: 58, borderRadius: 10, overflow: "hidden" },
  tileLabel: { fontSize: 12, textAlign: "center" },
  namePreview: { borderRadius: 14, paddingVertical: 20, paddingHorizontal: 12, alignItems: "center", marginBottom: 6 },
  namePreviewText: { fontSize: 28, fontWeight: "bold", textAlign: "center" },
  sheetLabel: { fontSize: 14, fontWeight: "600", marginTop: 14, marginBottom: 8 },
  fontSample: { fontSize: 15 },
  effectSample: { fontSize: 24, fontWeight: "bold" },
  nameColors: { flexDirection: "row", gap: 12 },
  nameColor: { width: 56, height: 40, borderRadius: 10, borderWidth: 1 },
  saveBar: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  saveText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "500" },
  saveActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  resetButton: { paddingHorizontal: 10, paddingVertical: 8 },
  resetText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  saveButton: { minWidth: 64, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  saveButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
