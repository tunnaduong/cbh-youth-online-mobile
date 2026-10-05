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
- **Notifications**: Expo push (`services/notifications/ExpoNotificationService.js`, `NotificationContext`), unread badges (`UnreadCountsContext`), tap routing (`utils/notificationRouting.js`).
- **Profile**: profile/detail screens, edit profile, photo gallery (a "Photos" view of the Posts tab: `components/profile/ProfilePhotoGallery.js`, `GET /v1.0/users/{username}/photos`), Discord-style customization (avatar frames, name fonts/effects, profile effects, and at the Pro tier a name icon and a `@username` styled like the name; `ProfileCustomizerScreen`, `components/profile` - `UserNameRow` / `NameIcon` / `StyledUsername` draw a user's name everywhere, `utils/profileTheme.js`), points milestones, member ranking.
- **Points**: point wallet, deposit/withdraw, gift points (`GiftPointsModal`).
- **Explore**: games (web, in WebView), quizzes + custom quizzes, universities, study materials (view/upload).
- **Reports & feedback**: multi-step student/class violation reports (`ReportScreen/ReportNavigator`), bug report / feedback screen, shake-to-report with screenshot (`ShakeToReport`).
- **Web apps in the app**: sidebar entries **Gift shop** (everyone) and **Admin** (only `userInfo.role === "admin"`), both `WebAppScreen` (see §5).
- **Settings**: theme (light/dark/system, liquid glass toggle, video autoplay), language, security, blocked users, notification settings, student verification, about, terms/privacy, dev console, easter egg (long-press About).
- **Other**: share-intent (`expo-share-intent`), OTA updates (`expo-updates`, channels `preview`/`production`), responsive layout for tablets/foldables (`utils/responsive.js`), in-process "cold restart" (`SessionContext`).

---

## 3. Project structure

```
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

- **iOS system surfaces follow the app's theme** (not run on a device): on iOS 26 the tab bar is the system's own (liquid glass), and it was light when the app was set to dark on a phone in light mode (and the reverse) - iOS draws it in the window's appearance, which follows the phone. `ThemeContext` now tells iOS the app's choice with `Appearance.setColorScheme("dark" | "light")`, or `"unspecified"` when the theme is "follow the device". Action sheets, alerts and the keyboard follow too. iOS only. `App.js` also gives `NavigationContainer` a `theme` built from the app's (`navigationTheme`: React Navigation's dark/light base with the app's primary, background, text and border colours) - it used to run with the default light theme always, which is what the system tab bar is built from when the navigator is created again after signing out and in. **Design system:** never read the phone's appearance to style something - use `useTheme()`; while a theme is forced, `useColorScheme()` reports the app's choice.

- **Pushes only for the active account; "new login" push** (not run on a device):
  - The Expo push token used to be unregistered from an effect that ran **after** the sign-out, when requests no longer carried a login - the API ignored it, and the account that was left kept pushing to the phone. `app/utils/pushToken.js` now holds the registered token (`rememberPushToken`, set by `NotificationContext`) and `releasePushToken()` gives it back while the account's token still works: in `signOut`, and in `switchAccount` / `addAccount` for the account being left (a saved account that is not the active one gets no pushes on this phone; it registers again when switched back to).
  - `switchAccount(account, { leavePrevious: false })` is what sign-out's fallback to another saved account uses: the account just logged out has a dead token, so nothing is sent with it (a 401 there would look like an expired session).
  - A push of type `new_login` ("someone just logged in to your account on ...", sent by the API on every login) opens `DevicesScreen` (`notificationRouting.js`).

- **Buttons before login are the app's own** (not run on a device): the wide buttons of the welcome, login, sign-up, forgot-password and two-factor screens were plain `TouchableOpacity` boxes; they are now `AuthButton` (`app/components/AuthButton.js`), a `LiquidButton` underneath - `variant="primary"` (solid brand colour) for the screen's main action, `variant="secondary"` (liquid glass on iOS, plain outlined surface on Android) for passkey / Apple / Google / Facebook and the welcome screen's second button. It takes the button's old stylesheet entry as `style`. The two-factor screen's back button is the same round `LiquidButton` as the login screen's. **Design system:** new wide buttons on these screens use `AuthButton`, not `TouchableOpacity`.

- **First-launch setup resumes; leaving an account ends its web sessions** (not run on a device):
  - Closing the app on "customize your experience" (`FirstLaunchSettingsScreen`) no longer skips it: `app/utils/onboarding.js` keeps an `onboarding_settings_pending` flag from the moment the language is picked until that screen's Continue, and `App.js` starts a signed-out launch on `FirstLaunchSettings` while it is set. It marks "in progress", not "done", so devices set up earlier are not sent through the screen again. The screen has a back button to the language screen (`navigation.replace("LanguageSelect")` - the setup screens replace each other).
  - `switchAccount` and `addAccount` (`AuthContext`) first call `POST /v1.0/web-session/revoke` with the account being left, which ends the web sessions it handed to the WebViews / in-app browser (the account itself stays signed in on the device). Their cookie is dead at once; the next page opened there is handed the new account's session as before.

- **"Customize your experience" screen** (`FirstLaunchSettingsScreen`): a third switch, shake to report (`shakeToReportEnabled`, same setting as in Settings), with its description (`firstLaunchSettings.shakeDescription`); the autoplay text now says chats **and posts**; the liquid glass text no longer calls it frosted glass (it is the see-through, refracting kind). vi/en/ru.

- **Signing out of the app signs its WebViews out too** (not run on a device): the API now ends the web sessions the app handed over when the app logs out (see the API's INFO.md), and the app keeps its "this WebView / in-app browser holds a session" markers (`WEB_SESSION_KEYS`, `app/utils/webSession.js`) across the sign-out wipe in `AuthContext.clearSessionCaches()` - they used to be wiped with everything else, so a guest opening the gift shop afterwards was still signed in as the previous account. With the markers kept, the next page opened there goes through `/auth/set-token?logout=1` first.

- **Videos autoplay by default**: `autoplayVideos` (`ThemeContext`) now starts **on** when nothing is stored; a user who switched it off keeps it off. People who never touched the switch (including on the first-launch settings screen) get autoplay with this build.

- **WebView screens sign in on the first visit** (not run on a device): opening Admin / the gift shop right after logging in showed the site's login form; leaving and coming back worked. The handoff code (`POST /web-session/handoff`) had 4 seconds to arrive and otherwise the page was opened signed out - too short for the first request after a login. Now: a WebView waits up to 15s (`HANDOFF_TIMEOUT_MS` in `app/utils/webSession.js`; the in-app browser keeps 4s), and `WebAppScreen` **hands off again when the page ends up on a login form** (`retryHandoff`, once per visit): a load of the main site's `/login` (`isWebLoginUrl`, which is also where the gift shop sends signed-out visitors) or the page itself reporting that it stayed on `/login` / `/admin/login` for a second (`WEB_LOGIN_PAGE_MESSAGE`, posted by `webViewBootScript` - the sites move there without a page load). `sessionEntryUrl(..., { force: true })` skips the "already handed off" shortcut for that. The screen also no longer asks for two codes when it opens. **Games too** (`GamePlayScreen`): a game page works signed out and never shows a login form, so every CBH page in a WebView also reports when it has loaded without the `auth_token` cookie (`WEB_SIGNED_OUT_MESSAGE`, 1.5s after load, not on `/auth/` pages); both screens then hand off again when the app itself is signed in (`appHasAccount()`), once per visit.

- **A gradient name is as wide as its text** (not run on a device): `StyledName`'s masked gradient (`MaskedGradientName`, the "full" variant) stretched to the width of a column parent, so a short text - an @username under the name - only covered the start of the gradient and a rainbow looked plain red. The masked view now sits in a row (`styles.gradientRow`) that lets it be as narrow as its text; `textAlign` of the text decides where it sits. Applies to names and usernames alike.

- **Username style of its own, sheet headers on iOS, code blocks, passkey error details** (not run on a device):
  - **The @username has its own style** (Pro): `username_font`, `username_effect`, `username_colors` in the profile theme - the same choices as the name's, picked separately. `getUsernameTheme()` (`app/utils/profileTheme.js`) turns them into the theme `StyledName` draws; `StyledUsername` uses it everywhere. In the customizer the "follow the name" switch is replaced by a "Kiểu tên người dùng" slot opening `NameStyleSheet` with `prefix="username"` (one sheet for both). The older `username_style: "name"` is only followed while the username has no style of its own, and is reset when one is applied.
  - **No empty band above headers in iOS sheets**: a `presentation: "modal"` screen - and every screen opened on top of one - is a sheet below the status bar, yet `useSafeAreaInsets().top` still reported the notch. `App.js` wraps every stack screen in `SheetAwareScreen` (`screenLayout`), which sets the top inset to 0 inside a sheet (`isIosSheet()` in `app/utils/modalSheet.js`; **keep its `SCREEN_PRESENTATIONS` map in sync with the `presentation` options in App.js**), and the stack's own header gets `headerStatusBarHeight: 0`. Screens keep using `insets.top` as usual.
  - **Code blocks keep their line breaks**: the HTML renderer collapsed whitespace inside `<pre>`; `preserveCodeBlocks()` (`app/utils/mentionRender.js`, applied by `linkifyMentionsInHtml`, so posts, comments and the composer preview all get it) turns newlines into `<br>` and indentation into non-breaking spaces.
  - **Passkey failures say what the system answered**: `PasskeyError` appends the native error code and message to the "couldn't be used" / "not linked" texts, so a report tells us what failed.

- **Login approval prompt on every app start** (not run on a device): `LoginApprovalPrompt` asks the API for waiting logins when the app opens (and once more 2.5s later), and reads `getLastNotificationResponseAsync()` so a cold start from the push notification opens the dialog straight away - the tap happens before any listener exists.

- **Toasts follow the app theme; passkeys belong to `www.chuyenbienhoa.com`** (not run on a device):
  - `app/components/AppToast.js` is the toast host to mount (instead of the library's `<Toast />`): surface, border and text colours come from the app theme, light or dark; it also works above `ThemeProvider` (the root host in `App.js`). Showing a toast is still `Toast.show(...)`. All 14 hosts were switched. Design system rule: never mount the library's `<Toast />` directly.
  - Passkeys: the API's relying party is now `www.chuyenbienhoa.com` (the bare domain redirects, so Android refused the app's passkey after the system sheet). `app.json` adds `webcredentials:www.chuyenbienhoa.com` - **iOS needs a new build for it**; Android works with the existing build once the API is deployed.

- **Notifications open the right place** (not run on a device): `resolveWebNotificationTarget` in `app/utils/notificationRouting.js` sends a notification whose `data.url` is an admin page (`/admin/...`) to `AdminWebScreen` and a gift shop one (`/giftshop/...`, the shop's host, or a `shop_`/`order_` type) to `GiftShopScreen`, at that page: `WebAppScreen` now takes `route.params.url` (only when it is on the site's hosts; the home button still goes home). A story opened from a notification or a link no longer reopens by itself: `HomeScreen` clears `openStoryId` / `highlightStoryId` once handled (they used to stay in the route and fired again on every reload of the story row).

- **Create / edit post: no empty band above the header on iOS** (not run on a device): both screens are `presentation: "modal"`, which on iOS is a sheet that already starts below the status bar, yet `useSafeAreaInsets().top` still reports the notch. `PostComposerLayout` now uses a top inset of 0 on iOS (the real inset on Android, where the modal is full screen). Rule for any screen opened as an iOS modal sheet: do not add `insets.top`.

- **Tier icon after every name; changeable from Pro** (not run on a device): each member tier has an icon (`app/components/profile/TierIcon.js`: star, bolt, trophy, shield, diamond, crown - same as the web). `NameIcon` (so every `UserNameRow`) shows, in this order: the preset glyph a Pro member picked (`name_icon_emoji`), the tier icon they picked (`name_icon_tier`), else the icon of the tier they are in (`profile_theme.member_tier`, or the row's `tier` prop where the tier comes separately, e.g. the profile header). Below Pro it cannot be changed. The editor's icon picker lists the six tier icons before the presets; the milestones card and the points sheet use the per-tier icons.

- **"Pro" tier (2000 points), one-line names, appearance in more places, profile photo gallery** (bundled by CI, not run on a device):
  - Tier id `pro`, shown as "Thành viên Pro" / "Pro member" / "Участник Pro": name icon (`profile_theme.name_icon`, glyph from the API's `name_icon_emoji`), `@username` drawn like the name (`username_style = name`), emoji / decorative Unicode in names. Editor: new "Name icon & username" section in `ProfileCustomizerScreen`; `EditProfileScreen` shows a hint and a translated error for `errors.profile_name`.
  - `app/components/profile/UserNameRow.js` is **the** way to show a user's name: one line, the name truncates, then name icon, verified tick and trailing content never wrap (see Design system). With `NameIcon.js`, `StyledUsername.js`. Used in posts, comments, stories, chat, search, rankings, votes lists, followers, profile header, sidebar and the settings profile card.
  - Profile: a Posts / Photos switch; photos from `GET /users/{username}/photos` (`ProfilePhotoGallery.js`), full-screen viewer.
  - Still plain because the API sends no theme there: mention suggestions, blocked users, chat user search, reaction lists, game/quiz leaderboards.

- **Name effects everywhere, smooth gradients** (new native package: needs a new build; not run on a device): `StyledName` now shows the effect with `variant="compact"` too (post cards, comments, lists, chat) - there it only uses single-`<Text>` forms (per-letter gradient, colour + text shadow) so it can still be nested in a `<Text>`. With `variant="full"` a gradient / rainbow is the name as a mask over a `LinearGradient` (`@react-native-masked-view/masked-view` 0.3.2), so every colour shows even on a two-letter name; names with emoji and builds without the package (older than `FIRST_BUILD_WITH_MASKED_VIEW`, build 908) fall back to one colour per letter.

- **Create and edit post share one layout that follows the Design system** (bundled by CI, not run on a device): `app/components/PostEditor/PostComposerLayout.js` renders both `CreatePostScreen` and `PostEditScreen` - floating transparent header whose title fades on scroll and whose close / Post-Save buttons are `LiquidButton`s (flat at the top, glass once scrolled), an editor card (title, Write/Preview pills, body, Markdown and Rules chips), a "Post settings" card (category, audience, anonymous switch) and an "Attachments" card, plus a full-width primary button. Theme tokens throughout; `Dropdown`, `MarkdownToolbar`, `PostEditorParts`, `PostPreview`, `VideoThumbnail` restyled to match. New keys `createPost.sectionSettings`, `categoryLabel`, `privacyLabel`, `removeAttachment`. To check on a device first: that the header reacts to scrolling (it relies on `KeyboardAwareScrollView` forwarding `onScroll`). **The new "Design system" section above is mandatory for UI work.**
- **Name effects drawn with plain Text** (not run on a device): `StyledName` no longer uses `react-native-svg`. SVG text painted any glyph it could not turn into a path in black, so part of a rainbow / gradient / outline name (typically the second word) came out black. Gradients are now per-letter colours (`splitGraphemes`, `colorAlong`), outline and toon are stacked copies of the text (`LayeredName`).

- **Two-factor by approval on a logged-in device** (method `device`; not run on a device):
  - Settings: `TwoFactorScreen` has a third switch (`twoFactor.methodDevice`); turning it on asks the password and needs no code (`setupTwoFactorDevice`).
  - Device logging in: `TwoFactorChallengeScreen` shows a two-digit number and waits (`startLoginApproval`, then `getLoginApprovalStatus` every 2.5s until approved / denied / expired), with "send again" and "use a recovery code".
  - Logged-in device: `app/components/LoginApprovalPrompt.js` (mounted in `App.js`) shows a modal with the requesting device, three numbers to pick from, "Not me - deny" and "Later". It refreshes from `GET /two-factor/approvals` on app foreground, on the realtime event `.login.approval` (user channel) and on a push with `data.type = login_approval`.
  - Strings `twoFactor.methodDevice*`, `challengeDevice`, `challengeRecovery`, `approval*`, `useRecoveryCode`, `prompt*` (vi/en/ru).

- **Devices screen redesigned as expandable cards, with the login method** (not run on a device): `DevicesScreen` shows one card per login - icon, device name, "platform version • last active", chips ("This device", login method) - and opens on tap to a boxed list (model, platform + version, login method, logged in, last active) with a "Log out" button. `login_method` / `login_two_factor` come from `GET /sessions`; strings `devices.methods.*`, `devices.model`, `platform`, `version`, `loginMethod`, `withTwoFactor`, `loggedInLabel`, `lastActiveLabel`, `neverActive`, `total` (vi/en/ru).

- **Passkeys are native** (new native module: needs a new build; not run on a device):
  - `react-native-passkey` 3.6.2 shows the system's own sheet - iOS AuthenticationServices, Android Credential Manager. No browser and no web page any more: `app/services/passkey.js` (`loginWithPasskey`, `createPasskey(password)`, `getPasskeys`, `deletePasskey`, `passkeysSupported`, `PasskeyError` with a translated `message` and `cancelled`). The module is loaded in a try block and `NativeModules.Passkey` is checked, so JS that reaches an older binary just reports "not supported".
  - Login: the passkey button on `LoginScreen` calls `POST /login/passkey/options` → system sheet → `POST /login/passkey` (returns the normal login payload; the `app_challenge` / `redeem` hand-off is no longer used by the app). Manage: new `PasskeysScreen` (Settings → Security → Passkey): list, add on this device (asks the password unless the account is a social one), remove. Strings: `passkeys.*` in vi/en/ru.
  - **What must be true outside the app, or the system refuses (`passkeys.errors.notConfigured`)**: the passkeys' relying party is `chuyenbienhoa.com`, so (1) iOS: `webcredentials:chuyenbienhoa.com` in `app.json` `associatedDomains` (added) and `https://chuyenbienhoa.com/.well-known/apple-app-site-association` listing `62H5L8QDTS.com.fatties.youth` under `webcredentials`; (2) Android: `https://chuyenbienhoa.com/.well-known/assetlinks.json` listing `com.fatties.youth` with the SHA-256 of the certificate the APK is signed with, and the API accepting that certificate (`WEBAUTHN_ANDROID_ORIGINS`, `android:apk-key-hash:<base64url sha256>`). Both files are served by the web repo (`public/.well-known/`) and must come from the bare domain **without a redirect**. The fingerprint in both places is the one of `keystores/debug.keystore` (`FA:C6:17:45:…:3B:9C`): **signing with another key (Play Store, a new keystore) means adding its fingerprint to the web file and its hash to the API**, or Android passkeys stop working.

- **CI APK installs again** (`build-android.yml`): installs failed with `INSTALL_PARSE_FAILED_NO_CERTIFICATES … SHA-256 digest of contents did not verify` (an APK altered after signing). The workflow no longer restores `android/app/build` from cache (Gradle could update the previous run's APK in place), runs `apksigner verify` before publishing (an invalid APK fails the build), publishes it as `app-release.apk` plus `app-release.apk.sha256` (`removeArtifacts` drops the previous build's files first), and a newer push cancels an older running build (`concurrency`). The never-built `app-debug.apk` link is gone.
- **Post editor shared by create + edit**: editor logic moved out of `CreatePostScreen` into `app/components/PostEditor/usePostEditor.js` (hook) + `PostEditorParts.js` (tabs, markdown field/preview, toolbar, mentions); `PostEditScreen` now uses the same GitHub-style editor (no drafts when editing).
- **One post options menu**: the "…" menu lives only in `PostItem` (`handleMoreOptions`); `PostScreen`'s header button opens it via the `optionsOpenerRef` prop, so Home, Profile, Archive and the post page always show the same options. Add/change post options there only.
- **Auto sign-out when a login is revoked** (e.g. from the logged-in devices list): `axiosInstance` reports an "Unauthenticated." 401 for the active token (auth-flow endpoints excluded) to `AuthContext.handleSessionRevoked`, which drops the account and switches to another saved one or goes to login. Also listens for `.session.revoked` on `App.Models.User.{id}` (needs the API's `DeviceSessionsRevoked` broadcast) and re-checks the session when the app returns to the foreground.
- **Build number is committed on `main` only** (CI change, not run yet): the Android workflow no longer pushes `chore: build number N` to `dhphuc` after each build - builds just patch `app.json` in their checkout. New `.github/workflows/build-number.yml` commits the latest run number to `main` on each push there. If `main` is protected against pushes from `GITHUB_TOKEN`, that step fails and the number has to be set by hand.
- **Merged `main` into `dhphuc` (PR #32)**: brings the GitHub-style post editor (PR #31: markdown toolbar, preview, drafts in `utils/postDraft.js`, pasted/inline images), `EXPO_PUBLIC_API_URL` for pointing a dev build at a local API, and the bottom-sheet backdrop fix. In `CreatePostScreen`, `handlePost` keeps `dhphuc`'s background upload queue (`startUpload`) and adds the editor's checks: no posting while an inline upload placeholder is pending, the saved draft is cleared once the post is created (inside the task), and the unsaved-changes guard is switched off before the composer closes. New native dep `expo-clipboard` → `npm install` + dev-client rebuild.
- **Sidebar shows the user's own profile appearance** (bundled by CI, not run on a device): the header in `Sidebar.js` wraps the avatar in `AvatarFrameWrap` and renders the name with `StyledName` (`variant="full"`). The theme comes from `app/utils/ownProfileTheme.js` (`useOwnProfileTheme(username, isOpen)`): cached per username in MMKV, refreshed from `GET /users/{username}/profile` when the sidebar opens (at most once a minute), and written by `ProfileCustomizerScreen` on save (`setOwnProfileTheme`).

- **Toasts in the app's language; smaller uploads** (bundled by CI, not run on a device):
  - `app/utils/apiMessage.js` → `apiErrorMessage(error, fallback)`: the API only writes Vietnamese, so its message is shown only when the app is in Vietnamese; otherwise the text comes from `apiError.*` (network, too many attempts, invalid input, not allowed, server) or the caller's translated fallback. Used by the two-factor, devices, two-factor challenge, passkey login and profile-appearance screens and by the upload bar. Success toasts on `TwoFactorScreen` use the app's own strings (`twoFactor.methodDisabled`, `devicesForgotten`, `socialSkipOn/Off`) instead of `res.data.message`. **Rule: never put `res.data.message` in a toast.**
  - Compression (`app/utils/mediaCompression.js`): photos JPEG quality 80 (was 85), story snapshot 90 (was 100), videos 720p **at most 30 fps** at 2.5 Mbps (was 4.7). The 30 fps cap is a native patch, `patches/react-native-compressor+1.19.4.patch` (the library has no option and keeps 60 fps sources at 60) - it must be regenerated when the package is upgraded. Clips under 1 MB are sent as they are.

- **Two-factor: option to skip it on Google/Facebook/Apple logins** (bundled by CI, not run on a device): a switch on `TwoFactorScreen`, shown while two-factor is on (`status.skip_social_login`, `setTwoFactorSocialLogin(skip)` → `PUT /v1.0/two-factor/social-login`; strings `twoFactor.skipSocialLogin*` in vi/en/ru). On by default on the API.

- **Background uploads with a progress bar and notification** (bundled by CI, not run on a device):
  - `app/services/uploadQueue.js`: `startUpload({ kind, task })` runs a post / post edit / story in the background - the composer closes at once and the task (compress → upload → create) reports its stage through `report(stage, { progress, current, total })` in its own flow (throws once the job is cancelled) and `report.progress(...)` from progress callbacks (never throws). `beginUpload()` gives a handle for code that drives the upload itself (chat attachments, which keep their optimistic bubble). A failed post/story stays in the bar with **Retry** (the task is re-run from scratch, so it must only use values captured before the screen closed).
  - `app/components/UploadStatusBar.js` (mounted in `App.js`): floating bar with the step - "Đang nén ảnh…", "Đang nén video 1/2… 40%", "Đang tải lên… 70%", "Sắp xong…" - then the result. Strings: `uploads.*` (vi/en/ru). This is where the user now sees that media is being compressed.
  - Notification: Android gets an ongoing, silent notification (channel `uploads`, updated per stage / 10%); iOS only gets the result, and only when the app isn't on screen. `ExpoNotificationService`'s handler keeps `upload_progress` notifications from showing a banner or playing a sound.
  - **Limit**: it is JS, not a native foreground service - the upload continues in the background only while the OS keeps the process alive (minutes on Android, about 30s on iOS) and does not survive the app being killed.
  - **Known gap**: the composer closes before the server has accepted the post, so a failure that a retry can not fix (validation, moderation) leaves only Retry / Dismiss in the bar - dismissing drops the draft.
  - A progress notification left behind by a killed app is cleared on the next start; `scripts/set-build-number.js --if-higher` keeps the committed build number from going backwards.
  - Account switch: `cancelAllUploads()` (called from `resetSession` in `App.js`) stops running tasks at their next stage, so nothing is created under the other account.
  - Stories: the editor only takes the canvas snapshot, then hands over; the home screen reloads its story row on `STORY_POSTED_EVENT`. `createStory(formData, config)` accepts an axios config (upload progress).
- **More loading placeholders** (not run on a device): `FastImage` has a `shimmer` prop to force the pulsing placeholder for boxes it can't measure (aspect ratio, percentages); used for chat message images/video thumbnails, the chat media gallery grid, game cards, the deposit QR and chat background choices. Embedded players in posts (YouTube/SoundCloud WebViews) pulse while loading, the Easter egg WebView and the full-screen video player show a spinner.

- **Native folders out of git, build number from CI, flat-surface opacity** (CI changes verified by the workflow runs, not locally): `android/` and `ios/` are git-ignored and generated by `expo prebuild` in every workflow (`--no-install`, after `npm ci`); the former hand edits moved to `plugins/withNativeTweaks.js`; `pod.yml` was removed (no `Podfile.lock` to update). Build number = workflow run number (see Setup). With Liquid glass off, panels are now 90% opaque (`flatSurface` in `GlassModules.js`, was 94%).

- **Web sessions follow the app account**: WebViews no longer inject the app's token; they get their own session via the handoff (`sessionEntryUrl`), so the app's device entry stays the app's. Signed out → next page goes through `/auth/set-token?logout=1`; account switch → new handoff revokes the old app-handed session. WebView UA suffix `CBHYouthApp/<version>` lets the devices list label WebView sessions.
- **`react-native-compressor` 1.19.4 and `expo-crypto` ~55.0.17 are now in `package.json`** (plus the compressor's config plugin in `app.json`); the lockfile is produced by the `npm` workflow (`.github/workflows/npm.yml`, manual trigger: runs `npm install` and commits `package-lock.json` to `dhphuc`). 1.x was chosen over 2.x because 2.x also needs `react-native-nitro-modules`. Video compression on Android starts working with the next native build.

- **Review fixes** (not run): `FastImage` only tracks loading for images big enough to show the shimmer (avatars in long lists no longer re-render on load); the fallback forum entry in `PostEditScreen` translates its category header; holding a gradient chip in `ProfileCustomizerScreen` removes that second colour (`profileTheme.gradientCleared` / `gradientClearHint`).

- **Media is compressed on the device before upload** (not run): the API no longer compresses uploads. `app/utils/mediaCompression.js`: photos via `expo-image-manipulator` (1470px wide, quality 85); videos via **`react-native-compressor`, loaded optionally** (720p H.264, 4.7 Mbps) - the package is NOT installed yet: run `npx expo install react-native-compressor` and make a new native build, until then videos are uploaded as they are. On iOS the pickers already export 720p H.264 (`videoExportPreset`). Wired into create/edit post (HUD shows "Đang nén ảnh..." / "Đang nén video i/n..."), chat video messages (info toast) and video stories. Chat/comment photos were already re-encoded at quality 0.85.

- **Post media: photos + videos as one block** (`PostItem.js`, not run): when a post has both, the videos now continue the photo collage edge to edge with square corners and a 3px gap (one video = full width 16:9; two = side by side; three or more scroll sideways at half width), instead of small rounded cards in a padded strip below it.

- **Passkey login, server fonts, gradient colours, story styles, loading placeholders, category headers** (not run; needs the API's `main` and the web's `/auth/passkey` page from web PR 32):
  - **Passkey login** (`app/services/passkey.js`, button on `LoginScreen`): **superseded - passkeys are native now, see the entry at the top.** Was: no native passkey module - the prompt runs on `chuyenbienhoa.com/auth/passkey` in the system auth browser (`WebBrowser.openAuthSessionAsync`), PKCE-style: the app keeps a random secret, sends its sha256 in the URL fragment, gets a one-time code back through `com.fatties.youth://passkey?code=…` and redeems it with the secret (`POST /v1.0/login/passkey/redeem`). A passkey login skips two-factor. Uses `expo-crypto` (comes with `expo-auth-session`; not listed in `package.json`). Passkeys are created/removed on the web: Security → "Passkey" opens the web settings in the in-app browser.
  - **Server-hosted name fonts**: `useNameFont` falls back to `GET /v1.0/name-fonts` (fetched once per run) for keys not bundled in `NAME_FONTS` and loads the `.ttf` from its URL with `Font.loadAsync`, so `flex`, `grotesk` and the other premium fonts need no bundled files and no app update. Their labels come from the editor option (`option.label`).
  - **Gradient theme colours (1500 points)**: `primary_color_2` / `accent_color_2` / `banner_color_2` in `normalizeTheme`; `themeStops()` feeds the banner/surface gradients; the customizer shows a "Màu chuyển sắc" chip under each colour (locked below the tier, from `editor.color_gradient`).
  - **Stories**: `transformStoriesData` keeps the author's `profile_theme` as `profileTheme`; the tray shows the author's avatar frame in place of the plain ring when one is picked (unchanged ring otherwise) and their name font; the viewer header and `StoryViewersSheet` show frame + styled name.
  - **Loading placeholders**: `components/MediaShimmer.js` (pulsing box). `FastImage` shows it behind images with a fixed size of at least 100x100 until they load (smaller ones, e.g. avatars, are untouched); also behind the post image collage, `VideoThumbnail` and `InlineVideoPlayer` instead of flat/black boxes. Full-screen viewers stay black.
  - **Create/edit post**: the category dropdown's group headers (`category`, e.g. "Thông báo", "Học tập") are now translated like the item labels.
- **Name style: 2 effects, new 1500-point tier, translated tier names** (not run; the font note at the end of this entry is superseded by the entry above): effects `rainbow` (static multi-stop gradient here; the web animates it) and `outline` (text colour = `name_colors[0]`, border = `name_colors[1]`) in `getNameEffect` + `StyledName`'s SVG path; the customizer hides the colour swatches for rainbow and shows two for outline. New tier `premium` (1500 points) in `PointsMilestones` and the ProfileScreen milestones sheet. **Tier names now come from i18n** (`memberTiers.<id>` in en/vi/ru, API name as fallback) instead of the API's Vietnamese-only names. **Fonts `flex` (Google Sans Flex) and `grotesk` (Space Grotesk) have labels but no bundled `.ttf` yet**, so they render in the system font on mobile: add static single-weight files to `app/assets/fonts/name` and uncomment the two lines in `app/utils/nameFonts.js`.

- **2FA: several methods at once + recovery-code file** (not run): `TwoFactorScreen` now has one switch per method (email code, authenticator app); both can be on, and adding a second method keeps the existing recovery codes. Recovery codes can be saved as a `.txt` through the share sheet (`expo-file-system/legacy` + `expo-sharing`; the temporary file is deleted afterwards). `TwoFactorChallengeScreen` shows a method picker when the challenge lists more than one (`methods`) and sends the email code on first pick (`email_sent`). Needs the matching API change.

- **2FA settings switch fixes** (`SettingsScreen/TwoFactorScreen.js`; from code review, not run): the switch now follows the step in progress (on while setting up, off while confirming turn-off) and flipping it back cancels that step - before, its value never changed, so it snapped back under the finger and then locked. Cancelling a setup waits for the server before the controls unlock. `PrimaryButton` / `SecondaryButton` / `MethodOption` moved to module level so they are no longer remounted on every render. Also: confirm buttons stay off until their password/code field is filled; "send code" and "forget devices" ignore double taps; `DevicesScreen` asks before logging a device out and its pull-to-refresh spinner is offset below the floating header.

- **Two-factor login, logged-in devices, account-switch fixes** (branch `feat/two-factor-auth`, cut from `dhphuc`; written on a machine without Node: **not run yet**). Needs the API branch of the same name.
  - **Login**: `loginRequest` / `loginWithOAuth` send the remembered `device_token`; when the API answers `two_factor_required`, `LoginScreen` and `SignupScreen` navigate to `TwoFactorChallengeScreen` (auth stack), which verifies the code and calls `signIn`.
  - **Security settings**: the old "under development" row now opens `SettingsScreen/TwoFactorScreen.js` (switch, email code or authenticator app, recovery codes, remembered devices). Authenticator setup shows the key and an "open authenticator app" button (`otpauth://` link) instead of a QR code. New `SettingsScreen/DevicesScreen.js` lists logged-in devices with log-out actions.
  - **Device headers**: `app/utils/deviceInfo.js` builds `X-Client-Platform`, `X-Client-Version`, `X-Device-Name`, `X-Device-Model` (URL-encoded), added in the axios request interceptor; it also stores the remembered-device token in AsyncStorage (`two_factor_device_token`). iOS model is only "iPhone"/"iPad" (no `expo-device`).
  - **Account switch** (reported: crash on opening chat and lag after switching; cause not confirmed without a device): `SafeAreaProvider` and `KeyboardProvider` moved outside the keyed `MultiContextProvider` in `App.js`, and the conversation list cache key is now `conversations_<username>` (`ChatScreen/index.js`, `NewConversationScreen.js`). Not addressed yet: `cached_feed` / `cached_notifications` / `cached_forum` are still un-keyed, and the push token stays registered to the previous account.
  - i18n: new `twoFactor.*` and `devices.*` sections in en/vi/ru.

- **WebView close button**: `WebViewHeader` takes `onClose`; gift shop / admin show an X beside the back arrow. Back walks back through the site, X leaves the screen at once.
- **Forum on tablets**: section cards used a 105%-wide background with a fixed 14px correction that only lined up on phones. They're now 100% wide, capped at the feed's max width, and use `useResponsiveLayout` for width (`ForumScreen`).
- **Media gallery**: compact centered tab pill sized to its 3 tabs.
- **Report flow**: Success step now uses the floating header like steps 1-3.
- **WebView screens**: `WebViewHeader` replaces the floating glass button on gift shop / admin / games / easter egg.
- **Gift shop & admin in the app**: new sidebar entries, `WebAppScreen` signs the WebView in as the current account (follows account switches), syncs the app's light/dark theme (`theme` / `giftshop_theme` localStorage keys), and sets app mode. The gift shop is locked to `giftshop.chuyenbienhoa.com`; admin opens other sites in the in-app browser.
- **App → web sign-in** via one-time handoff codes for the in-app browser (main site + gift shop); depends on the API `web-session` endpoints and each site's `/auth/set-token` page.
- **Headers**: floating scroll-aware headers on newer screens; profile effect flicker fix.
- **Profile**: Discord-style profile customization ported from web; points milestones; opaque surfaces when glass is off.
- **Links**: OG preview cards for pasted links; CBH post/profile links open in-app.
- **Chat/posts**: comment input growth, multi-image download.
- **Platform**: iOS 15 launch crash fix (pod deployment targets), large-screen (tablet/foldable) support.
