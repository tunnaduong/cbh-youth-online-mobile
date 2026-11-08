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
    profile/               Profile customization pieces
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

System font everywhere (custom fonts only inside `StyledName` and story overlays). Sizes in use:

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

## 6. Recent work (newest first, as of 2026-11)

- **Unified Fixed Left Section Icons, Right-Aligned Dropdown Triggers & Build 1076 Forced OTA**:
  - `Dropdown.js`: Unified right-alignment behavior across all dropdowns. When `textAlign: "right"`, the touchable container applies `justifyContent: "flex-end"`, tightly clustering the selected option's icon and label with a 6px gap directly adjacent to the chevron down arrow with zero unwanted dead space, while modal sheet option items enforce strict `textAlign: "left"`.
  - `PostComposerLayout.js`: Section row icons kept strictly static and unchanging across option selections (Category row fixed at `albums-outline`, Privacy ("Who can see it") row fixed at `eye-outline`).
  - `SettingsScreen/index.js`: Theme row icon fixed at `color-palette-outline`, Language row icon fixed at `language-outline`. Trigger container adjusted to `alignItems: "flex-end"` to pin the right-aligned dropdown seamlessly against the right edge.
  - `otaService.js`: Refined minimum build/version forced upgrade logic: devices already running at or above `min_build` (1076) without a `max_build` cap are marked up to date, while devices running older builds are forced to upgrade.


- **NewYear2027 Seasonal Icon, Category Row Icons, Tight Dropdown Spacing & AppIcon Reset Header Button**:
  - `Dropdown.js`: Fixed huge spacing between icon and text on right-aligned trigger values (such as theme and category dropdowns) by justifying content to `flex-end` with compact 6px gap and preventing `flex: 1` text stretching. Tightened option icon container spacing (`width: 22, marginRight: 8`) in option rows.
  - `PostComposerLayout.js` (Create & Edit Post): Dynamically updates the left Category row icon based on the active section/category (`getSectionIcon(category.rawCategory || category.category)`), changing dynamically as soon as a user selects a subforum in another section (e.g. `school` for academics, `game-controller` for entertainment, `flag` for union news, `bug` for feedback/bugs).
  - `SettingsScreen/index.js`: Changed theme setting row icon to `color-palette-outline`.
  - `AppIconScreen.js`: Styled the header reset-to-default button with `LiquidButton` matching the back button (`providerId="AppIconScreen"`, `scrollY={scrollY}`, `size={44}`).
  - `NewYear2027 Icon`: Generated high-res assets (`2027-ios.png`, `2027-android.png`) featuring the gold 2027 medallion with the Year of the Goat (Đinh Mùi). Configured `NewYear2027` in `app.json`, `appIcons.js`, and localized preset names across `vi.json`, `en.json`, and `ru.json`.
  - `otaService.js`: Enforced `min_version`, `max_version`, `min_build`, and `max_build` bounds for forced OTA directives, and handled `channel === "all"` to upgrade to the latest build of the device's own channel.


- **Vector Theme Dropdown Icons, Localized Icon Changed Toast & Game/Webview Load Fixes**:
  - `SettingsScreen/index.js` & `Dropdown.js`: Replaced text emojis (`🌓`, `☀️`, `🌙`) with dedicated `MaterialCommunityIcons` vector icons (`theme-light-dark`, `weather-sunny`, `weather-night`) and custom accent colors.
  - `appIcons.js`: Localized the forced app icon change toast and system notification (`appIcon.systemIconChanged`) across `vi.json`, `en.json`, and `ru.json`.
  - `GamePlayScreen.js` & `WebAppScreen/index.js`: Fixed `onShouldStartLoadWithRequest` on Android to support game iframes (`famobi.com`, `is-a.dev`, `github.io`) and allowed all `*.chuyenbienhoa.com` subdomains to prevent webview loading failures.

- **Remote Forced OTA Auto-Update Directives & Management**:
  - `otaService.js`: Added `checkAndExecuteForcedOtaUpdate(otaDirective)` and `syncRemoteOtaConfig(axiosInstance)`. When server sends `ota_update.force = true`, the client immediately checks and executes OTA download + reload, bypassing all client in-app disable toggles (`isOtaEnabled()`, `isStartupCheckEnabled()`).
  - Added native Android Toast (`ToastAndroid.showWithGravity`) and local notification banner alerts (`Notifications.scheduleNotificationAsync`) informing the user during download and automatic reload.
  - `ThemeContext.js`: Background sync runs on initial startup and automatically triggers on app resume (`AppState.addEventListener("change", (state) => state === "active")`).
  - `AppUpdatesScreen.js`: Displays a prominent warning banner when forced OTA is active from the server, and allows manual checks even if OTA toggles were locally disabled.
  - Added localization keys (`ota.forceUpdate*`) across `vi.json`, `en.json`, and `ru.json`.

- **Crash Screen OTA Diagnostics, Human-Designed 20/11 CYO Icon, Native Splash & WelcomeScreen Fix**:
  - **Authentic 20/11 CYO Icon**: Redesigned 20/11 Teachers' Day icon based 100% on the official CYO frog emblem from `cbh-youth-default.png`, adding only modern books with gold accents, golden fountain pen, and a sleek modern '20/11' badge in the top-right corner. Generated dedicated variants for iOS (`teachers-day-20-11.png`) and Android Adaptive (`teachers-day-android.png`) with safe margin framing.
  - **Splash Screen Rules**: Native OS splash screen on Android 12+ (`?android:attr/icon`) and iOS dynamically reflects the active launcher icon, while the in-app `SplashScreen.js` strictly preserves the custom `splash.json` Lottie animation as-is without replacement.
  - **StartupErrorScreen Diagnostics**: Added OTA build number, channel, updateId, and embedded launch status directly into the diagnostic output beside the App version info (`App: 6.4.3 (1062) [OTA Build: ...]`).
  - **WelcomeScreen Fix**: Fixed `ReferenceError: Property 'useSafeAreaInsets' doesn't exist` by importing `useSafeAreaInsets` from `react-native-safe-area-context`.
  - **Settings Theme Dropdown Icons**: Added `🌓` Auto, `☀️` Light, and `🌙` Dark prefix icons in `SettingsScreen/index.js` matching the language dropdown style.
  - **Thumbnail & Custom Icon Reliability**: Switched `AppIconScreen.js` to React Native `Image` with dynamic keys to guarantee zero thumbnail loss on reset, and eliminated native alias re-selection on custom icon upload to prevent unwanted app restarts.


- **Default Icon Variants, 20/11 Teachers' Day Icon, Custom Icon & Launcher Simplification**:
  - **Default Icon & Variants**: Kept current iOS default (`cbh-youth-default.png`) as the official default icon with direct "Đặt lại mặc định" button in hero card and header (disabled/inactive when already default, no separate default card in grid). Added official variants as alternate options: `Dark`, `ClearDark`, `ClearLight`, `TintedDark`, `TintedLight`.
  - **Classic CYO Option**: Kept Classic CYO frog icon (`icon.png`) as an independent selectable option in the collection.
  - **Vietnamese Teachers' Day (20/11) Icon**: Designed a new 1024x1024 icon celebrating Ngày Nhà giáo Việt Nam 20/11 (`teachers-day-20-11.png` / `teachers-day-android.png`) featuring an illuminated open book of knowledge, golden fountain pen, celebratory red roses, and embossed '20-11' medallion on an emerald-to-forest-green gradient.
  - **Custom Icon Support**: Added custom icon upload card with `expo-image-picker` and `expo-image-manipulator` (1:1 square crop, local documents storage, use and delete actions).
  - **Native Plugin Configuration**: Updated `expo-alternate-app-icons` in `app.json` with all 10 alternate presets and cleaned asset paths in `expo-splash-screen` and `ios.icon`.
  - **Localization**: Added copy for 20/11, variants, custom icon, and default states across `vi.json`, `en.json`, and `ru.json`.


- **OS Launcher Alternate App Icons (`expo-alternate-app-icons`) & Min Native OTA Build 1062 Bump**:
  - **OS Launcher Icon Switching**: Configured `expo-alternate-app-icons` in `app.json` plugins for Android `activity-alias` and iOS `CFBundleAlternateIcons`. Supports 5 launcher icons: Default CYO Frog, Classic Edition (`ios-light.png` / `adaptive-icon.png`), Christmas Edition (`christmas-ios.png` / `christmas-android.png`), New Year 2026 Edition (`2026-ios.png` / `2026-android.png`), and School Crest (`school-logo-removebg.png`).
  - **App Icon Settings Screen**: Built dedicated launcher icon switcher in `AppIconScreen.js` with instant "Đặt lại mặc định" (Reset to Default) button, active icon hero card, and clean `FastImage` rendering for all thumbnails.
  - **Revert In-App Icon Overrides**: Preserved all internal app mascots and headers with official `logo.png`.
  - **Bump Min Native Build**: Updated `minNativeBuild` to `1062` in `app.json`.
  - **i18n & Metro Validation**: Localized strings in `vi.json`, `en.json`, and `ru.json`; validated Metro bundling and Babel parse.

- **Fix OTA Channel Downgrade Bug & Metro Asset Resolution**:
  - **OTA Channel Downgrade Bug**: Fixed update availability check in `otaService.js` (`checkUpdateAvailable` and `downloadAndApplyUpdate`). Enforced that upstream build numbers must be strictly higher (`upstreamBuildNumber > currentActiveBuild`) to be eligible for update. Prevents clients on a higher build (e.g. preview) switching to an older production build from seeing a false "equal build" update prompt.
  - **Asset Resolution Fix**: Resolved Metro bundling error in `appIcons.js` by dropping explicit `@1x` scale suffix from image require paths (`cbh-youth-iOS-Default-1024x1024.png`, `cbh-youth-iOS-Dark-1024x1024.png`, etc.) allowing Metro's asset resolver to match physical files properly.

- **Settings Option to Change App Icon & Custom Square Crop Upload**:
  - Added App Icon customization under Settings (`AppIconScreen.js`).
  - **Presets from assets**: CYO Default Frog (`icon.png`), CYO Classic (`cbh-youth-iOS-Default`), CYO Dark (`cbh-youth-iOS-Dark`), Clear Light (`cbh-youth-iOS-ClearLight`), Clear Dark (`cbh-youth-iOS-ClearDark`), Christmas Edition (`christmas-ios.png`), New Year 2026 (`2026-ios.png`), and School Crest (`school-logo-removebg.png`).
  - **Custom Image Upload**: Integrated `expo-image-picker` with `aspect: [1, 1]` and `expo-image-manipulator` to enforce 1:1 square crop dimension, persisting the resulting square icon file to the local documents directory via `expo-file-system/legacy`.
  - **Persistence & ThemeContext**: Sourced synchronously via MMKV (`app_icon_key`, `custom_app_icon_uri`) in `ThemeContext.js` with `setAppIcon`, `setCustomAppIcon`, and `appIconSource`.
  - **i18n**: Localized all strings across `vi.json`, `en.json`, and `ru.json`.
  - **Syntax verified**: All modified and new files compiled cleanly with Babel `babel-preset-expo`.

- **Comprehensive App-wide Screen Modernization & Brand Redesign**:
  - **Menu Screen (`Sidebar.js`)**: Redesigned to match the primary tab look (Home, Explore, Chat, Notifications) with dynamic green ambient glow (`LinearGradient`), CYO frog mascot + radiating doodle action lines (`assets/logo.png`), screen title with sparkle star `✦`, green subtitle, search bar with clear action, Facebook-style profile card with user avatar and badges, 2-column shortcut grid, and grouped section cards.
  - **Point Wallet Sub-screens**: Modernized `DepositScreen.js` and `WithdrawScreen.js` with ambient green top glow, `theme.primary` titles, `chevron-back` (size 24) on floating `LiquidButton`, quick amount preset chips (20k, 50k, 100k, 200k, 500k), and elevated `theme.surface` cards.
  - **Explore Ecosystem**: Modernized `StudyMaterialScreen/index.js`, `StudyMaterialDetailScreen/index.js`, `UploadStudyMaterialScreen/index.js`, `UniversityScreen/index.js`, `QuizScreen/index.js`, and `CustomQuizCreateScreen.js` with ambient glow, fading titles, standard back navigation, and `theme.surface` cards.
  - **Chat Ecosystem**: Modernized `CreateGroupScreen.js`, `AddGroupMembersScreen.js`, `GroupInfoScreen.js`, `MediaGalleryScreen.js`, `NewConversationScreen.js`, and `SeenByModal.js` with ambient glow, `theme.primary` headers, and refined member cards.
  - **Settings & Account Ecosystem**: Modernized `AboutScreen.js`, `BlockedUsersScreen.js`, `SecurityScreen.js`, `AppUpdatesScreen.js`, `DevicesScreen.js`, `PasskeysScreen.js`, `TwoFactorScreen.js`, `StudentVerificationScreen.js`, `NotificationSettingsScreen.js`, `DevConsoleScreen.js`, `PrivacyPolicyScreen.js`, and `TermsOfServiceScreen.js` with ambient green glow, standard floating header, and consistent container styles.
  - **Community, Posts, Reports & Profile Sub-screens**: Modernized `CategoryScreen.js`, `PostScreen/index.js`, `StoryViewersScreen/index.js`, `ProfileDetailScreen/index.js`, `EditProfileScreen/index.js`, `ProfileCustomizerScreen/index.js`, `LinkSafetyScreen/index.js`, `MemberRankingScreen/index.js`, and all multi-step report screens (`ReportScreen/index.js`, `Step2.js`, `Step3.js`, `Success.js`).
  - **i18n & Syntax Validation**: Verified all modified screens with Babel preset `babel-preset-expo` and validated all three translation files (`vi.json`, `en.json`, `ru.json`).

- **Menu Screen Redesign Matching Home, Explore, Chat & Notifications & Revert Blanket Screen Ambient**:
  - Reverted commit `c6885d6a6983e117615db0ce29f8e91c5f19f510` (the blanket screen redesign across 42+ screens) cleanly resolving merge conflicts.
  - Comprehensive redesign of `Sidebar.js` (Menu / Me tab) to match the visual language of `HomeScreen`, `ExploreScreen`, `ChatScreen`, and `NotificationScreen`:
    - **Unified Brand Header**: Frog mascot (`logo.png`) with radiating action doodle lines, large bold title ("Menu"), sparkle star `✦` (`#EAB308`), subtitle ("Tài khoản & Tiện ích"), and circular translucent action buttons (`search-outline` -> `SearchScreen`, `settings-outline` -> `Settings`).
    - **Top Ambient Glow**: Soft light-green ambient glow (`LinearGradient`) at top of screen.
    - **Quick Search Bar**: Modern search bar pill filtering shortcuts, support items, reports, and settings with live matching and sad frog empty state.
    - **Facebook-style Profile Card**: Elevated profile card displaying avatar with `AvatarFrameWrap`, `UserNameRow`, `StyledUsername`, and "Xem trang cá nhân của bạn" action link.
    - **2-Column Grid Shortcuts**: Primary utilities displayed as modern 2-column tiles with vibrant theme colors and tinted icon containers (Bảng tin, Khám phá, Diễn đàn, Chợ quà tặng, Ví điểm, Bài viết đã lưu, Tin tức Đoàn, Bảng xếp hạng, Quản trị viên).
    - **Grouped Section Cards**: Standardized card surfaces with hairline borders and colorful icon badges for Báo cáo (Reports), Hỗ trợ (Support), and Thiết lập & Tài khoản (Settings & Account).
    - **i18n Localization**: Added `subtitle`, `searchPlaceholder`, `shortcuts`, and `noResults` keys to `vi.json`, `en.json`, and `ru.json`.

- **Call Message Card in Chat (Distinguished from Normal Messages like Web)**:
  - Created `app/components/call/CallMessageCard.js` for mobile chat rendering call events (completed calls, missed calls, rejected, cancelled) as elegant centered cards matching the Next.js web client.
  - Included call type icon (phone / video / missed), color-coded badge (red for missed, green for completed), call duration formatting (`mm:ss`), and a one-tap callback button (`startCall`).
  - Integrated into `MessagesListContent.js` via `isCallMessage()` check, excluding call messages from normal message clustering and date separation.
  - Updated conversation list preview in `ChatScreen/index.js` to render call icons and localized call event text.
  - Added translation keys (`call.missedAudio`, `call.missedVideo`, `call.noAnswer`, `call.missed`, `call.ended`, `call.callBack`) to `vi.json`, `en.json`, and `ru.json`.

- **OTA Updates: Bump minimum native binary build required to 1050** (`app.json`, `INFO.md`):
  - Bumped `expo.extra.minNativeBuild` in `app.json` from `1045` to `1050`. Base APK installations older than build 1050 will be required to install the new APK before receiving subsequent OTA bundles.

- **Fix Sequential OTA Upgrades, Colorful Progress Modal & Modern Ambient Redesign for Menu & Forum** (`app/services/ota/otaService.js`, `app/components/ota/UpdatePromptModal.js`, `app/components/Sidebar.js`, `app/screens/MainScreens/ForumScreen/index.js`, `app/i18n/locales/*.json`, `INFO.md`, sibling `cbh-youth-online-api`):
  - **Sequential OTA Bug Fix (API & Client)**: Resolved an issue where updating OTA twice on a single base APK install caused the second upgrade to load the old bundle index.js despite reporting success. Updated `cbh-youth-online-api/app/Http/Controllers/OtaController.php` so `launchAsset.key` is dynamically hashed to its unique content hash (`$bundleHash`) rather than generic string `"bundle"`, preventing native SQLite caching from reusing older bundle disk files. Updated `otaService.js` to allow sequential updates with the same build number or higher as long as `manifest.id !== runningUpdateId` and `upstreamBuildNumber >= currentNativeBuild`.
  - **Vibrant Colorful OTA Download Modal**: Revamped `UpdatePromptModal.js` with top ambient light-green glow, smooth animated progress tracking with real-time percentage badge (`0%` -> `100%`), and a colorful gradient progress bar (`["#10B981", "#06B6D4", "#3B82F6"]`) in a rounded pill track. Added localized `"downloadProgress"` string across Vietnamese, English, and Russian.
  - **Menu Screen Modernization (`Sidebar.js`)**: Added soft ambient green glow (`LinearGradient` `#E8F8EA` / `rgba(20, 83, 45, 0.40)`), modernized 36x36 circular icon holders, unified card surfaces and hairline borders aligning with Home and Explore design standards.
  - **Forum Screen Modernization (`ForumScreen/index.js`)**: Added soft ambient light-green glow at top, modernized category selector into clean pill filters (`styles.tab` with pill radius 999, active `theme.primary` and inactive `theme.surface`), updated section cards to utilize design system surface and border tokens with balanced background tints, and preserved static title and trophy button alignment.

- **Post Composer: Merge add photo and add video into a unified Photo/Video button**:
  - Combined separate image and video picker actions in `PostComposerLayout.js` into a unified `onPickMedia` action ("Ảnh/Video" / `createPost.addMedia` with `images-outline` icon).
  - Wired `pickMedia` in both `CreatePostScreen` and `PostEditScreen` supporting simultaneous photo and video selection with video duration and format validation.

- **Fix ReferenceError: Property 'isDarkMode' doesn't exist across 16 screens/components**:
  - Destructured `isDarkMode` from `useTheme()` in components using ambient glow `LinearGradient` colors (`PostComposerLayout.js`, `WelcomeScreen`, `LanguageSelectScreen`, `FirstLaunchSettingsScreen`, `ForgotPasswordScreen`, `TwoFactorChallengeScreen`, `ActivityScreen`, `ArchiveScreen`, `AddGroupMembersScreen`, `CreateGroupScreen`, `GroupInfoScreen`, `QuizScreen`, `CustomQuizCreateScreen`, `AppUpdatesScreen`, `DevicesScreen`, `PasskeysScreen`).
  - Added missing `insets` definition from `useSafeAreaInsets()` in `WelcomeScreen`.

- **Fix ReferenceError: Property 'theme' doesn't exist in module-level StyleSheet declarations**:
  - Removed accidental references to `theme` in `StyleSheet.create` blocks in `CreateGroupScreen.js` and `WithdrawScreen.js` that caused runtime crashes during initial bundle module loading.

- **Fix WebRTC Calls (Background Push Notifications, Audio Transmission, Dynamic Avatar, OPPO Ringtone & Green Gradient UI)**:
  - **Background & offline incoming calls**: Configured high-priority Expo call push notifications in `cbh-youth-online-api` (`PushNotificationService::sendExpoCallPushNotification`, `CallController::initiate()`, and `GET /calls/active`). On mobile, configured Android notification channel `"calls"` (`importance: MAX`, `bypassDnd: true`, `PUBLIC` lockscreen) in `ExpoNotificationService.js`, and wired push receipt/tap directly into `CallContext.js` via `INCOMING_CALL_PUSH` and `AppState` active checks to wake up and display `IncomingCallModal` immediately.
  - **Audio transmission fix**: Added `mediaCapturePermissionGrantType="grant"` on `<WebView>` in `WebRtcBridge.js` so microphone access is granted properly. Stored `pendingRemoteOffer` and passed it into `ANSWER_INCOMING_CALL` so `setRemoteDescription` completes before `createAnswer()`, and queued incoming ICE candidates until remote description is set (`drainQueuedCandidates`).
  - **Dynamic caller/receiver avatar & name**: Fixed `ActiveCallModal.js` to dynamically identify whether current user is caller or receiver. Outgoing calls now correctly show the callee's avatar, `profile_name`, `@username`, and `profile_theme` instead of displaying the caller's own avatar.
  - **Green gradient background**: Enhanced `ActiveCallModal.js` and `IncomingCallModal.js` with full-screen luxurious deep green gradient backgrounds (`LinearGradient` `["#0c381c", "#072312", "#031209"]`) and ambient top glow (`rgba(34, 197, 94, 0.4)`), plus green gradient background on the floating minimized call pill.
  - **OPPO alarm ringtone & copyright attribution**: Embedded authentic OPPO alarm ringtone (`ringtone_oppo.mp3` / `ringtoneOppoBase64.js`) for mobile incoming calls, updated `cbh-youth-online-next-js` (`public/sounds/ringtone_oppo.mp3`), and added copyright/license attribution in `app/assets/sounds/LICENSE.md`, `public/sounds/LICENSE.md`, `AboutScreen.js`, and locale files (`en.json`, `vi.json`, `ru.json`).

- **WebRTC Call on Mobile, Category Icons in Post Editor & App-wide Screen Ambient Redesign**:
  - **WebRTC Call functionality**:
    - Created `app/services/call/callService.js` connecting to `/v1.0/chat/conversations/{id}/call/initiate`, `/v1.0/chat/calls/{id}/answer`, `/reject`, `/end`, `/signal`, and `/ice-servers`.
    - Created `app/components/call/WebRtcBridge.js` running headless WebRTC engine inside WebView, supporting real-time audio streams, hardware Acoustic Echo Cancellation (AEC), and Web Audio telephone ring/connecting/busy tones.
    - Created `app/components/call/IncomingCallModal.js` with caller avatar, `AvatarFrame`, pulsating wave animation, and accept/reject actions.
    - Created `app/components/call/ActiveCallModal.js` with call duration timer, remote participant avatar/info, Mute mic toggle, Speaker toggle, and minimized floating pill overlay for multitasking.
    - Created `app/contexts/CallContext.js` (`CallProvider`) wired into Echo private channel `App.Models.User.{id}` for incoming calls and `chat.{conversationId}` presence channel for call progression.
    - Wired `ConversationHeader.js` call button in `ConversationScreen.js` to trigger voice/video calls.
  - **Category icons in Create & Edit Post**:
    - Completely expanded `CATEGORY_KEY_MAP`, `SECTION_ICON_MAP`, and `SUBFORUM_ICON_MAP` in `app/utils/forumUtils.js` to map 100% of all categories and subforums to distinctive Ionicons.
    - Updated `getCategoryKey` with normalized, slug, and English translation reverse-lookups.
    - Preserved `rawName`, `rawCategory`, and pre-resolved `icon` in `CreatePostScreen/index.js` and `PostEditScreen/index.js`.
    - Updated `PostComposerLayout.js` to dynamically display the selected category icon in `SettingRow` instead of hardcoded `albums-outline`.
    - Updated `Dropdown.js` trigger button to display the chosen category icon.
  - **Media picker outside composer in HomeScreen**:
    - Updated "Thêm ảnh" button on HomeScreen feed composer card to "Ảnh/Video" (`createPost.addMedia`), opening library with `mediaTypes: ["images", "videos"]` (`autoPickMedia: true`), allowing simultaneous image and video selection.
  - **App-wide Screen Ambient Redesign**:
    - Added CYO ambient green gradient glow (`LinearGradient` `#E8F8EA` / `rgba(20, 83, 45, 0.40)`) across all screens (`ExploreScreen`, `SearchScreen`, `PointWalletScreen`, `MemberRankingScreen`, `ActivityScreen`, `SettingsScreen`, `LikedPostsScreen`, `SavedPostsScreen`, `ArchiveScreen`, `FeedbackScreen`, `PostComposerLayout`).
    - Modernized `ExploreScreen`: removed dark opaque block and school-logo watermark, added ambient glow and sparkle star `✦`.
    - Strictly preserved the floating `LiquidButton` + fading title header architecture according to the design system.
  - **i18n**: Added `call.*` and `createPost.addMedia` to `vi.json`, `en.json`, and `ru.json`.

- **OTA Updates: Bump minimum native binary build required to 1045 & Remove liquid glass from chat**:
  - Bumped `expo.extra.minNativeBuild` in `app.json` to `1045`.
  - Removed liquid glass effect (`LiquidGlassView` and `AndroidGlassBackdrop`) from chat header and composer bar in `ChatGlassBar.js` and `ConversationScreen.js`, utilizing the clean solid and SVG wave patterns without refraction distortion or performance overhead.
  - Completely removed Chat Lite webview mode and related settings toggles across all locales.

- **Forum Header Alignment, Home Photo Shortcut & Sequential OTA Upgrade Chaining** (`app/screens/MainScreens/ForumScreen/index.js`, `app/screens/MainScreens/HomeScreen/index.js`, `app/screens/MainScreens/CreatePostScreen/index.js`, `app/services/ota/otaService.js`, `app/i18n/locales/*.json`, `INFO.md`):
  - **Forum Header Trophy Alignment**: Fixed the member ranking champion/trophy button and header action alignment in `ForumScreen/index.js`. Replaced unbounded row with `headerLeft` (`flex: 1`, `marginRight: 12`) and `headerTitle` (`flexShrink: 1`, `numberOfLines={1}`), alongside rounded 40x40 icon buttons (`headerIconButton`) with theme background tints, preventing the trophy icon from overflowing offscreen on narrow devices.
  - **Auto-open Image Picker from Home**: Tapping "Thêm ảnh" (Add photo) in the modern composer card triggers light haptics, presents an informative toast ("Đang mở thư viện ảnh..."), and passes `autoPickImage: true` to `CreatePostScreen` which automatically launches the photo gallery picker after mounting. Localized across English, Vietnamese, and Russian.
  - **Sequential OTA Chaining Fix**: Fixed an issue where sequential OTA bundles (e.g. 1034 native base APK -> OTA 1035 -> OTA 1036+) could fail to apply or report phantom build numbers. Restricted timestamp gating strictly to matching build numbers (`upstreamBuildNumber === effectiveCurrentBuild`) so strictly higher upstream builds are never blocked by timestamp jitter, and verified active update IDs to avoid recording phantom build numbers when the native runtime has not yet applied a new bundle.

- **Fix chat main screen relative day indicator i18n** (`app/screens/MainScreens/ChatScreen/index.js`, `app/i18n/locales/*.json`):
  - Fixed hardcoded Vietnamese fallback `'Hôm qua'` in `ChatScreen/index.js`'s `formatMessageTime`.
  - Added localized `"yesterday"` and `"today"` to `"chat"` across `en.json`, `vi.json`, and `ru.json` and passed `t` to `formatMessageTime`, ensuring relative time labels properly respect user language settings.

- **OTA Build 1030 in `app.json`, Strict Version Guard, Length Bounds & Chat/Feed Virtualization** (`app.json`, `app/services/ota/*`, `app/screens/MainScreens/ForumScreen/CategoryScreen.js`, `app/components/PostItem.js`, `app/screens/MainScreens/ChatScreen/conversation/MessagesListContent.js`, `app/screens/MainScreens/ChatScreen/ConversationScreen.js`):
  - **Single config point for `minNativeBuild`**: Set to `1030` directly inside `app.json` (`expo.extra.minNativeBuild`), with all scripts, workflows (`ota-update.yml`), and runtime helpers (`otaConfig.js`, `UpdatePromptModal.js`) dynamically reading it from config.
  - **Strict OTA upgrade rule**: Upstream OTA build numbers must be strictly higher than current active build (`Math.max(currentNativeBuild, currentActiveBuild)`). Upstream $\le$ active build is blocked, preventing unwanted downgrade loops when switching from preview to production channel.
  - **CategoryScreen length bounds & FlatList**: Thread titles bounded to 2 lines (`numberOfLines={2}`), category description clamped to 3 lines with expand toggle, and list virtualized with `FlatList` to unmount offscreen topics.
  - **PostItem feed bounds & modal unmounting**: Clamped feed post title to 3 lines, safe HTML bounding with instant "Xem thêm" / "Thu gọn" toggle, and conditionally mounted 5 hidden modals (`SharePostModal`, `ReportModal`, `GiftPointsModal`, `PostVotesModal`, `ImageView`) only when open.
  - **Chat lag spike elimination**: Virtualized messages list in `KeyboardChatScrollView` using exact measured height placeholders (`<View style={{ height: layout.height }} />`) for rows outside a 1200px viewport buffer, unmounting dozens of PanResponders, media, and link cards while preserving zero scroll jumps.

- **Forum Screen Header: Restored classic static header** (`app/screens/MainScreens/ForumScreen/index.js`):
  - Replaced floating glass buttons (`LiquidButton`) and fading scroll title with the classic static header (like webview/subforum screens).
  - Preserves persistent title, back button, member ranking (`trophy-outline`), and new post button (`add`) without floating glass or scroll fading interfering with horizontal section and category tabs.

- **Notification Screen Redesign & Auto-Read on Bell Tap** (`app/screens/MainScreens/NotificationScreen/index.js`, `app/screens/MainScreens/index.js`, `App.js`, `app/i18n/locales/*.json`):
  - **Auto-Read on Tab Tap**: The instant the user taps the notification bell in the bottom bar or enters the Notification screen, all notifications are immediately marked as read (`markAllNotificationsAsRead()`), and the unread count badge is cleared to 0 without requiring the user to press any "mark all as read" button in the top corner.
  - **Redesigned Mascot & Ambient Header**: Integrated a soft ambient light-green glow behind the status bar, featuring the CYO frog mascot with radiating action doodle marks, "Thông báo" bold title, subtitle ("Theo dõi các hoạt động mới nhất từ CYO"), green star sparkle doodle, and a circular equalizer filter/settings button (`options-outline`) routing to `NotificationSettingsScreen`.
  - **4-Category Filter Pills**: Added a horizontal scroll row with active green pill `[ 🔔 Tất cả ]`, and inactive pills `[ 💬 Bài viết ]`, `[ ❤️ Tương tác ]`, and `[ 👥 Hệ thống ]` allowing instant filtering by notification category.
  - **Card-Based Notification Items**: Redesigned each notification into an elegant rounded card with subtle border and elevation, left green vertical accent border on unread items, custom icon/badge indicator on avatar based on notification type (warning, like, comment, story react, points gifted, system reply), author verified badges, admin note display, clock icon with relative timestamp, post thumbnail, and chevron.

- **Explore Screen Redesign & Sticky Search Header (Khám phá)** (`app/screens/MainScreens/ExploreScreen/index.js`, `App.js`, `app/i18n/locales/*.json`):
  - **Sticky Search Header on Scroll**: Pinned the green header (`LinearGradient` with school watermark) at the top using native driver scroll interpolation. When the user scrolls down, the large "Khám phá" title smoothly slides up and fades out, while the pill search bar ("Tìm kiếm trên diễn đàn...") remains pinned and sticky directly below the safe area with drop shadow and rounded bottom corners.
  - **Welcome Hero Card**: Redesigned greeting banner featuring "Chào bạn, hôm nay bạn muốn làm gì...?" with decorative underline doodles, student illustration (`student_girl.png`), halo glow, and floating sparkle accents.
  - **3-Column Feature Cards Grid**: Redesigned 6 feature cards (Chợ tài liệu, Tra cứu điểm thi, Tìm trường ĐH-CĐ, In ấn tài liệu, Đố vui, Game) with pastel color themes, subtle background watermark illustrations, solid squircle icon badges, and circular forward buttons.

- **iOS-style Callout Bubble for Post Copy (Title & Caption)** (`app/components/PostItem.js`, `app/utils/postCopy.js`, `app/i18n/locales/*.json`, `INFO.md`):
  - **Independent Long-press Selection Targets**: Long-pressing either the post title or caption activates an independent text selection highlight for that specific element (`backgroundColor: isDarkMode ? "rgba(255, 255, 255, 0.18)" : "rgba(50, 110, 240, 0.16)"`, `borderRadius: 6`).
  - **Native iOS Callout Menu**: A floating callout capsule (`#1F2024`, rounded pill with downward pointing caret and subtle drop shadow) appears directly above the highlighted target, mimicking the system `UIMenuController` copy bubble.
  - **Target-Specific Actions**:
    - **Title long-press**: Displays `[ 📋 Sao chép ]`. Tapping copies the post title to clipboard with success haptics and toast.
    - **Caption long-press**: Displays `[ 📋 Sao chép ]` (copies cleaned plain-text caption) and, if a title exists, `[ Tất cả ]` (copies both title and caption formatted together).
  - **Seamless Outside Dismiss**: Tapping anywhere outside the callout button immediately dismisses the bubble and clears the selection highlight. Long-pressing the other target seamlessly switches selection.

- **iOS Build / CocoaPods: Fix New Architecture environment and remove unused `@mattermost/react-native-paste-input`** (`package.json`, `package-lock.json`, `plugins/withNativeTweaks.js`, `INFO.md`):
  - **Removed unused `@mattermost/react-native-paste-input`**: The package was previously disabled in `app/utils/pastedImages.js` (`PasteInputComponent = null`) due to fatal SIGSEGV crashes caused by Fabric shadow node casting conflicts with `react-native-live-markdown`. Removing this unused package eliminated redundant native code and resolved invalid podspec errors during local `npx expo run:ios`.
  - **Injected `RCT_NEW_ARCH_ENABLED` in `Podfile` via `withPodfileTweaks`**: `plugins/withNativeTweaks.js` now automatically injects `ENV['RCT_NEW_ARCH_ENABLED'] ||= '1'` into `Podfile` during `expo prebuild`. This ensures any podspec checking this environment variable during `use_native_modules!` passes seamlessly without requiring manual terminal environment exports.

- **OTA Updates: Resolve update blocking bug, promote native `checkForUpdateAsync` as primary authority, and fix apply flow** (`app/services/ota/otaService.js`, `app/screens/MainScreens/SettingsScreen/AppUpdatesScreen.js`, `INFO.md`):
  - **Native `checkForUpdateAsync()` as primary authority**: When `Updates.isEnabled` is `true`, `checkUpdateAvailable()` now queries native `Updates.checkForUpdateAsync()` first. Native Expo Updates directly evaluates runtime version, update channel, embedded bundle timestamp, and selection policy. If `isAvailable` is `false`, it cleanly and definitively returns `up_to_date` without false positive prompt loops or needing flawed build number hacks.
  - **Removed fatal `<=` build number blockers**: Removed `upstreamBuildNumber <= currentNativeBuild` and `upstreamBuildNumber <= currentActiveBuild` which completely blocked OTA updates whenever an update bundle was published with the same CI build number as the user's installed APK. Replaced with strictly `<` (`upstreamBuildNumber < currentNativeBuild`) for clean downgrade prevention when a user switches from preview to production channel.
  - **Timestamp and cache-aware direct HTTP fallback**: If the native check is unavailable or fails due to network issues, the direct HTTP fallback now compares `createdAt` timestamps (`data.createdAt` vs running/stored `createdAt`) and active update IDs to accurately determine update availability.
  - **Resilient bundle apply & reload**: In `downloadAndApplyUpdate`, handles `isNew=false` by distinguishing between an update that is already running versus one that was cached in SQLite by Expo's background `ON_LOAD` check, proceeding with reload and persisting `ota_active_created_at` to storage.
  - **UI feedback in AppUpdatesScreen**: Displays `Build <num> (OTA)` when an OTA patch is actively running so users can immediately distinguish an active OTA patch from the embedded base APK.


- **OTA Updates: Diagnostics logging for Debug Console and native applying fix** (`app.json`, `app/utils/devConsole.js`, `app/screens/MainScreens/SettingsScreen/DevConsoleScreen.js`, `app/services/ota/otaService.js`, `app/components/ota/UpdatePromptModal.js`, `app/screens/MainScreens/SettingsScreen/AppUpdatesScreen.js`, `App.js`, `app/i18n/locales/*.json`):
  - **Debug Console OTA logging**: Added an in-memory `otaRingBuffer` in `devConsole.js` capturing all `[OTA]` console outputs even before dev mode is actively toggled, preventing loss of startup diagnostics. Added an `"OTA"` filter chip and blue badge styling in `DevConsoleScreen.js` with full vi/en/ru localization.
  - **Detailed lifecycle logging**: Added granular `[OTA]` logs with timestamps, channel, native/active build numbers, runtime version, HTTP manifest URL/status/directive, native `fetchUpdateAsync()` result (`isNew`, `isRollBackToEmbedded`), local persistence, and app reload invocations across `otaService.js`, `UpdatePromptModal.js`, `AppUpdatesScreen.js`, and `App.js`.
  - **Removed `disableAntiBrickingMeasures`**: Removed `"disableAntiBrickingMeasures": true` from `app.json` which caused Kotlin NullPointerException in `UpdatesConfiguration.kt` whenever headers were updated with null URL.
  - **Resilient bundle apply & reload**: Updated `downloadAndApplyUpdate` to gracefully handle cached/existing bundles (`isNew === false`) and log full stack traces and error codes on failure.


- **OTA Updates: Fix update eligibility, base build threshold, build comparison, and active update persistence** (`app.json`, `app/services/ota/otaConfig.js`, `app/services/ota/otaService.js`, `app/components/ota/UpdatePromptModal.js`, `App.js`, `app/screens/MainScreens/SettingsScreen/AppUpdatesScreen.js`, `.github/workflows/ota-update.yml`):
  - **Eligibility threshold (`minNativeBuild`)**: Lowered `minNativeBuild` from `1014` to `1008` in `app.json`, `otaConfig.js`, and `.github/workflows/ota-update.yml`. Build 1008+ shares the exact same runtime version (`7.4.10`) and native binary modules, allowing installed builds (such as build 1018) to be fully eligible for OTA updates instead of erroneously blocked.
  - **Accurate client build detection**: Updated `getNativeBuildNumber()` in `otaService.js` to inspect `Application.nativeBuildVersion`, falling back to `Constants.expoConfig?.android?.versionCode` and `1018` for resilient numeric resolution.
  - **Removed incorrect build number blockers**: In `otaService.js`, removed `upstreamBuildNumber <= currentNativeBuild` and `upstreamBuildNumber <= currentActiveBuild` filters that falsely flagged incoming OTA bundles whose CI build number matched the APK's versionCode as "up to date". OTA freshness is now accurately verified against `runningUpdateId` (`Updates.updateId || storage.getString(OTA_ACTIVE_UPDATE_ID_KEY)`).
  - **Fixed cold reboot state clearing**: In `syncNativeAndOtaBuild()`, changed condition from `nativeBuild >= storedBuild` to strictly `nativeBuild > storedBuild`. Equal build numbers (e.g. native 1018 and active OTA 1018) now preserve the stored active OTA bundle across reboots.
  - **Modal build interpolation**: Forwarded `currentNativeBuild` through `App.js` and `AppUpdatesScreen.js` into `UpdatePromptModal.js`, and replaced hardcoded fallback `1011` with `currentNativeBuild || getNativeBuildNumber() || 1018` for accurate error messaging.


- **HomeScreen top-left Forum shortcut, Forum header redesign, and remove profile card in Settings** (`app/components/SameHeader.js`, `app/screens/MainScreens/index.js`, `app/screens/MainScreens/ForumScreen/index.js`, `app/screens/MainScreens/SettingsScreen/index.js`):
  - **HomeScreen Forum button**: Updated the top-left button in `HomeScreen` (`SameHeader.js`, `MainScreens/index.js`) from opening the sidebar drawer/tab with a menu icon to directly navigating to `ForumScreen` using the community icon (`people-outline`).
  - **Forum top bar redesign**: Aligned `ForumScreen`'s top bar with the Design System header standards: centered 18pt font-weight 600 title (`t("forum.title")`) with scroll fading, and standardized 44x44 `LiquidButton` components for back, member rankings (`trophy-outline`), and create post (`add`), resolving button misalignment and disproportionate text sizing across both loading and active states.
  - **Settings profile card removal**: Removed the redundant profile summary card from `SettingsScreen/index.js` (now prominently accessible via the full-screen Me/Menu sidebar tab), cleaning up unused profile imports and styles.

- **OTA Updates: Dual-channel support (Production & Preview) and automated CI build from `dhphuc`** (`.github/workflows/ota-update.yml`, `app.json`, `app/services/ota/otaService.js`, `app/screens/MainScreens/SettingsScreen/AppUpdatesScreen.js`, `app/contexts/AuthContext.js`, `app/i18n/locales/*.json`):
  - **Automated CI publishing**: Updated `.github/workflows/ota-update.yml` to trigger on push to both `main` and `dhphuc` branches. Pushes to `dhphuc` automatically build and publish to channel `preview`, while pushes to `main` publish to channel `production`. Manual `workflow_dispatch` allows specifying an arbitrary channel.
  - **Dynamic channel selection**: Enabled `"disableAntiBrickingMeasures": true` in `app.json` `updates` configuration. `otaService.js` manages getting, setting, and persisting `ota_channel` in MMKV (`storage`), defaulting to `"production"`. Dynamically overrides update request headers at runtime using `Updates.setUpdateRequestHeadersOverride({ "expo-channel-name": channel })`.
  - **Modern Channel Selection UI**: `AppUpdatesScreen.js` provides user-friendly cards to toggle between "Chính thức (Production)" (stable release from main) and "Thử nghiệm (Preview)" (early access from dhphuc branch) with badge indicators, radio selection, and instant check-update capabilities.
  - **Session & i18n**: Preserved `ota_channel` across logouts in `AuthContext.js` `clearSessionCaches`. Added localized channel strings and explanations in Vietnamese, English, and Russian.

- **OTA dual-channel auto-check & smooth startup updater; unified CI workflow; full-width chat liquid glass** (`.github/workflows/ota-update.yml`, `app.json`, `app/services/ota/otaService.js`, `app/components/ota/UpdatePromptModal.js`, `App.js`, `app/screens/MainScreens/SettingsScreen/AppUpdatesScreen.js`, `app/screens/MainScreens/ChatScreen/conversation/{ChatGlassBar,ConversationHeader,ChatComposer}.js`, `app/i18n/locales/*.json`):
  - **Unified multi-branch OTA CI workflow** (`.github/workflows/ota-update.yml`): Configured dynamic channel detection from branch name (`dhphuc` -> `preview`, `main` -> `production`). Manual workflow dispatch defaults to empty (auto-resolves from branch unless overridden). The workflow is 100% symmetric and branch-agnostic so merging `dhphuc` into `main` preserves clean branch-aware OTA publishing without merge conflicts.
  - **Fixed OTA update check error on native builds** (`app.json`, `otaService.js`): Removed `disableAntiBrickingMeasures: true` from `app.json` which triggered an Android NPE in `expo-updates` when `UpdatesConfigurationOverride` saved request headers without `updateUrl`. Enhanced `otaService.js` with direct HTTP manifest checking (`/v1.0/ota/manifest`) with JSON fallback before native check, and passes complete `updateUrl` with request headers.
  - **Background OTA check at startup & smooth update modal** (`UpdatePromptModal.js`, `App.js`, `AppUpdatesScreen.js`): `App.js` automatically performs a silent background update check 2s after startup. When an update is detected for the user's selected channel, `UpdatePromptModal` presents release information, channel badge, and timestamp. Tapping "Cập nhật ngay" transitions into a smooth "Đang cập nhật..." state with progress indication, downloads the bundle, and restarts the app seamlessly.
  - **Full-width chat liquid glass header & composer** (`ChatGlassBar.js`, `ConversationHeader.js`, `ChatComposer.js`): Styled `ChatGlassBar` with `width: "100%"`, `alignSelf: "stretch"`, and explicit `borderRadius={0}` to prevent corner cut-off, ensuring the group chat info bar and message input composer span the complete screen width seamlessly without edge clipping.

- **Modern Menu / Sidebar design with floating liquid header, scroll fading title, and Design System cards** (`app/components/Sidebar.js`, `app/components/AccountSwitcher.js`, `app/screens/MainScreens/HomeScreen/index.js`, `app/i18n/locales/*.json`):
  - **Floating header & scroll fade**: Converted the Menu screen to the app's standard native scaffold with an absolute floating header (`64 + insets.top`), `Animated.ScrollView` feeding `scrollY`, and fading screen title (`scrollY.interpolate([0, 10, 50], [1, 1, 0])`). Removed the redundant inner body "Menu" text and the floating settings button on the right (Settings remains easily accessible in the Settings & Account card section).
  - **Home feed composer bar**: Removed the image icon button from the "Bạn đang nghĩ gì?" composer prompt row in `HomeScreen`, leaving the avatar and input prompt pill cleanly stretching across the screen.
  - **Design system alignment**: Replaced legacy `react-native-paper` lists with design system components: 34x34 circular icon holders in `theme.iconBackground` with `theme.primary` Ionicons, hairline border cards (`theme.surface`), uppercase section headers (13pt, `theme.subText`), and an interactive Facebook-style profile card with `AvatarFrameWrap` and "Xem trang cá nhân" shortcut.

- **Me ("Tôi") tab shows full-screen Facebook-style Menu / Sidebar; full avatar with frame in non-liquid tab bar; fix Chat Conversation crash** (`app/screens/MainScreens/index.js`, `app/components/Sidebar.js`, `app/components/CommentBar.js`, `app/utils/pastedImages.js`, `app/i18n/locales/*.json`):
  - **Me tab -> Facebook-style Sidebar**: Tapping the "Tôi" / Me tab button now shows the options Sidebar across the full screen (`Sidebar.js` rendered full-width as a tab screen with user profile header card, utilities, settings, and support). Tapping the user's profile card in the sidebar navigates to their full `ProfileScreen`. The HomeScreen header menu button also navigates directly to this tab, and the old 75% sliding drawer overlay with background glass was retired.
  - **CustomTabBar Me button**: In non-liquid native glass bars (iOS 18 and lower, Android, iPad), the right circular float button now displays the user's avatar icon across the button with their configured avatar frame (`AvatarFrameWrap` with `useOwnProfileTheme`), with no text label.
  - **Fix Chat Conversation crash**: Investigated native crash on Android via adb logcat (`SIGSEGV` null pointer dereference at `0x368` inside `AndroidTextInputShadowNode::setTextLayoutManager` called from `MarkdownTextInputDecoratorShadowNode::overwriteTextLayoutManager`). In React Native Fabric (New Architecture), `live-markdown`'s C++ shadow node casts its child to `AndroidTextInputShadowNode`, which fails when `PasteInput` is wrapped. Removed `inputComponent` prop override and disabled `PasteInputComponent`, allowing `MarkdownTextInput` to wrap standard `TextInput` safely without crashing.

- **Bottom navbar: replace Create ("+") with Me ("Tôi") tab; move Create Post to Home composer bar & Forum headers** (`app/screens/MainScreens/index.js`, `app/screens/MainScreens/ProfileScreen/index.js`, `app/screens/MainScreens/HomeScreen/index.js`, `app/screens/MainScreens/ForumScreen/index.js`, `app/screens/MainScreens/ForumScreen/CategoryScreen.js`, `app/screens/MainScreens/CreatePostScreen/index.js`, `app/i18n/locales/*.json`):
  - **Bottom tabs** (`MainScreens/index.js`): replaced `Create` with `Profile` (`navigation.profile`: `"Tôi"` / `"Me"` / `"Профиль"`). On iOS 26+ native liquid-glass tab bar (`!isCustomTabBar`), it renders the system profile icon (`person.crop.circle.fill` / `person.crop.circle`). On Android, iPad, and iOS < 26 (`CustomTabBar`), the right circular pill renders the user's avatar (`getAvatarUrl(username)`) + `"Tôi"` label with an active highlight ring and re-tap scroll-to-top / reload support (`ProfileScreen` accepts `isTab` and `scrollTriggerRef`).
  - **Create Post entry points**: added a `"Bạn đang nghĩ gì?"` composer prompt row (avatar + prompt pill + image button) at the top of `HomeScreen`'s `ListHeader`, a `+` button in `ForumScreen`'s header, and a `+` `LiquidButton` in `CategoryScreen`'s `SubforumHeader` (which passes `categoryId` to `CreatePostScreen` to pre-select that subforum).

- **Self-hosted OTA Updates via expo-updates** (`.github/workflows/ota-update.yml`, `app.json`, `app/services/ota/otaService.js`, `app/screens/MainScreens/SettingsScreen/AppUpdatesScreen.js`, `app/screens/MainScreens/SettingsScreen/index.js`, `app/i18n/locales/*.json`):
  - Configured self-hosted Over-The-Air updates server URL in `app.json` (`updates.url: "https://api.chuyenbienhoa.com/v1.0/ota/manifest"`), with `"expo-channel-name": "production"` request header and `checkAutomatically: "ON_LOAD"`.
  - Added `otaService.js` to manage checking (`checkForUpdateAsync`), downloading (`fetchUpdateAsync`), and reloading (`reloadAsync`) OTA bundles via `expo-updates`.
  - Added dedicated "Cập nhật ứng dụng" item in `SettingsScreen` and created `AppUpdatesScreen.js` displaying the native version, build number, OTA update ID or embedded build status, and a manual "Check for updates" button with restart prompts and i18n support.
  - Added `.github/workflows/ota-update.yml` with manual dispatch to build bundles via `npx expo export`, zip the output, and publish directly to `POST /v1.0/admin/ota/publish` using the `OTA_DEPLOY_TOKEN` secret.


- **Chat conversation: flat Messenger-style header and composer, split into files, typing no longer re-renders the screen** (not run on a device; no API change):
  - **Header** (`conversation/ConversationHeader.js`): one full-width glass bar (`ChatGlassBar`) under the status bar, `56 + insets.top` tall, with a hairline at the bottom. It holds back, the avatar (frame and online dot) with the name and @username / member count left-aligned, and options. It replaces the floating glass pill with the name in it. Tapping the name works as before (profile; group info unless it is the public chat).
  - **Composer** (`conversation/ChatComposer.js`): one glass bar docked to the bottom (the safe-area inset is inside it). It holds the edit banner, the reply strip, then `CommentBar variant="flat"`: image / attach icons, a rounded field in `iconBackground`, and the send icon. It replaces the floating pill. `CommentBar`'s default (`"pill"`) is unchanged, so the post comment bar looks as before.
  - Liquid glass is unchanged; it is now on the two bars. The header buttons are `LiquidButton forceNoGlass` (press spring, no glass of their own), so there are 2 glass views on screen instead of 4.
  - **Smoother typing:** the composer owns the text, the mention / slash-command hooks, their popups and the keyboard height. A keystroke re-renders only it, not the 3,000-line screen and its modals. The screen reads the text from `latestMessageRef` and changes it through `composerRef` (`setText` / `clear` / `restoreIfEmpty`), for edit, send and a failed send. `useMentionInput` / `useSlashCommandInput` no longer set a new empty suggestion list on every keystroke (`keepIfEmpty`).
  - Header, composer and the seen-by modal are memoized and get stable callbacks (`uiHandlersRef` / `uiActions`, like `messageHandlersRef`).
  - The list's bottom padding and the popups' position follow the composer's measured height instead of fixed numbers.
  - **Split:** list, rows, swipe, reaction badge, attachment grid, typing dots, video viewer, helpers and styles moved verbatim from `ConversationScreen.js` to `ChatScreen/conversation/`. New there: `ConversationHeader`, `ChatComposer`, `ChatGlassBar`, `SeenByModal`, `TypingIndicator`. `MediaGalleryScreen` imports `VideoViewerModal` from there; the screen still re-exports it.
  - Fetching / paging, the realtime effect, sending and reactions stay in the screen. They read each other's refs and closures throughout, and moving them would change nothing for the user.
  - New strings `chatConversation.back` and `scrollToLatest` (vi / en / ru).
  - **Follow-up, fewer re-renders of the message list** (same behaviour):
    - Every `setMessages` goes through `reuseUnchanged` (`chatUtils.js`). An entry whose content is unchanged keeps the object already on screen, and the old array is kept when nothing changed at all. A refetch (after each incoming message, read receipt or return to the app) used to rebuild every message from JSON, which re-rendered every bubble. **Rule:** never change a message object in place - always build a new one, or the list will not update.
    - `MessagesListContent` renders a memoized `MessageListItem` per entry and finds neighbours in two linear passes, so one new message re-renders only the rows it touches.
    - Bubble width is worked out once from the window width and passed in (`bubbleMaxWidth`). Every `MessageRow` used to read the window size and re-render on any change of it.
    - `injectTimeHeaders` caches dayjs parsing and formatting per `created_at`. Its output was checked to be identical to the old one on 300 random lists.
    - A typing whisper from someone already shown as typing no longer replaces `typingUsers`, which re-rendered the whole screen every couple of seconds while they typed.
  - **Follow-up, the list lands on the newest message** (not run on a device):
    - `scrollToLatestAndStick(animated, ms)`: a scroll to the end issued right when a message is added ran before the new row and the images above it were laid out. The list stopped short, with the new message half under the composer.
    - For a moment after asking (1 s; 1.5 s when the chat opens), every growth of the content scrolls to the end again (`stickToLatestUntilRef`, checked in `onContentSizeChange`). Starting a drag cancels it, and a load-more never triggers it.
    - Used when sending text, when sending an attachment (which did not scroll at all before), for incoming messages while at the bottom, and when the chat opens.
    - **A message opened from a notification that is older than the first page is now found**: 1.5 s after opening, if it has not shown up, older pages are loaded until it does (`handleJumpToRepliedMessage`, as for a reply). Opening with such a target does not stick to the end.
    - The listed "still open" items of the chat review are done, apart from list windowing. Every loaded message is still rendered; an earlier attempt at windowing was reverted.

- **Keyboard stickers / GIFs / pasted images in comments and chat** (issue #18; not run on a device; **new native package `@mattermost/react-native-paste-input` + a `live-markdown` patch: needs a new native build**; the iOS workflows set `RCT_NEW_ARCH_ENABLED=1` because the package's podspec refuses to install without it - set it too for a local `pod install`):
  - `CommentBar` (comment bar and chat input) now draws its input through `PasteInput`, so images from Gboard / iOS keyboard stickers, GIFs and the paste menu arrive in `onPasteImages` (`app/utils/pastedImages.js`: loaded in a `try`, so an older binary keeps the plain input). They show as a preview in the bar (`selectedImages`) and are sent with **Send**: comments through `commentPostWithImages`, chat through `sendImageMessage` before the text. PNG / GIF / WebP are kept as they are (transparent stickers, animation).
  - The @mention colouring stays: `patches/@expensify+react-native-live-markdown+0.1.334.patch` adds an `inputComponent` prop to `MarkdownTextInput` (default `TextInput`), which `CommentBar` sets to `PasteInput`. **Regenerate the patch when upgrading live-markdown.**
  - iOS needs `PasteInputModule.setup(factory.rootViewFactory)` in `AppDelegate.swift`: `plugins/withNativeTweaks.js` (`withPasteInputSetup`) adds it, through `NSClassFromString` + `perform` (a Swift `import react_native_paste_input` fails to build: the pod has no Clang module). To check on a device first: that the mention highlighting still works inside `PasteInput` (the decorator expects a `ReactEditText` / `RCTTextInputComponentView` child), and that the iOS sticker keyboard's images are delivered.

- **Home feed: no more endless spinner under "you have seen all suggested posts"** (not run on a device): after the personalized feed ran out, `HomeScreen` switched to the latest feed and added the divider, but nothing asked for the first page of it - the divider alone does not make FlatList fire `onEndReached` again. Also, a page whose posts were all delivered already added nothing, so the list did not grow and the spinner stayed. `loadMorePages` (one load at a time via `loadingMoreRef`) now pages until something new arrives (at most 5 empty pages, then it stops when a page is empty), and the exhausted branch calls it for latest page 1 straight away. Used by latest / following / youth-news too.
> Only the newest entries are kept here, so this file stays short enough to read in full. When adding one, drop the oldest; `git log -p -- INFO.md` has everything that was removed.

- **Quiz (Đố vui) result score percentage ring, Force OTA directive & Theme vector icons**:
  - In `QuizScreen/index.js`, replaced the static 360-degree full-bordered circle with a dynamic segmented SVG circular progress indicator using `react-native-svg` (`Svg`, `Circle`, `G`). Accurately displays the exact percentage of correct answers (green `theme.primary`) and incorrect answers (red `#ef4444`) with smooth rounded caps and proportional spacing instead of a solid full border when answers are not 100% correct. Added centered breakdown metrics (`{score}/{total}`, `{percent}%`, `✓ {score}`, `✗ {wrong}`).
  - Added remote Force OTA update execution in `otaService.js` and `ThemeContext.js` with remote config synchronization, Android `ToastAndroid` notifications, and `AppUpdatesScreen.js` status banner.
  - Localized app icon change toast (`appIcon.systemIconChanged`) across `vi.json`, `en.json`, and `ru.json`.
  - Replaced emoji characters in Settings theme selector with dedicated vector icons (`MaterialCommunityIcons`: `theme-light-dark`, `weather-sunny`, `weather-night`) in the selection dialog, while retaining the classic `Ionicons` `moon-outline` icon for the main Settings row button, and updated App Icon row icon to `apps-outline`.
  - Fixed WebView external domain handling for games (`famobi.com`, `is-a.dev`, `github.io`) and allowed all `*.chuyenbienhoa.com` subdomains in `WebAppScreen`.

- **OTA settings switches, unauthenticated check suppression & chat initial avatar fallbacks**:
  - `applyChannelOverride` in `otaService.js` now silently returns when in `__DEV__`, when expo-updates is disabled natively, or when `ota_enabled` is false, eliminating noisy warning logs.
  - Startup OTA update check in `App.js` is now suppressed on unauthenticated screens (welcome/login/signup) by requiring `isLoggedIn`, and respects both `isOtaEnabled()` and `isStartupCheckEnabled()`.
  - Added toggle switches in `AppUpdatesScreen.js` for "Bật cập nhật OTA" and "Kiểm tra khi khởi động", backed by MMKV storage keys `ota_enabled` and `ota_check_startup`, with full i18n support in `vi.json`, `en.json`, and `ru.json`.
  - For chats without avatar (such as support chats, bots, or users without profile pictures), the avatar is replaced with a clean circular thumbnail displaying the capitalized first letter on `theme.iconBackground` across `ChatScreen/index.js`, `ConversationHeader.js`, and `MessageRow.js`.

- **Rename Profile tab label to "Cá nhân" ("Profile")**:
  - Updated `navigation.profile` in `app/i18n/locales/vi.json` from `"Tôi"` to `"Cá nhân"`, and in `en.json` to `"Profile"`.

- **Replace Forum ("Diễn đàn") tab with Explore ("Khám phá") tab**:
  - Main tab navigator in `MainScreens/index.js` now features `Explore` (`ExploreScreen`) as the 2nd tab instead of `Forum` (`ForumScreen`), with compass icons on iOS (`safari.fill`/`safari`) and Android (`compass`/`compass-outline`).
  - `ExploreScreen` updated with tab mode styling (hides back button when in tab bar, adjusts content bottom padding).
  - `ForumScreen` is registered as a stack screen in `App.js` with back button support and accessible directly from `Sidebar.js`.
  - Added `navigation.explore` across `vi.json` ("Khám phá"), `en.json` ("Explore"), and `ru.json` ("Обзор").

- **Liquid glass category & subforum selection bottom sheet modal**:
  - Upgraded `Dropdown.js` from a plain centered modal dialog into a modern liquid-glass bottom sheet modal matching iOS/Android design standards.
  - Features a translucent frosted glass surface (`LiquidGlassView` with `glassTint` and `androidGlassPerfProps`), top pill drag indicator, clover header icon (`MaterialCommunityIcons` "clover"), modal title, and circular close button (✕).
  - Grouped SectionList support with category-themed header icons (`getSectionIcon` in `forumUtils.js`, mapping sections such as "Thông báo", "Học tập", "Giải trí - Xã hội", "Đoàn - Hội", etc.) and outline icons for all subforums (`getSubforumIcon` mapping "Tin tức từ Ban quản trị", "Quy định và hướng dẫn", "Tin tức Đoàn", "THPT", "THCS", "Tiếng Anh", "Ebook", "Học ngoại ngữ", "Văn học", "Âm nhạc", "Hình ảnh đẹp", etc.).
  - Selected state feedback: highlighted active green border (`theme.primary`, 1.5px), primary green tint background, and circular checkmark (`Ionicons` "checkmark-circle").
  - Tactile bottom action confirmation button with `Ionicons` "checkmark" and label `t("dropdown.select", "Chọn")` positioned above home indicators via `useSafeAreaInsets()`.
  - Added `createPost.chooseCategory` and `dropdown.select` across `vi.json`, `en.json`, and `ru.json`.
  - Integrated into `PostComposerLayout.js` for category and privacy selection during post creation & editing.

- **Vietnamese font rendering & lineHeight optimization**:
  - Added explicit `lineHeight` across modal headers, buttons, labels, and channel cards in `UpdatePromptModal.js`, `AppUpdatesScreen.js`, and `FeedbackScreen/index.js` to prevent Vietnamese diacritics / tone marks from being clipped on Android.
  - Added `ota.baseUpdateRequiredBuild` across `vi.json`, `en.json`, and `ru.json` and ensured UI fallback strings are provided so text never displays raw translation keys.

- **Min native build 1014, bug report image upload animations & OTA retry dialog i18n**:
  - `minNativeBuild` bumped to `1014` in `app.json`, `otaConfig.js`, and `ota-update.yml`.
  - Added animated upload indicator (`ActivityIndicator` overlay, status text, checkmark completion, and disabled delete while uploading) for bug report / feedback screenshots (`FeedbackScreen/index.js`).
  - Added `"common.retry"` translation across `vi.json`, `en.json`, and `ru.json` so the update error modal retry button is properly translated.
  - Guarded `applyChannelOverride` in `otaService.js` to prevent unhandled promise rejection warnings when running in environments where expo-updates is not enabled.
  - Added explicit `"enabled": true` under `"updates"` in `app.json`.

- **OTA CI build number alignment with Actions run number**:
  - `ota-update.yml` dynamically queries the latest CI workflow run number (`build-android.yml` / `build-ios.yml`, exactly like the native build's `versionCode` / `buildNumber`) via GitHub Actions API.
  - Updates `app.json` with `scripts/set-build-number.js` before exporting the bundle so the bundled JS manifest reflects the active build number.
  - Passes the actions run build number in `-F "build_number=${BUILD_NUMBER}"` to the publish API endpoint.
  - Updated base `versionCode` and `buildNumber` in `app.json` and `AppUpdatesScreen.js` to `1012`.

- **Version 6.4.3 bump**:
  - `app.json` and `package.json` version bumped to `6.4.3`.
  - UI fallbacks in `AppUpdatesScreen.js` updated to `6.4.3`.

- **Intelligent OTA updates, dynamic channel branching, instant tab teleport & composer avatar frame**:
  - **OTA build & minimum versioning in `app.json`**: `minNativeBuild` is configured in `app.json` (`expo.extra.minNativeBuild`), easily editable (updated to `1009`). `otaConfig.js` and `otaService.js` read this dynamically to block OTA updates and warn the user when their installed APK is below the required base build (`native_base_outdated`). Upstream builds higher than active build upgrade cleanly, while equal/lower builds (and upstream builds $\le$ current native build) are marked `up_to_date` to prevent downgrade loops when switching to production from a newer preview APK.
  - **Runtime header override & reboot persistence**: `"disableAntiBrickingMeasures": true` in `app.json` ensures `UpdatesConfigurationOverride`'s request headers are accepted natively across cold boots and app restarts.
  - **Settings menu & App Updates**: displays `(OTA Version: Build <num>)` instead of raw update ID hash strings.
  - **Sidebar dark theme logout icon**: accurately derives `isDark` so the logout icon's circle uses `"rgba(255, 59, 48, 0.2)"` in dark mode instead of the bright pastel pink `#FDE8E8`.
  - **Auto channel alignment & CI**: `scripts/set-ota-channel.js` switches `expo-channel-name` in `app.json`. `ota-update.yml` ensures the exported manifest matches the branch channel (`preview` for `dhphuc`, `production` for `main`). `build-number.yml` automatically sets `production` channel upon merge into `main`.
  - **APK upgrade override & reboot persistence**: `syncNativeAndOtaBuild()` clears stale OTA state if a newly installed base APK has `nativeBuild >= storedOtaBuild`. Active build and update ID are saved to MMKV storage and persist permanently across reboots.
  - **App Updates screen**: displays original base APK/IPA version and build number alongside active real OTA build details.
  - **Chat glass bar**: Conversation header and composer liquid glass now span 100% full width (`width: "100%"`, `alignSelf: "stretch"`, `borderRadius: 0`).
  - **Instant tab teleport**: Switching from "Tôi" (Profile separated circle) to tabs inside the float bar (Home, Forum, Chat, Notifications) teleports the indicator instantly without sliding animation.
  - **Composer avatar border**: The avatar beside "Bạn đang nghĩ gì?" on Home feed now wraps with `useOwnProfileTheme` + `AvatarFrameWrap` to display user's customized avatar appearance and border.
  - **Bug reports include OTA version**: `FeedbackScreen/index.js` retrieves `getRunningUpdateInfo()` and passes `ota_version` in `submitFeedback` payload and embeds `ota <version>` inside `device_info` for debugging.
  - **i18n**: All UI strings added to `vi.json`, `en.json`, and `ru.json`.

- **iOS 26: the tab bar lost its glass after logging in** (not run on a device; JS only): after a first login, or logging out and in again, the system tab bar (and the glass header buttons) showed bare icons over the feed; a cold start was fine. `MainScreens` (and `SearchScreen`, `Welcome`, `LanguageSelect`, `FirstLaunchSettings`) appeared with `animation: "fade"`, and the JS stack gives every card whose style has an `opacity` the prop `needsOffscreenAlphaCompositing` (`@react-navigation/stack` `Card.tsx`, `hasOpacityStyle`) - on iOS the card is drawn as one offscreen group, where UIKit's glass cannot sample its backdrop and, drawn once during the fade, stays empty. A cold start's first screen is not animated, so it had no such style. These screens now use `FADE_ANIMATION` (`App.js`): `"none"` on iOS, `"fade"` on Android. **Rule:** no `animation: "fade"` (or any opacity card animation) on iOS for a screen that shows glass.

- **Fix: feed update after editing a post used the wrong data path** (not run on a device): `PostEditScreen`'s upload task spread `response.data?.post || response.data` into the feed post, but `updatePost` returns `{message, data, moderation}` - there is no `post` key at the top level, so `data.post` was undefined and the whole response envelope (including `message`, `data`, and `moderation`) was spread into the post object without updating its actual fields. Changed to `response.data?.data || response.data` to reach the topic object.

- **Pro Plus tier (2250 points): your own image as avatar frame and profile frame** (not run on a device; JS only, Babel syntax check; needs the API's PR 57 deployed and migrated):
  - **Tier** `pro_plus`: `TierIcon` (`crown-circle`, pink), `memberTiers` / `memberTierPerks` in the three locales, the milestone list in `ProfileScreen`.
  - **Drawing.** `avatar_frame` / `profile_frame` may be `custom`; the image's address comes from the API as `avatar_frame_url` / `profile_frame_url` (kept by `normalizeTheme`). Avatar: `getAvatarFrame` returns `{ image }` and `AvatarFrame` draws it with `expo-image`, centred at 1.25x the avatar (the API checks its centre is transparent) - so it shows wherever `AvatarFrame` / `AvatarFrameWrap` is used. Profile: `ProfileFrame`'s `CustomFrame` draws it in Skia as a nine-slice border (`useImage`, eight clipped pieces: the outer 25% of each side, corners unstretched, the middle never drawn), thickness 14% of the box's smaller side, 6-40 px. No address = no frame.
  - **Editor** (`ProfileCustomizerScreen`): a "Khung tự tải lên" row under each frame slot - pick an image (`expo-image-picker`, **no cropping and no compression**: either would drop the transparent background), replace, delete; rules from `theme_editor.custom_frames.rules`, lock + points below the tier. An upload is stored at once and puts `custom` in the draft; others see it after Save. Api: `uploadCustomFrame`, `deleteCustomFrame`. Strings: `profileTheme.customFrame*`.
  - Builds from before this change draw no avatar frame for `custom` and draw a custom profile frame as "neon".
- **Home keeps its feed tab; the profile's post list no longer jumps back up** (two shake reports from build 971, iOS 15.8; not run on a device):
  - **Home feed tab.** Posting, editing a post, posting a story and finishing a report reset the stack (`routes: [{ name: "MainScreens" }]`), which mounts a new `HomeScreen` - and the tab was that screen's own state, so it came back on "For you" and loaded the personalized feed whatever had been chosen. `feedMode` now lives in `FeedContext` (per session, not stored across launches) and Home's mount loads that tab (`loadModeFeed(mode)`, also used by the chips). Every full load of a tab takes a number (`feedLoadIdRef`) and an answer for an older one is dropped, so a slow "For you" answer cannot replace the posts of the tab switched to meanwhile. The sign-out reset only runs on the sign-out itself, not on mount for a guest. The chat's "replied to a story" link uses `popTo("MainScreens")` - `navigate` pushed a second copy of the tabs. **Rule:** in this React Navigation version `navigate()` to a screen that is lower in the stack pushes a new one; use `popTo` to go back to it.
  - **Profile posts.** `ProfileScreen` refetches on every focus, and that replaced the whole list with its first 10 posts: after "load more", coming back from a post threw the reader up to posts already passed. The focus refetch now merges the first page into what is loaded (`fetchUserData(userId, { keepLoadedPosts: true })`); the first load and pull-to-refresh still replace. `FeedContext.recentPostsProfile` is one list shared by every mounted profile, so the merge only happens while this screen's posts are the ones in it (`profilePostsOwner`). The list's footer and empty state are passed as elements: as functions they were remounted on every render (each change of the visible post while scrolling), which near the end of the list shortened the content for a moment and moved the scroll position.

- **The game WebView stays on the site** (not run on a device; JS only): a game runs in an `<iframe>` of the site's page, and its ads / "More games" buttons open other sites in a new window - on Android that left the app for the browser. `GamePlayScreen` now has the same guard as `WebAppScreen`: `setSupportMultipleWindows={false}` (new windows load in the WebView) and `onShouldStartLoadWithRequest`, which drops any top-frame load that is not `https://*.chuyenbienhoa.com`; frames inside the page load freely. The web page's iframe sandbox allows pop-ups again (Famobi's games stalled after "Play" without them), so this guard is what keeps the player in the game.

- **Games rotate to landscape** (not run on a device; **new native dep `expo-screen-orientation` → needs a new native build**, lockfile updated): `app.json` `orientation` is now `"default"` (every orientation allowed natively) and the portrait lock is held from JS - `app/utils/orientation.js`: `lockPortrait()` runs at launch (`index.js`), and `GamePlayScreen` calls `allowRotation()` while it is focused and locks portrait again when it loses focus. The plugin's `initialOrientation: "PORTRAIT_UP"` keeps iOS portrait at launch; on Android the app can show landscape for a moment if it is started with the phone held sideways, until `index.js` runs. The module is required optionally, so a JS update on an older build (no native module) stays portrait instead of crashing. Any other screen that should rotate uses the same two calls. On iPad the lock is only honoured with `ios.requireFullScreen`, which is not set.

- **Home feed: "Tin tức Đoàn" tab** (not run on a device; **needs the API's `GET /topics/feed?mode=youth-news`**, pushed to its `main`): a fourth chip beside For you / Latest / Following (`home.youthNews`, vi/en/ru) shows the youth union news subforum, newest first, with the same post cards, load-more and pull-to-refresh as the other tabs (`getNewsFeed`, `feedMode === "youth-news"`, its own `newsPage`). Works for guests. Against an API without that mode (it would answer with the ordinary feed) the tab stays empty instead of showing the wrong posts - it checks `mode: "youth-news"` in the first answer.

- **Violation reports: several violation types; always sent in Vietnamese** (not run on a device; no API change):
  - `ReportScreen/Step2.js`: the type chips toggle (`selectedTypes`), and "Other" adds any number of typed or suggested ones (`selectedTags`) - at most `MAX_VIOLATION_TYPES` (8) together. Step 3 shows them comma-separated in the app's language.
  - What goes to `POST /violation-reports` as `violation_type` is `violationTypeVi`: the same choices looked up by position in `vi.json` (`report.studentViolationTypes` / `classViolationTypes` / `mockViolations`, imported directly, not through `t()`), joined with ", " and cut at the API's 255 characters. Text the reporter typed is sent as typed. **Keep those three lists in the same order in vi / en / ru** - the lookup is by index.

- **Forum section card: the picture reaches the right edge again, and the fade is back** (not run on a device): `sectionBackground` had `width: "100%"`, which `ImageBackground` copies onto its absolutely positioned picture - and there a percentage is measured inside the padding, so the picture stopped 28 short of the card's right edge on every device (what the old "105%" was compensating for). The width is gone (`alignSelf: "stretch"`), so the picture is pinned to all four edges. The veil (`sectionVeil`) is the plain background colour over the left 45% of the card, then fades (70% at 72%) down to a 45% tint at the right edge - never the bare picture, so it stays dark or light with the theme - slightly diagonal - the look of the original design, where the picture shows on the right only - the previous one (94 / 70 / 45%) read as a flat tint with no fade.

- **Chat: the rest of the review - bugs and performance** (not run on a device):
  - **Jump to a replied message** loaded the same page 8 times and pushed `page` 8 ahead (its loop used `page` / `hasMore` / `fetchMessages` from one render). `pageRef` / `hasMoreRef` are now the source for `fetchMessages` (state mirrors them for the UI) and the loop goes through them and `fetchMessagesRef`.
  - **Scroll jump after an empty load-more**: `fetchMessages` clears `pendingLoadMoreAdjustRef` when a load-more brought nothing or failed.
  - **Read receipts** are only sent while the conversation is focused and the app is active (`isFocusedRef`), and are sent when the screen regains focus or the app comes back to the foreground.
  - **Stuck "typing…"**: the realtime effect no longer depends on `refreshOtherUserOnlineStatus` (read through a ref), so it is not torn down - with its typing timers and pending refresh - when that callback changes.
  - A message already brought in by a refresh is not appended a second time when its send answers; no swipe-reply / edit on a message that is still sending; editing reads `latestMessageRef` first (Android composing text); a failed image shows no native error text and can be tapped to load again.
  - **Performance:** `injectTimeHeaders` keeps the same object for a message that is already normalised (it copied every message on every call, re-rendering every row whenever one message arrived); upload progress only updates the list when the percentage moved; the image viewer gets a stable header component and `images` array; the unused header scroll animation (`scrollY`, updated on every scroll event) is gone; the seen-by poll rests while the chat is not in front; the conversation list debounces its realtime refresh (400 ms) and has one separator component; `ChatSocketContext`'s value is memoized.
  - Still open: the composer's text lives in the screen's state, so every keystroke re-renders the screen (rows are memoized against it; moving it needs care with mentions / commands / edit mode); the list renders every loaded message (no windowing, deliberate); a message opened from a notification that is older than the first page is not loaded automatically.

- **Chat: fixes from a read-through of the conversation code** (not run on a device):
  - A text message just sent, and the "sending" bubble of an attachment, were kept in the list with the API's type (`text` / `image`...) instead of the list's `type: "message"` + `content_type`. Until the next refetch, reactions on the new message did not show and it disappeared when another message arrived (the handlers keep `type === "message"` only). Both are normalised like every fetched message now.
  - Sending: the "already sending" guards were inside `try`, so a blocked second tap ran `finally { setSending(false) }` and re-enabled sending mid-request; and the text guard read state, so two quick taps sent twice. Guards are before `try`, the text path uses a ref (`sendingRef`). A failed send puts the text back in the input (unless something new was typed).
  - The conversation list shows the time of the last message (`formatMessageTime` in `ChatScreen/index.js` was an empty placeholder): `HH:mm` today, else `DD/MM` (`DD/MM/YY` for other years).
  - Highlighting a message opened from a notification compares ids as strings; the input bar's keyboard offset is `min(20, insets.bottom)` (it sat below the keyboard's edge for bottom insets between 1 and 19).
  - Known, not fixed here (need more than a small change): jump-to-replied-message refetches the same page (stale `page` in its loop); mark-as-read is sent while the screen is not focused; the scroll can jump after a load-more that returned nothing.

- **Chat conversation: fewer whole-list re-renders** (not run on a device; same behaviour): `ConversationScreen` gave every message row the id of the video that is playing inline, so a video starting or stopping while scrolling re-rendered every message - each row now gets the id only if it is that video (null otherwise; a row only compares it with its own id). The group "seen by" list keeps its array when nothing changed (it was replaced on every message-count change and by every 15-second poll, which made the list walk all messages again).

- **Forum section picture visible across the card; Android glass without the lens** (not run on a device):
  - `ForumScreen`'s section card: the veil over the picture is now the card's background colour at 94% / 70% / 45% from left to right (`sectionVeil`), covering exactly the card. The first fix only made the old, nearly opaque veil fit the card - which hid the picture almost completely.
  - Android liquid glass: **`edgeReflectionStrength: 0`** for every glass view (`ANDROID_NO_EDGE_REFLECTION` in `GlassModules.js`, applied last in `GatedLiquidGlassView`, and in `androidGlassPerfProps`). Found by reading the library's source (react-native-liquid-glassmorphism 1.0.0): its shader has an "edge-reflection band" that folds the picture back at the rim, so the content next to a glass surface appears mirrored inside it (the rows above the tab bar, the photos above the gallery's bar, text beside a button) - and that prop scales only this band. The lens itself (`thickness: 0.4`) is unchanged; a first attempt flattened the whole glass with `thickness: 0`, which was more than needed. Covers the custom tab bar, `LiquidButton`, headers and the media gallery bar, since they all render through that one component. **Design system:** Android glass has no edge reflection; do not pass `edgeReflectionStrength` at a call site.

- **iOS CI: compiler cache** (the next runs show whether it helps; the first one fills the cache): `build-ios.yml` and `simu.yml` set up **ccache** - `apple.ccacheEnabled` is written into `ios/Podfile.properties.json` after prebuild (CI only, so a local build needs no ccache), the cache lives in `~/.ccache` and is saved per run / restored from the latest (`...-ccache-device-` / `-simulator-`), and a "ccache statistics" step prints the hit rate. With ccache on, the Podfile points the whole project's compiler at `$(REACT_NATIVE_PATH)/scripts/xcode/ccache-clang.sh`, a path built from `PODS_ROOT` - which the **share extension** (no pods) does not have, so the first run failed with "unable to spawn process '/../../node_modules/...'"; the step "Point every target at the ccache wrappers" sets `PODS_ROOT` / `REACT_NATIVE_PATH` on every target after `pod install`. **A new native target needs nothing extra as long as that step stays.** The CocoaPods download cache is now restored **before** `pod install` (it used to be restored after, doing nothing). The DerivedData cache was removed from the device build: it was restored and saved (several GB) and then deleted by "Clean DerivedData" before the build. `xcbeautify` is only installed when missing. The Android build already compiles for **arm64-v8a only** (`-PreactNativeArchitectures=arm64-v8a`), unchanged.

- **WebRTC call reliability: 10s connection timeout, active call recovery on reconnect, disallow group & AI calls, remove old synthesizer ringtone**:
  - **10s connection timeout**: Caller tries connecting for 10 seconds in `calling` status; if callee does not acknowledge receipt (`ringing` signal) within 10s due to offline/network failure, call cancels and displays "Không thể kết nối đến người kia".
  - **Active call recovery on reconnect**: `CallContext.js` hooks into Echo socket reconnection (`echo.connector.pusher.connection.bind('connected')`) and `AppState` active transitions to immediately fetch `GET /v1.0/calls/active` and auto-pop up incoming call modal with OPPO ringtone if an active call is ongoing, preventing missed calls during network drops.
  - **Disallow group & AI calls**: Hidden call button in `ConversationHeader.js` when `isGroupConversation` or `isAiConversation`, with matching 422 validation on backend `CallController.php`.
  - **Remove old synthesizer chime & instant ringtone stop**: Completely deleted `playTone(520, 650)` fallback from `WebRtcBridge.js`, and added immediate `STOP_RINGING` signals when answering or receiving `.call.answered`.

- **WebRTC call upgrades: Android lockscreen auto-popup, 60s auto-disconnect, OPPO ringtone & copyright, call message cards**:
  - **Android lockscreen auto-popup & action buttons**: `plugins/withNativeTweaks.js` injects `android:showWhenLocked="true"`, `android:turnScreenOn="true"`, `android:showOnLockScreen="true"`, and `android:inheritShowWhenLocked="true"` on `MainActivity`, and declares `USE_FULL_SCREEN_INTENT`, `WAKE_LOCK`, `VIBRATE`, and `FOREGROUND_SERVICE` in `app.json`. `ExpoNotificationService.js` sets up `incoming_call` notification category with interactive "Trả lời" (opens foreground) and "Từ chối" (background decline) actions, and `calls` channel with `MAX` importance and `USAGE_NOTIFICATION_COMMUNICATION_REQUEST`.
  - **60-second call auto-timeout**: Calls automatically disconnect after 60 seconds (1 minute) if unanswered by the callee, stopping ringing on both caller and callee devices (mobile & web).
  - **Cold-start incoming call handling**: `CallContext.js` inspects `Notifications.getLastNotificationResponseAsync()` on mount to restore and display the incoming call dialog when launched from a killed state.
  - **WebRTC audio & participant avatar fix**: Fixed audio track acquisition and bridge transmission so both ends have clear two-way audio. Outgoing call header displays the callee's avatar and name instead of the caller's own avatar.
  - **Green gradient background**: Active call UI (`ActiveCallModal.js`) features modern deep emerald green gradient (`#064e3b` to `#022c22`) for incoming and active calls.
  - **Authentic OPPO ringtone & copyright attribution**: Added the user-provided OPPO alarm ringtone with proper copyright attribution in `LICENSE.md` and `AboutScreen`.
  - **Chat call system messages**: Call status cards (`CallMessageCard.js`) in chat conversations render custom card UI for missed, rejected, and completed calls with duration.
  - **i18n**: All UI strings added to `vi.json`, `en.json`, and `ru.json`.

- **Modern Home screen redesign (matching Explore, Chat & Notifications)**:
  - Redesigned `HomeScreen/index.js` and updated `MainScreens/index.js` (`headerShown: false` for Home tab) to seamlessly integrate the ambient and playful design system.
  - **Ambient status bar glow**: Added `LinearGradient` emanating from the top status bar into the screen (`#E8F8EA` / `rgba(20, 83, 45, 0.45)`).
  - **Branded mascot header**: CYO frog mascot (`logo.png`) with radiating action marks doodles, bold deep green brand title "CBH Youth", sparkle star `✦`, and localized subtitle (`home.feed`). Mascot tap scrolls to top / reloads feed; long-press opens Feedback screen with haptic feedback.
  - **Glass shortcut buttons**: Circular translucent green buttons in the header for quick access to Forum (`people-outline`, `ForumScreen`) and Search (`search-outline`, `SearchScreen`).
  - **Refined composer card**: Elevated the "Bạn đang nghĩ gì?" row into a modern card with `AvatarFrameWrap` around the user's avatar, soft rounded compose pill with pencil icon, and quick action buttons for Photo ("Thêm ảnh") and Story ("Tạo tin").
  - **Modern stories tray**: Replaced the harsh 10px divider bar with clean card styling, refined "+ Tạo tin" card with green gradient add badge, and rounded friend story preview cards with subtle author avatar frames.

- **Chat screen redesign** (tested on iOS simulator):
  - Redesigned `app/screens/MainScreens/ChatScreen/index.js` matching the CYO green aesthetic mockup.
  - Added ambient top mint/green gradient header (`LinearGradient`) behind the status bar.
  - Header: CYO green frog mascot (`logo.png`) with radiating golden action doodles `\ | /`, bold deep green title "Tin nhắn" (`#15803D` / `#4ADE80`), sparkle doodle `✦`, and circular translucent green buttons for Group (`CreateGroupScreen`) and Add (`NewConversationScreen`).
  - Search & Filter bar: rounded pill container with search icon, text input, clear button, and circular filter button (`options-outline`) supporting quick filter pills ("Tất cả", "Chưa đọc", "Nhóm").
  - Conversation card items: styled individual rounded cards (`borderRadius: 20`, subtle border, shadow) replacing flat separator rows; online dot indicator on avatars; double green checkmark `✓✓` for messages sent by the user and read; green pill badge for unread counts; muted bell icon for muted/casual group chats; localized timestamps ("HH:mm", "Hôm qua", "DD/MM").

- **Server-driven seasonal launcher icon updates (20/11 & Christmas)**:
  - App queries `GET /v1.0/app/config` on launch via `ThemeContext.js` and `appIcons.js:syncSeasonalLauncherIcon`.
  - Icon transitions (TeachersDay during 20/11 week, Christmas before holidays, NewYear2026, or admin override) are calculated and pushed strictly from the server.
  - Automatically and smoothly transitions users who have not explicitly chosen another preset (i.e. on default), with support for server `force: true` to override all users when needed.
  - **Native System Toast & Notification on Forced Switch**: When the server forces an icon change (`force: true`), displays native `ToastAndroid.showWithGravity` (on Android) and triggers an immediate high-priority system notification (for both iOS & Android) notifying the user that the event icon has updated and to re-open the app if the launcher relaunched the process.

- **App Icon Settings simplification: remove custom upload option**:
  - Removed custom gallery image upload section from [`AppIconScreen.js`](file:///data/data/com.termux/files/home/cbh-youth-online-mobile/app/screens/MainScreens/SettingsScreen/AppIconScreen.js) since OS launcher icons on iOS and Android strictly require pre-bundled compiled assets. The screen now cleanly focuses on pre-bundled launcher presets and the default icon reset.

- **20/11 Teachers' Day icon update, bundle size reduction & Settings bugfix**:
  - **New 20/11 Icon**: Integrated the user-provided Gemini-generated 20/11 icon artwork for both iOS full-bleed (`teachers-day-20-11.png`, 1024x1024) and Android adaptive (`teachers-day-android.png`, 1024x1024 with 682px safe zone and background `#FDE6D0`). Shows properly in Settings app icon thumbnails and applies to launcher presets.
  - **Asset Size Optimization**: Removed ~10MB of unused legacy duplicate assets (`cbh-youth-iOS-*`), optimized PNG compression across all launcher icons and adaptive icons, reducing bundle footprint.
  - **SettingsScreen Crash Fix**: Fixed `ReferenceError: Property 'languageCode' doesn't exist` by properly re-declaring `languageCode = i18n.language?.split("-")[0] || "vi"`.

- **Android adaptive launcher icons with safe zone & dynamic theme icon in Settings**:
  - **Android Adaptive Icons**: Generated dedicated Android foreground assets (`*-android.png`) for all launcher presets with artwork centered inside the official 72dp/108dp (682px diameter on 1024x1024 canvas with 171px margins) safe zone. This prevents OEM launcher masks (Samsung OneUI circle, Pixel rounded rectangle, Xiaomi squircle) from cropping edges. Updated `app.json` adaptive icon configuration and `expo-alternate-app-icons` plugin entries with matching background colors.
  - **Reverted native splash override**: Restored native splash screen to use default branding across platforms; preserved user custom splash Lottie animation in `SplashScreen.js` as-is.
  - **Dynamic Theme Icon**: In `SettingsScreen`, the left icon beside the "Theme" setting dynamically updates to match the current theme mode (`contrast-outline` for Auto/System, `sunny-outline` for Light, and `moon-outline` for Dark).

- **Study Material preview images (Chợ tài liệu) like web** (tested on iOS simulator):
  - `StudyMaterialScreen/index.js`: updated document cards with top 4:3 preview image (`material.preview_path`), fallback document placeholder, floating top-right price/status badge ("Miễn phí", "Đã mua", "[X] điểm"), category color dot with relative timestamp (`formatTime`), title, description, author avatar and stats (downloads, views, rating).
  - `StudyMaterialDetailScreen/index.js`: added preview image display fallback when document webview viewer is unavailable.


