# INFO — CBH Youth Online — Mobile

> **For AI agents.** Project map for agents working in this repo: how it connects to the sibling repos, features, structure, setup, conventions and recent work. Humans: see `README.md`. Keep this file current - add to **Recent work** and update other sections whenever you change the repo.

- **Development happens on `dhphuc`.** Always `git checkout dhphuc && git pull` before starting work (the repo may have been left on `main`), then commit and push there; `dhphuc` reaches `main` through a PR. Exception: an important/urgent patch the user wants shipped from `main` directly - afterwards merge `main` back into `dhphuc`.
- **Find code via this file first**: check **Project structure** / **Features** below before grepping the repo by hand.

Expo / React Native app for **CBH Youth Online (CYO)**, the student forum and social network of THPT Chuyên Biên Hòa (Hà Nam). Store name "CBH Online", bundle/package `com.fatties.youth`.

This README is written so a new contributor — human or AI agent — can pick the repo up cold: what the app does, how it is laid out, how to run it, the conventions to follow, and what changed recently.

---

## 1. The CBH system (sibling repos)

| Repo (local path) | What it is | Talks to |
| --- | --- | --- |
| `cbh-youth-online-mobile` (this) | Expo app (iOS/Android) | API over HTTPS + Reverb websockets |
| [cbh-youth-online-api](https://github.com/tunnaduong/cbh-youth-online-api) | Laravel API — `https://api.chuyenbienhoa.com/v1.0/...`, Sanctum bearer tokens, Reverb (chat/realtime) | DB, push, mail |
| [cbh-youth-online-next-js](https://github.com/tunnaduong/cbh-youth-online-next-js) | Next.js web site — `https://chuyenbienhoa.com` (+ `/admin` dashboard) | API |
| [cbh-youth-online-gift-shop](https://github.com/tunnaduong/cbh-youth-online-gift-shop) | Next.js gift shop — `https://giftshop.chuyenbienhoa.com` | API |

How they connect:
- **Auth**: the app stores its Sanctum token in AsyncStorage (`auth_token`) and sends `Authorization: Bearer` (see `app/services/api/axiosInstance.js`). The web sites share one `auth_token` cookie on `.chuyenbienhoa.com`.
- **App → web login**:
  - Both the in-app browser (`openInAppBrowser`, SFSafariViewController / Custom Tabs) and the app's own WebViews (`WebAppScreen`, `GamePlayScreen`) get a web session of their own: a one-time code from `POST /v1.0/web-session/handoff`, opened as `https://<site>/auth/set-token?code=…&return=…`; the site redeems it at `POST /v1.0/web-session/redeem`. `sessionEntryUrl(url, parts, "browser" | "webview")` in `app/utils/webSession.js` does it once per app login per cookie store (MMKV keys `web_session_handed_off` / `webview_session_handed_off` hold the token fingerprint).
  - Never the app's own token: WebViews used to inject it as a cookie, which made the app's entry in the logged-in devices list flip to "web". WebViews append `CBHYouthApp/<version>` to their user agent, so the sites label their session "WebView trong ứng dụng CBH Youth"; browser sessions the app handed over carry a `cbh_session_source=app` cookie and show "<browser> · mở từ ứng dụng".
  - Signed out / switched account: with no app account, the next CBH page opens via `/auth/set-token?logout=1` (drops the web session and revokes it if the app handed it over). A new handoff after an account switch revokes the previous app-handed session. If the handoff fails after a switch, the page is signed out rather than left on the old account.
  - `webViewBootScript({ theme })` runs before each WebView load: app mode + theme (below), and drops a stale host-only `auth_token`.
- **App mode**: web pages opened by the app get `?app=true` and a `sessionStorage.cbh_app_mode` flag; the sites then hide sign-out, splash, "get the app" banners and off-site links.
- **Deep links**: scheme `com.fatties.youth://` (`post/<id>`, `story/<id>`, `group/<token>`, `oauth`) and universal links on `chuyenbienhoa.com` / `www.chuyenbienhoa.com` (`app.json` `associatedDomains` / intent filters). Routing lives in `App.js` (`navigateToDeepLinkTarget`); in-content CBH links open native screens via `resolveInAppRoute` in `app/utils/externalLink.js`.

---

## 2. Features

- **Onboarding & auth**: welcome carousel, language select (vi/en/ru), first-launch settings, login/signup, forgot password, email verification, Google/Facebook OAuth (PKCE, `app/services/oauth.js`), Apple sign-in, multi-account switcher (`AccountSwitcher`, `utils/savedAccounts.js`).
- **Feed & posts**: infinite home feed, create/edit post (rich text, images, video upload, YouTube/SoundCloud share), votes with voter lists, comments with mentions and slash commands, saved/liked posts, share/forward, OG link preview cards (`LinkPreviewCard`, `utils/linkPreview.js`), link-safety interstitial for external URLs (`LinkSafetyScreen`).
- **Forum**: categories/subforums (`ForumScreen`, `CategoryScreen`), Youth Union news category.
- **Stories**: Instagram-style stories (create with overlays/music, react, reply, viewers sheet, archive).
- **Chat**: 1-1 and group conversations, realtime via Laravel Echo + Reverb (`ChatSocketContext`, `services/echo`), WebRTC voice and video calls (`CallContext`, `services/call`), typing, reactions, replies, forwarding, media gallery, chat backgrounds, group info / invites.
- **Notifications**: moderation notices (`content_warning` opens the content, `content_deleted` only informs), Expo push (`services/notifications/ExpoNotificationService.js`, `NotificationContext`), unread badges (`UnreadCountsContext`), tap routing (`utils/notificationRouting.js`).
- **Profile**: profile/detail screens, edit profile, photo gallery (a "Photos" view of the Posts tab: `components/profile/ProfilePhotoGallery.js`, `GET /v1.0/users/{username}/photos`), Discord-style customization (avatar frames, name fonts/effects, profile effects, and at the Pro tier a name icon and a `@username` styled like the name; `ProfileCustomizerScreen`, `components/profile` - `UserNameRow` / `NameIcon` / `StyledUsername` draw a user's name everywhere, `utils/profileTheme.js`), points milestones, member ranking.
- **Points**: point wallet, deposit/withdraw, gift points (`GiftPointsModal`).
- **Explore**: games (web, in WebView), quizzes + custom quizzes, universities, study materials (view/upload).
- **Reports & feedback**: reporting posts, comments (long-press), stories, chat messages and users (`ReportModal` → `reportUser`, `POST /v1.0/reports`), multi-step student/class violation reports (`ReportScreen/ReportNavigator`, sent to `POST /v1.0/violation-reports`), bug report / feedback screen, shake-to-report with screenshot (`ShakeToReport`).
- **Web apps in the app**: sidebar entries **Gift shop** (everyone) and **Admin** (only `userInfo.role === "admin"`), both `WebAppScreen` (see §5).
- **Settings**: theme (light/dark/system, liquid glass toggle, video autoplay), language, security, blocked users, notification settings, student verification, about, terms/privacy, dev console, easter egg (long-press About).
- **Other**: share-intent (`expo-share-intent`), OTA updates (`expo-updates`, channels `preview`/`production`), responsive layout for tablets/foldables (`utils/responsive.js`), in-process "cold restart" (`SessionContext`).

---

## 3. Project structure

```
index.js                   Entry: catches launch errors and shows StartupErrorScreen instead of crashing
App.js                     Root: providers, navigation stacks (logged-in + auth), deep-link handling, screen registry
index.js                   Expo entry
app.json / eas.json        Expo config (version, icons, plugins, deep links) / EAS build profiles
patches/                   patch-package patches (applied on npm install); *.patch.old are retired
android/, ios/             NOT in git - generated by `npx expo prebuild` (see Setup)
plugins/withNativeTweaks.js  config plugin holding what used to be hand edits in android/ and ios/
keystores/debug.keystore  keystore CI signs the APK with (copied into android/app by the plugin)
app/
  assets/                  Icons (seasonal + iOS 26 variants), splash, Lottie, fonts
  components/              Shared UI
    Sidebar.js             Drawer menu (Utilities / Settings / Support sections)
    PostItem.js            Feed post card (largest component)
    LiquidButton.js        Floating glass button used by native screen headers
    GlassModules.js        Liquid-glass wrappers + AndroidGlassBackdrop
    WebViewHeader.js       Plain solid header for WebView screens
    profile/               Profile customization pieces, ProfilePhotoGallery, ProfileVideoGallery
    StoryOverlays/         Story text/sticker/music overlays
  contexts/                Auth, Theme, Feed, Notification, ChatSocket, UnreadCounts, BottomSheet, StatusBar, Session, Animation
  global/storage.js        MMKV instance (fast local cache / prefs)
  hooks/                   useStatusBarUpdate/useStatusBarStyle, useUnreadCounts, useCurrentRoute
  i18n/                    i18next setup + locales/en.json, vi.json, ru.json
  screens/
    WelcomeScreen, LanguageSelectScreen, FirstLaunchSettingsScreen, LoginScreen, SignupScreen, ForgotPasswordScreen, TwoFactorChallengeScreen
    MainScreens/
      index.js             Bottom tabs: Home, Explore ("Khám phá"), Chat, Notifications, Profile ("Cá nhân")
      HomeScreen, ForumScreen, PostScreen, CreatePostScreen, PostEditScreen, CreateStoryScreen
      ChatScreen/          Conversation list, ConversationScreen, groups, MediaGalleryScreen
        conversation/      Pieces of ConversationScreen: ConversationHeader, ChatComposer, ChatGlassBar, MessagesListContent, MessageRow, SeenByModal, TypingIndicator, chatUtils, styles...
      ProfileScreen, ProfileDetailScreen, EditProfileScreen, ProfileCustomizerScreen
      ExploreScreen/       Games, Quiz, University, StudyMaterial*, Upload
      ReportScreen/        Step1-3 + Success (own stack)
      SettingsScreen/      Settings + sub-screens (About, Security, TwoFactor, Devices, Privacy, EasterEgg, DevConsole, ...)
      PointWalletScreen/   Wallet, Deposit, Withdraw
      WebAppScreen/        Gift shop / Admin WebView host
      FeedbackScreen, LinkSafetyScreen, MemberRankingScreen, NotificationScreen, SearchScreen, ...
  services/
    api/                   axiosInstance (base URL + token interceptor), ApiByAxios helpers, Api.js endpoints
    echo/                  Laravel Echo / Pusher-protocol client for Reverb
    notifications/         Expo push registration + handlers
    oauth.js, musicSearch.js
  utils/
    externalLink.js        URL parsing, trusted hosts, in-app routes, openInAppBrowser, link-safety tokens
    webSession.js          App→web login handoff (withWebSession) + webViewBootScript
    orientation.js         Portrait lock held from JS (lockPortrait / allowRotation for the game screen)
    responsive.js          Tablet/large-screen layout helpers
    deviceInfo.js          Device headers sent to the API + remembered two-factor device token
    ...                    formatting, mentions, media download, chat helpers, saved accounts
```

---

## 4. Setup, run, build

Requirements: Node 18+ / npm, EAS CLI (devDependency `eas-cli`), Android Studio + JDK 17 for Android, Xcode + CocoaPods (macOS) for iOS. Push and OAuth need a real device.

```bash
npm install            # postinstall runs patch-package (patches/)
npm start              # expo start --dev-client  (needs an installed dev-client build)
npm run android        # expo run:android  (build + install dev client locally)
npm run ios            # expo run:ios
npx expo prebuild --platform android|ios   # (re)generate android/ or ios/; add --clean after adding a native package or editing app.json/plugins
```

**Native projects are generated, never edited**: `android/` and `ios/` are git-ignored. `expo run:*`, EAS and the GitHub workflows create them with `expo prebuild`; a native change goes into `app.json` or `plugins/withNativeTweaks.js` (pod deployment-target clamp, `android:resizeableActivity`, the APK signing keystore). No `Podfile.lock` is kept, so pods resolve fresh on each CI build.

**Build number = CI run number**: `build-android.yml` and `build-ios.yml` write `github.run_number` into `ios.buildNumber` / `android.versionCode` of the checked-out `app.json` before prebuild (run #N → build N). `scripts/set-build-number.js` does the edit. The builds only patch `app.json` in their own checkout and commit nothing, so the number in git on `dhphuc` is older than the builds. It is committed on `main` only: `build-number.yml` runs on every push to `main` (a merged PR), takes the highest run number of the two build workflows and commits it (`chore: build number N [skip ci]`, `--if-higher` so it never goes backwards); `dhphuc` picks it up at its next merge from `main`. The two workflows count their runs separately, so both must run on every push to stay equal.

EAS (`eas.json`, `appVersionSource: local` — bump `app.json` version / buildNumber yourself):
```bash
eas build --profile development --platform ios|android   # dev client, internal
eas build --profile preview --platform android            # internal APK, channel "preview"
eas build --profile production --platform ios|android     # AAB / IPA, channel "production"
eas submit --profile production
```

Config points:
- API base URL: `app/services/api/axiosInstance.js` (`https://api.chuyenbienhoa.com/`).
- OAuth client ids / redirect: `app/services/oauth.js`.
- Expo project id: `app.json` → `expo.projectId`.
- `package.json` `expo.install.exclude` pins react-native-screens / gesture-handler / keyboard-controller — don't let `expo install --fix` bump them.

There are no automated tests; verify on device. Quick syntax check for a file:
`node -e "require('@babel/core').transformFileSync('<file>',{presets:['babel-preset-expo']})"`.

---

## 5. Conventions

- **Strings**: every user-facing string goes through i18next (`useTranslation`, `t("section.key")`) with keys added to **all three** of `app/i18n/locales/en.json`, `vi.json`, `ru.json`. When editing those files, insert keys textually — re-serializing the JSON reformats unrelated one-line blocks.
- **Theme**: colors come from `useTheme()` (`theme.primary/text/subText/background/surface/border`, `isDarkMode`, `liquidGlassEnabled`). No hard-coded palette except brand accents already in use.
- **Headers**:
  - Native screens: floating header — `LiquidButton` (pass `scrollY`) + title that fades on scroll, content in an `Animated.ScrollView` with top padding, wrapped in `AndroidGlassBackdrop` (see `PrivacyPolicyScreen`, `FeedbackScreen`, `ReportScreen`).
  - WebView screens (gift shop, admin, games, easter egg): `WebViewHeader` (solid, always visible, plain back button). Don't put floating glass over web content.
- **Status bar**: `useStatusBarStyle(style, bgColor)` on focus.
- **Storage**: auth token + `user_info` in AsyncStorage (`auth_token` is read by the axios interceptor); prefs/caches (theme, avatar versions, handoff flag) in MMKV (`app/global/storage.js`).
- **Navigation**: register new screens in `App.js` (logged-in stack); use `push` for screens that load data once on mount (Post/Profile) so a new target gets a fresh instance.
- **External links**: route through `openExternalLink` / `openInAppBrowser` (`utils/externalLink.js`), never `Linking.openURL` directly for http(s).
- **WebViews of CBH sites**: use `WebAppScreen` (add a `SITES` entry + a `Stack.Screen` with `initialParams={{ site }}`). It opens through `sessionEntryUrl(…, "webview")`, injects `webViewBootScript({ theme })`, sets `applicationNameForUserAgent={WEBVIEW_USER_AGENT_SUFFIX}`, and `lockToSite` keeps a WebView on its domain (blocked navigations show a "back to home" page).
- **Infinite Scroll, Network Cancellation & List Virtualization**:
  - All GET/read endpoints in `app/services/api/Api.js` accept a trailing `config = {}` (`{ signal }`). Screen/modal fetches must attach an `AbortController` and abort pending requests on unmount, blur (where appropriate), pull-to-refresh, or filter/search/tab switches; ignore canceled errors via `isRequestCanceled(error)`.
  - Paginated `FlatList`s must guard `loadMore` with synchronous `useRef` locks (`isFetchingRef`, `pageRef`, `hasMoreRef`), memoize `onEndReached` with `useCallback`, deduplicate appended items by `id`, only advance `pageRef` after a successful response, and expose retry UI on `loadMoreError` so scrolling or tapping retries cleanly without getting stuck loading.
  - Configure `FlatList` virtualization (`initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `updateCellsBatchingPeriod={50}`, `removeClippedSubviews={Platform.OS === "android"}`, and deterministic `getItemLayout` where row heights are fixed) to prevent Android OOM crashes. Never use `unmountOnBlur: true` on bottom tabs; if `ChatScreen` unmounts or blurs, `persistedChatViewState` + MMKV cache and global `useUnreadCounts` Echo listeners preserve scroll offset, filter, online statuses, and real-time unread counts with zero drawbacks.
- **Android R8 Full Mode & ProGuard**: `app.json` (`expo-build-properties`) and `plugins/withNativeTweaks.js` enable `android.enableR8.fullMode=true`, `android.enableProguardInReleaseBuilds=true`, and `android.enableShrinkResourcesInReleaseBuilds=true` alongside keep rules for JSI/TurboModules, Hermes, Reanimated, Worklets, Skia, WebRTC, FastImage/Glide, VisionCamera, MMKV, Notifee, and Passkeys.
- **Rules learned the hard way** (each cost a bug once):
  - Chat messages: never mutate a message object in place - build a new one (`reuseUnchanged` keeps unchanged ones by identity, so an in-place edit never re-renders).
  - React Navigation here: `navigate()` to a screen lower in the stack pushes a copy; use `popTo`.
  - iOS: no `animation: "fade"` (or any opacity card animation) on a screen that shows liquid glass - use `FADE_ANIMATION` (`App.js`).
  - Android glass: never pass `edgeReflectionStrength` at a call site (`GlassModules.js` forces 0).
  - Calls: attach the remote stream to ONE unmuted element only (the `<video playsinline>` in `WebRtcBridge`); a second element or WebAudio doubles the voice.
  - Violation reports: the type lists in `report.*ViolationTypes` / `mockViolations` must stay in the same order in vi/en/ru (sent in Vietnamese by index).
  - Feed video autoplay: which post plays lives in `utils/activeVideoStore.js` (not screen state); feed lists pass `activeGate` to `PostItem`, only the two cards that flip re-render.
- **Git**: work on branch `dhphuc` (PRs to `main`). Commit messages: conventional commits in English, e.g. `fix(forum): …`, `feat(sidebar): …`. Comments explain *why*, matching the surrounding density.

---

## Design system

**Mandatory for every new or changed screen.** This is how the app looks today; build from it instead of inventing a look or copying an old screen that predates it. Values are taken from the code - when in doubt, open the reference file named in each part and copy from there.

Reference screens (newest, copy these): `SettingsScreen/DevicesScreen.js` (cards, chips, detail rows), `SettingsScreen/PasskeysScreen.js` (list card, inline form, primary button), `SettingsScreen/TwoFactorScreen.js` (switch rows, button pairs), `SettingsScreen/index.js` (section titles + setting rows), `FeedbackScreen/index.js` (modal form with a header action), `components/PostEditor/PostComposerLayout.js` (create/edit post: header action, cards, attachments).

### Colours - theme tokens only

`const { theme, isDarkMode, liquidGlassEnabled } = useTheme()` (`app/contexts/ThemeContext.js`). Never write a hex for something a token covers.

| Token | Light | Dark | Use for |
| --- | --- | --- | --- |
| `background` | `#ffffff` | `#121212` | screen background; inset boxes inside a card |
| `surface` | `#ffffff` | `#1e1e1e` | cards, panels, floating bars (`cardBackground` is the same value, older name) |
| `sectionBackground` | `#FAFAFA` | `#1e1e1e` | bars docked to an edge (e.g. the editor toolbar above the keyboard) |
| `text` | `#000000` | `#ffffff` | titles, body, values |
| `subText` | `#666666` | `#A0A0A0` | descriptions, hints, timestamps, placeholders, inactive icons |
| `primary` | `#319527` | `#4CAF50` | brand green: header title and header icons, links, active states, primary buttons, row icons |
| `border` | `#E5E5E5` | `#2C2C2C` | hairline card borders and separators, input borders |
| `iconBackground` | `#F1F1F1` | `#2C2C2C` | round icon holders, neutral chips, segmented-control track, pressed state, code/secret boxes |
| `placeholder` | `#A0A0A0` | `#666666` | disabled icons |
| `headerBackground`, `tabBarBackground` | `#ffffff` | `#1e1e1e` | solid bars only (`WebViewHeader`, tab bar) |

Hard-coded colours that are allowed because they are the same in both themes:
- Destructive: `#FF3B30` (text, outline or fill of "log out" / "remove" / "delete", inline error text).
- Text and icons on a `primary` or destructive fill: `#fff`.
- Badges on top of a photo/video: `rgba(0,0,0,0.6)` with a white icon.
- Selected-option tint (a chosen radio card, an info banner): `isDarkMode ? "#1f3320" : "#EEF7ED"` with `borderColor: theme.primary`.
- Brand logos (Facebook `#1877F2`, Discord `#5865F2`).

**Dark mode rule**: a screen must look right in both themes with no extra work - which it does if every colour is a token. If you need `isDarkMode ? a : b`, first check that no token already is that pair.

### Screen scaffold (native screens)

Every native screen: `theme.background` container, a **floating transparent header**, and the content in a scroll view that starts under it.

Header behaviour - exactly this, on every screen:
- The header has **no background and no border**. It is `position: "absolute"` over the content (`zIndex: 10`, `pointerEvents="box-none"`), height `64 + insets.top`, `paddingTop: insets.top`, `paddingHorizontal: 16`, `paddingBottom: 8`.
- **Title fades out as the content scrolls down**: `Animated.Text`, `fontSize: 18`, `fontWeight: "600"`, `color: theme.primary`, centred (`flex: 1, textAlign: "center"`), `numberOfLines={1}`, opacity `scrollY.interpolate({ inputRange: [0, 10, 50], outputRange: [1, 1, 0], extrapolate: "clamp" })`.
- **Buttons are `LiquidButton size={44}` with `scrollY={scrollY}`**: at the top of the page they have no surface at all (just the icon); once the content has scrolled more than 20px under them they get their liquid-glass surface. Never fade or hide the buttons themselves. Back = `Ionicons "chevron-back"` 24 in `theme.primary`; a screen presented as a modal uses `"close"` instead.
- Keep the title centred with a `width: 44` spacer on the side that has no button. A text action on the right (Save / Send / Post) is a second `LiquidButton` with `style={{ width: "auto", minWidth: 64, paddingHorizontal: 14 }}` and a `fontSize: 15, fontWeight: "700"` label in `theme.primary` (`theme.subText` while disabled); give the title `marginHorizontal: 12`.
- The scroll view must feed `scrollY`: `Animated.ScrollView` with `scrollEventThrottle={16}` and `onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}`. A scroll view that is not React Native's `Animated` one (e.g. `KeyboardAwareScrollView`) uses `onScroll={(e) => scrollY.setValue(e.nativeEvent.contentOffset.y)}`.
- Content: `contentContainerStyle={{ padding: 16, paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }}`, `showsVerticalScrollIndicator={false}`, and `keyboardShouldPersistTaps="handled"` when there is an input. Wrap the scroll view in `<AndroidGlassBackdrop style={{ flex: 1 }}>`.
- Modal screens (`presentation: "modal"`): `FeedbackScreen` uses `topInset = Platform.OS === "android" ? insets.top : 0`; the post composer uses the real `insets.top` on both platforms. Use the real inset unless the sheet is known to start below the status bar.
- A screen that hosts a web page uses `WebViewHeader` (solid bar, `56 + insets.top`, hairline bottom border) instead - never floating glass over a WebView.
- Call `useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", …)` on screens that manage the status bar.

Skeleton:

```jsx
export default function ExampleScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50], outputRange: [1, 1, 0], extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8,
                       paddingTop: insets.top, height: 64 + insets.top }}>
          <View style={{ width: 44 }}>
            <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600",
                                                    color: theme.primary, opacity: headerTitleOpacity }}>
            {t("example.title")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop style={{ flex: 1 }}>
        <Animated.ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 24 }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        >
          <Text style={{ fontSize: 14, lineHeight: 20, color: theme.subText, marginBottom: 16, marginHorizontal: 4 }}>
            {t("example.description")}
          </Text>
          <View style={{ backgroundColor: theme.surface, borderColor: theme.border,
                         borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            {/* rows */}
          </View>
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
}
```

(`providerId` on `LiquidButton` / `AndroidGlassBackdrop` in older screens is a leftover no-op.)

### Spacing, radii, borders, shadows

- **Spacing scale**: 4, 8, 12, 16, 24. Screen padding 16. Between cards 12-16; between sections (title + card) 24. Card padding 16. Rows `paddingVertical: 13, paddingHorizontal: 16`. Gap between an icon holder and its text 12. Loose text above cards gets `marginHorizontal: 4` so it lines up with the card's rounded corner.
- **Radii**: cards 16 (20 for a large stand-alone card such as a device card); boxes inside a card 12-14; media tiles 14; inputs 8 (12 for the filled style); full-width buttons 12; chips, pills and segmented controls 999; round buttons and icon holders = half their size.
- **Borders**: `StyleSheet.hairlineWidth` in `theme.border` for cards and row separators (no separator after the last row). 1px only for inputs and outline buttons, 1.5px for a selectable card.
- **Shadows**: cards have none - the hairline border separates them. Only floating elements (the upload bar, sheets, the picker dialog) have one: `shadowColor: "#000"`, offset `{0, 2-4}`, radius 4-12, opacity about 0.15 light / 0.4-0.5 dark, plus `elevation`. In dark mode set `elevation: 0, shadowOpacity: 0` on rounded Android surfaces (the black elevation shadow ignores the radius).

### Typography

Global **Inter** font family (`app/utils/globalFont.js`, `app/assets/fonts/inter/Inter_*.ttf`) across all `<Text>`, `<Animated.Text>`, and `<TextInput>` elements (custom fonts only inside `StyledName`, story overlays, vector icons, and monospace code blocks). Sizes in use:

| Size / weight | Use |
| --- | --- |
| 20 / `"700"` | title field of a composer, big headline |
| 18 / `"600"` | header title |
| 17 / `"700"` | title of a large card |
| 16 / `"500"`-`"600"` | row title, card title, input text (16 / normal for a plain settings row) |
| 15 / `"500"` | values, body rows; 15 / `"bold"` on full-width buttons; 15 / `"700"` header text action |
| 14, `lineHeight: 20` | descriptions and intro paragraphs (`subText`), inline errors |
| 13 | secondary lines under a title, hints; 13 / `"600"` uppercase with `letterSpacing: 0.5` for section titles |
| 12 / `"600"` | chips and badges; 12 normal for small labels |
| 11 | counters, tiny captions |

Weights used: `"500"`, `"600"` (default emphasis), `"700"`/`"bold"` (titles, buttons), `"800"` only for display headlines.

### Components

- **Card**: `{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: "hidden", marginBottom: 16 }`; `padding: 16` unless it holds rows.
- **Section title** (above a card): 13 / `"600"`, uppercase, `letterSpacing: 0.5`, `theme.subText`, `marginBottom: 8, marginLeft: 4`.
- **List row** (inside a card): row, `alignItems: "center"`, `paddingVertical: 13, paddingHorizontal: 16`, hairline bottom border except on the last. Left: a 34x34 circle in `theme.iconBackground` with an `Ionicons` 20 in `theme.primary` (48x48 with a 24 icon on a large card). Text block `marginLeft: 12`: title 16 in `theme.text`, optional second line 12-13 in `theme.subText`. Right: a chevron (`"chevron-forward"` 20-22, `subText`), a value in `subText` 15, a `Switch`, or a text action.
- **Chips / badges**: `paddingHorizontal: 10, paddingVertical: 4` (6 when tappable), `borderRadius: 999`, text 12 / `"600"`. Neutral: `theme.iconBackground` with `theme.text`; highlighted: `theme.primary` with `#fff`. Wrap rows with `flexWrap: "wrap", gap: 6`.
- **Segmented control** (2-3 choices): track `theme.iconBackground`, `borderRadius: 999`, `padding: 3`; each segment `paddingVertical: 6, paddingHorizontal: 16`, radius 999, the active one filled with `theme.background`; text 13 / `"600"`, active `theme.text`, inactive `theme.subText` (`PostEditorTabs`).
- **Primary button** (one per screen or card): full width, `backgroundColor: theme.primary`, `borderRadius: 12`, `padding: 14`, label `#fff` 15 / `"bold"`, `activeOpacity={0.85}`; disabled or busy = `opacity: 0.6`; while busy the label is replaced by `<ActivityIndicator color="#fff" size="small" />`.
- **Destructive button**: same shape filled with `#FF3B30` for the main destructive action of a screen; inside a card use the outline form - `borderWidth: 1, borderColor: "#FF3B30"`, `borderRadius: 999`, `paddingVertical: 12`, icon 18 + label 15 / `"600"` in `#FF3B30`.
- **Secondary / link**: a text-only `TouchableOpacity` (`padding: 12`, centred, label `"600"` in `theme.subText` for "Cancel"; `theme.primary` for a link) or, for a small inline action in a row, plain text 14 / `"600"` with `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}`. Two buttons side by side: `flexDirection: "row", gap: 10`, each `flex: 1`.
- **Inputs**: outlined - `height: 44`, `borderWidth: 1`, `borderColor: theme.border`, `borderRadius: 8`, `paddingHorizontal: 10`, `fontSize: 16`, `color: theme.text`, `placeholderTextColor={theme.subText}`. Borderless inputs sit directly inside a card (the post title and body). Put a label (15 / `"700"`) or a hint (`subText`) above, and the inline error (14, `#FF3B30`) below.
- **Switch**: React Native `Switch` with `trackColor={{ true: theme.primary }}`, in a row whose text block has `flex: 1, marginRight: 12` (title 16 + hint 13 `subText`).
- **Pickers**: `components/Dropdown.js` (centred dialog on a dimmed backdrop, `theme.surface`, radius 16, a tick on the current choice). In a settings row pass `style={{ borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0, borderRadius: 0, backgroundColor: "transparent" }}` and a right-aligned `textStyle` so only the value and the chevron show.
- **Attachment tiles**: 104x104 (76x76 in a compact form), radius 14, hairline border; remove badge top-right = a 24x24 circle `rgba(0,0,0,0.6)` with `Ionicons "close"` 14 white. "Add" tile or button: `theme.iconBackground` fill or a dashed 1.5px `theme.border` outline, icon 22 + label 12 / `"600"`.
- **A user's name** (posts, comments, stories, chat, lists, profile header - anywhere a person is shown): `components/profile/UserNameRow` - never a bare `Text` / `StyledName` with a badge beside it. It is one `flexDirection: "row", alignItems: "center"` line: the name (`StyledName` with the user's `profile_theme`, `numberOfLines={1}`, tail ellipsis, `flexShrink: 1, minWidth: 0`), then the name icon (`NameIcon`, the Pro emoji), the verified tick (`verified`, `verifiedColor={theme.primary}`) and the trailing metadata passed as children (date, role chip), each with `flexShrink: 0`. **Only the name gives way**: a long name ends in "…"; the tick, the icon and the date never drop to a second line and are never cut. Text style goes in `style`, margins / `flex` in `containerStyle`. `variant="compact"` in lists and cards, `"full"` on the profile itself and the sidebar. The avatar beside it goes in `AvatarFrameWrap` with the same theme. `@username` is `components/profile/StyledUsername` (same `theme` and `variant`), which follows the name's style when the user chose that. Pass the theme the API sent for that user (`profile_theme`, or `theme` on a profile) - null-safe, never invent one. Inside a sentence (`<Text>name did something</Text>`) nest `StyledName` and `NameIcon` in the `Text` instead.
- **Banners / notes inside a screen**: row, `gap: 8`, `borderWidth: 1`, `borderRadius: 12`, `padding: 10`, `borderColor: theme.primary`, an 18px icon in `theme.primary`, text 13 with `lineHeight: 18`.

### Feedback

- **Toasts**: `Toast.show({ type: "success" | "error" | "info", text1, text2 })` from `react-native-toast-message`, shown 60px from the top (`topOffset: 60`). **Toast text always comes from the locale files.** Never show `res.data.message` or `error.response.data.message`: the API only writes Vietnamese. For a failed request use `apiErrorMessage(error, t("…fallback"))` (`app/utils/apiMessage.js`); the usual error toast is `text1: t("common.error"), text2: apiErrorMessage(err)`.
- **Confirmations**: `Alert.alert(title, message, [{ text: t("security.cancel"), style: "cancel" }, { text: …, style: "destructive", onPress }])` before anything destructive or hard to undo (log out a device, remove a passkey, discard a draft). `CustomAlert.alert` (`components/CustomAlert.js`) when more than two actions need to be stacked.
- **Inline errors** for a form the user is still filling in (text under the field), a toast for the result of an action.

### Loading, empty and error states

- **Content that is loading** (a screen, a list, a preview): the app's own loader, `<CustomLoading size={…} />` (Lottie, `components/CustomLoading.js`), centred - not `ActivityIndicator`, not a blocking `ProgressHUD`. Keep the header on screen so the user can go back.
- **Inside a button or a row** while its action runs: `<ActivityIndicator size="small" />` in the button's text colour, the control disabled.
- **Media boxes** (image, video, embed still loading): `MediaShimmer` behind the media. `FastImage` (`components/FastImage.js`, the only image component to use for remote images) adds it automatically for images with a fixed size of at least 100x100; pass `shimmer` when the box is sized by aspect ratio or percentage.
- **Pull to refresh**: `RefreshControl` with `tintColor={theme.primary}` and `progressViewOffset={64 + insets.top}` so the spinner appears below the floating header.
- **Uploads** run in the background through `services/uploadQueue.js` and are shown by `UploadStatusBar` - do not add a blocking HUD for them.
- **Empty**: centred `Ionicons` 50 in `theme.subText` + one line of `subText` text (`marginTop: 10`), or just the line in the description style when the page already has an intro.
- **Load error**: one centred line in `theme.subText` (`marginTop: 24`), with pull-to-refresh or a retry pill (`borderWidth: 1`, `borderColor: theme.primary`, radius 999, label `"700"` in `theme.primary`).

### Icons

`Ionicons` from `@expo/vector-icons` (outline variants by default, the filled one for an active state). `MaterialCommunityIcons` only for the Markdown toolbar's formatting glyphs, `FontAwesome6` only for brand logos Ionicons lacks. Sizes: 24 in header buttons, 20 in a 34px holder, 24 in a 48px holder, 22 for stand-alone row/toolbar icons, 18 inside buttons and banners, 14 inside chips and badges. Colour: `theme.primary` for header and row icons, `theme.subText` for chevrons and inactive icons.

### Liquid glass

- Glass is for **floating chrome only**: header buttons (`LiquidButton`), the bottom tab bar and its "+" button, the sidebar, the comment bar, floating pills. Never for cards, lists or anything that scrolls with the content, and never over a WebView.
- **Exception: the chat conversation** (Messenger style). Its header and composer are full-width glass bars docked to the top and bottom edge (`ChatScreen/conversation/ChatGlassBar.js`, hairline on the side facing the messages). Their buttons are `LiquidButton forceNoGlass` with `backgroundColor="transparent"`, never glass on glass. A flat docked composer elsewhere uses `CommentBar variant="flat"` inside such a bar.
- Use `LiquidGlassView` from `components/GlassModules.js` (never the library directly) with `variant="clear"`, `tintColor={glassTint(isDarkMode)}`, `borderRadius` and `{...androidGlassPerfProps}`; its content must be a real child of the glass view. `LiquidGlassView` is `null` when the native module is missing - fall back to a `View` with a translucent `rgba` surface.
- **iOS below 26** has no system liquid glass: with the setting on, `LiquidGlassView` draws `BlurGlassView` there (an `expo-blur` system material + tint + top highlight + hairline edge). Call sites stay the same; never use `expo-blur` directly.
- The **"Liquid glass effect" setting** (off = `liquidGlassEnabled` false) is handled inside `LiquidGlassView`: the default tint becomes `flatSurface(isDarkMode)`, a 90% opaque panel. Call sites must not branch on the setting.
- Keep the number of glass views on screen small on Android (each one is a per-frame shader); `LiquidButton forceNoGlass` exists for screens with many buttons.

### Sheets and modals

- Global sheet: `useBottomSheet().showBottomSheet(content)` (`contexts/BottomSheetContext.js`, `@gorhom/bottom-sheet`, 90% height, `theme.cardBackground`, handle in `theme.border`, 16 padding).
- A custom sheet: top corners radius 20-24, `theme.surface`, a dimmed backdrop (`rgba(0,0,0,0.5)`, 0.7 in dark mode) that closes it on tap.
- Whole screens that are a task (compose, feedback) are stack screens with `presentation: "modal"` and a `"close"` button.

### Motion

- Header: the fade and glass switch described above - nothing else moves.
- Press feedback: `activeOpacity` 0.7 for rows and chips, 0.85 for filled buttons; `LiquidButton` springs to 0.92 scale on its own.
- Expand/collapse inside a list: `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` (enable it on Android as `DevicesScreen` does).
- Things that appear (bars, banners): 180-200ms opacity + a 12px slide, `useNativeDriver: true`. No decorative or looping animation besides the loader.

### Text, language, accessibility

- Every visible string and every `accessibilityLabel` goes through `t()` with the key added to **all three** of `app/i18n/locales/vi.json`, `en.json`, `ru.json` (insert the lines textually). No `t("key") || "Vietnamese fallback"`.
- Russian and Vietnamese strings are longer than English: give text `flex: 1` / `flexShrink: 1` and `numberOfLines`, never a fixed width.
- Tap targets at least 44x44, or add `hitSlop`. Icon-only buttons need an `accessibilityLabel` (`LiquidButton` accepts one); set `accessibilityRole` (`"button"`, `"switch"`, `"tab"`) and `accessibilityState` (`expanded`, `selected`, `checked`) on custom controls.
- Use `useSafeAreaInsets()` for top and bottom padding; never a fixed status-bar or home-indicator height.
- Phone-only assumptions break tablets: use `useResponsiveLayout` (`utils/responsive.js`) for anything sized from the screen width.

### Keeping this section true

Every new or changed screen must follow this section. If a screen you touch does not, bring the part you touch in line with it. When a deliberate, large redesign changes these rules (new header, new card style, new tokens), **update this section in the same commit** - it must always describe the app as it is, not as it was.

---

## 6. Recent work (newest first)

> **Size rules - read before adding an entry.** Max 10 entries, each max 3 lines (~300 chars); adding one drops the oldest (`git log -p -- INFO.md` keeps everything). No file-by-file changelogs or step lists - commits hold that. Record only what the code cannot tell a future agent: rules, gotchas, "needs a new native build", API dependencies. A lasting rule goes in Conventions / Design system, not here. Keep this whole file under ~500 lines / 60 KB; trim in the same commit if you push past it.

- **Lag with scroll depth** (not run on a device): chat collapses runs of off-screen rows (any kind) into one spacer (`MessagesListContent.js` `OffscreenSpacer`; spacer `onLayout` re-derives each row's `y`); Home feed has a stable `renderItem`, `windowSize 3`, `HOME_SCROLL` emitted only near the top.
- **Feed posts: collapsed text fades into "Xem thêm"** (`PostItem.js`): 90px `LinearGradient` over the clipped text, `pointerEvents="none"`.
- **Calls: no more lagging/doubled voice** (`WebRtcBridge.js`, `CallContext.js`): one audio output, HTTP audio relay only after 3 s of transport down, call poll every 5 s once connected. Clear calls over mobile data still need `WEBRTC_TURN_SERVER` in the API `.env`.
- **Markdown tables in posts** (`components/MarkdownTable.js`): `tableRenderers` spread into each `RenderHTML`; needs the API's `TableExtension`; old posts keep old HTML until edited.
- **OTA prompt no longer on every launch** (`services/ota/otaService.js`): an update whose `createdAt` is not newer than the running bundle is `up_to_date`; "Để sau" remembers the update id; a reload that did not take stays quiet.
- **Android liquid glass uses `variant: "clear"`** (`GlassModules.js`); iOS keeps the call site's variant.
- **Print requests from Explore** (`WebAppScreen` `site: "print"`): loads `/explore/print-requests` on the web site.
- **OTA build-number and old-base -> new-base fixes** (`otaService.js`, `patches/expo-updates+55.0.26.patch`, `plugins/withNativeTweaks.js`): live runtime manifest is the source of truth; new binaries always boot their embedded bundle.
