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
- **Chat**: 1-1 and group conversations, realtime via Laravel Echo + Reverb (`ChatSocketContext`, `services/echo`), typing, reactions, replies, forwarding, media gallery, chat backgrounds, group info / invites.
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
      index.js             Bottom tabs: Home, Forum, Create, Chat, Notifications
      HomeScreen, ForumScreen, PostScreen, CreatePostScreen, PostEditScreen, CreateStoryScreen
      ChatScreen/          Conversation list, ConversationScreen, groups, MediaGalleryScreen
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

## 6. Recent work (newest first, as of 2026-10)

> Only the newest entries are kept here, so this file stays short enough to read in full. When adding one, drop the oldest; `git log -p -- INFO.md` has everything that was removed.

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

- **Display fixes and a round of safe optimizations** (not run on a device):
  - **Status bar (Android).** `StatusBarContext` now only ever holds real overrides (the black story viewer, `useStatusBarStyle` screens); with nothing in it `App.js` follows the theme and re-applies after every navigation and theme change. `HomeScreen` used to store the theme's own style in it on focus and restore an old snapshot after a story - a stale value there overrode every screen without a style of its own (Settings after returning from About...) until Home was focused again. The direct `StatusBar.set*` calls in Settings, About, DevConsole and LinkSafety are gone (one writer). `CreateStoryScreen` and the Archive story viewer ask for light icons. **Design system:** never write the theme's bar style into the context and never call `StatusBar.setBarStyle` from a screen; a screen with its own background uses `useStatusBarStyle`.
  - **Story viewer.** The progress bars and the header take their top offset from `insets.top` (`progressContainerStyle` / `headerContainerStyle` on `InstagramStories`, Home and Archive) instead of the library's fixed 44 / 60pt, which put the bars inside the Dynamic Island.
  - **Forum section cards.** The dark veil over a section's picture is `StyleSheet.absoluteFill`; the old rotated box with a fixed shift stopped covering cards wider than a phone's (iPad).
  - **Home header title** (`SameHeader`): no fixed 120pt lines any more; the logo + title block takes its own width up to the space between the two buttons.
  - **Game screen** (`GamePlayScreen`): same header as the gift shop / admin WebView - back walks back inside the page (also Android's back button), X leaves, reload button.
  - **Android keyboard that changes height while open.** `app/utils/keyboardResize.js` (`trackAndroidKeyboardResize(setHeight)`) keeps keyboard-height state right on a resize (Android reports nothing to React Native then; react-native-keyboard-controller does) - used by the chat mention / command popups, the post screen's comment bar, the post editor toolbar and the story text editors. `ConversationScreen` also switches the window to "resize" input mode while focused, the mode the keyboard library needs to move the message bar on a resize (**untested assumption** - if the chat bar misbehaves on Android, remove that one `useFocusEffect`).
  - **Media gallery tab bar** checked, unchanged: native bar only on iPhone with iOS 26+; iPad and Android keep the custom floating bar, like the main tab bar.
  - **Optimizations, same output:** `PostItem` gives `RenderHTML` memoized `source` / styles / renderers (it rebuilt the HTML of every unchanged post on each render); the email-verification alert and modal (Home) and the action menu (Notifications) are rendered as elements, not as component types re-created per render (which remounted their `Modal`s); the ranking's top 3 likewise; Home's scroll handler no longer emits `SET_TABBAR_VISIBLE` (nobody listened) and its `viewabilityConfig` is one constant; the chat tab and the profile no longer fetch the same data twice on opening; the online-status interceptor reads the token only once a minute instead of on every response; the 30-second badge polls skip while the app is in the background; the post loader's animation loop stops with the screen; `console.debug` in the video players became `console.log` (off in release).
  - Left for later, each needs care: memoizing `AuthContext`, `PostItem` reading the whole feed from context, comment rows' `RenderHTML` props, `useCallback` for the big `renderItem`s, native-driver scroll animations, lazy screen loading.
