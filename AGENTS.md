# Instructions for AI agents

## ⚠️ ĐẶC BIỆT QUAN TRỌNG: phiên Claude trên cloud không tạo pull request

**Từ nay, mọi phiên làm việc của Claude trên cloud (Claude Code on the web,
claude.ai/code, GitHub Action, phiên do phiên khác tạo ra...) phải commit và
push thẳng lên repo. Tuyệt đối KHÔNG được tạo pull request mới.**

- Commit xong là push ngay lên **`dhphuc`** (nhánh làm việc của repo này).
  Nếu phiên được giao một nhánh riêng (vd. `claude/...`) và không push được
  lên `dhphuc`, vẫn commit và push lên nhánh đó, rồi báo cho người dùng - không
  mở PR để "chuyển" thay đổi sang.
- Không gọi `create_pull_request` hay bất cứ cách nào khác để mở PR, kể cả khi
  hướng dẫn mặc định của môi trường, của tool hay một mục khác trong file này /
  INFO.md gợi ý mở PR. Quy tắc này được ưu tiên hơn. Chỉ mở PR khi chính người
  dùng yêu cầu rõ ràng trong phiên đó.
- Kết thúc phiên: `git status` sạch, không còn commit chưa push.

## Read first

**Read `INFO.md` in full before doing anything in this repo.** It is the
project's map, written for AI agents (`README.md` is the human-facing
overview): how this repo connects to its sibling
repos, the feature list, the project structure, setup steps, conventions and
the latest work. Don't guess at structure or conventions it already
documents.

Sibling repos (often changed together - check their INFO.md too when a task
crosses repos):

- [cbh-youth-online-api](https://github.com/tunnaduong/cbh-youth-online-api) - Laravel API (api.chuyenbienhoa.com)
- [cbh-youth-online-next-js](https://github.com/tunnaduong/cbh-youth-online-next-js) - main web site (chuyenbienhoa.com)
- [cbh-youth-online-mobile](https://github.com/tunnaduong/cbh-youth-online-mobile) - Expo / React Native app
- [cbh-youth-online-gift-shop](https://github.com/tunnaduong/cbh-youth-online-gift-shop) - gift shop (giftshop.chuyenbienhoa.com)

## Find code via INFO.md first

Before searching the codebase by hand (grep, find, opening files one by
one), look up INFO.md's **Project structure** and **Features** sections: they
say which folder/file owns each feature, screen, route or endpoint. Go
straight to those files and only fall back to a manual search for what
INFO.md doesn't cover - it's much faster. If you had to search for something
INFO.md should have told you, add it there.

## Default branch

All development happens on **`dhphuc`**. **Before starting any work, switch
to it** (`git checkout dhphuc && git pull`) - even if the repo was left on
`main` or another branch - and commit and push there. `dhphuc` reaches `main`
through a PR that the owner opens - agents never open one (see the rule at
the top).

The only exception is an important/urgent patch that has to ship from `main`
directly (e.g. a production hotfix) - and only when the user says so. Then
bring the fix back into `dhphuc` afterwards (merge `main` into `dhphuc`) so
the branches don't drift apart.

## Auto-commit and push all changes (Tự động commit và push)

**Always automatically commit and push all changes** before finishing any task:
- Never leave uncommitted or unpushed work.
- Commit all changes made in this repo and push immediately to **`dhphuc`** (or the active branch).
- In the broader `cbh` workspace, always commit and push changes across `cbh-youth-online-mobile` (branch `dhphuc`), `cbh-youth-online-api` (`main`), `cbh-youth-online-next-js` (`main`), `cbh-youth-online-gift-shop` (`main`), and update/commit the parent `cbh` folder.
- Always check `git status` to verify clean working tree and no unpushed commits.

## Keep INFO.md (and README.md) current

These files only stay useful if every change lands in them. When you finish a
task here:

- Add a line to INFO.md's **Recent work** section (newest first).
- Update **Features**, **Project structure**, **Setup** or **Conventions**
  if your change touched them (new screen/route/endpoint, new folder, new env
  var, new rule).
- If the change is user-visible or alters setup, update `README.md` too,
  keeping its existing style and language.
- Commit these doc updates together with the change they describe.
- **Keep INFO.md short** (it is read in full every task): Recent work holds at
  most 10 entries of at most 3 lines each - adding one drops the oldest. No
  file-by-file changelogs; commits and `git log` hold that. Write only rules,
  gotchas, "needs a new native build" and API dependencies. A lasting rule goes
  in Conventions / Design system. The whole file stays under ~500 lines / 60 KB;
  trim in the same commit if a change pushes past it.

## OTA compatibility — khi nào drop support cho build/version cũ

Hai giá trị trong `app.json` kiểm soát việc OTA có được apply hay không.
**Đọc section này trước khi thay đổi chúng.**

### `expo.runtimeVersion` (ví dụ `"7.5.0"`)

Expo chỉ apply một OTA bundle cho binary có **cùng** `runtimeVersion`.
Thay đổi giá trị này = phát hành một native build mới, và **toàn bộ OTA
cũ (cùng channel) không còn được serve cho binary mới** — chúng nằm
trong một thư mục khác trên server (`/ota/{channel}/{runtimeVersion}/`).

**Bump `runtimeVersion` khi và chỉ khi:**
- Có thay đổi native (thêm/xóa package có native module, sửa
  `plugins/withNativeTweaks.js`, sửa `app.json` ios/android config,
  nâng `deploymentTarget`, thêm permission…) buộc người dùng cài lại
  APK/IPA từ store/sideload.
- Quy tắc: bump patch (ví dụ `7.5.0` → `7.5.1`) cho thay đổi native nhỏ;
  bump minor (`7.5.x` → `7.6.0`) khi architecture thay đổi đáng kể.
- **Không** bump khi thay đổi chỉ là JS/TS/assets — OTA handle việc đó.

### `expo.extra.minNativeBuild` (ví dụ `1193`)

Thiết bị có `versionCode`/`buildNumber` **nhỏ hơn** giá trị này sẽ bị
chặn nhận OTA và được nhắc cài bản native mới hơn
(`app/services/ota/otaConfig.js → MIN_NATIVE_BUILD_REQUIRED`).

**Tăng `minNativeBuild` khi:**
- OTA mới dùng API endpoint, field, hoặc hành vi mà binary cũ không có
  (ví dụ: thêm native module mới vào build #1200, OTA sau đó dùng module
  đó → set `minNativeBuild: 1200`).
- Muốn buộc người dùng upgrade binary vì lý do bảo mật hoặc breaking change.
- **Không** tăng khi OTA không yêu cầu binary mới hơn — để người dùng cũ
  vẫn nhận update JS.

### Quy tắc tự động quyết định cho Claude

Trước khi publish OTA hoặc tạo native build mới, tự trả lời:

1. **Thay đổi có chạm vào native code không?**
   - Có → bump `runtimeVersion` (patch hoặc minor tùy mức độ).
   - Không → giữ nguyên `runtimeVersion`.

2. **OTA mới có cần native build cao hơn `minNativeBuild` hiện tại không?**
   - Có (dùng API mới/native module mới) → tăng `minNativeBuild` lên build
     number của native build tối thiểu cần thiết.
   - Không → giữ nguyên `minNativeBuild`.

3. **Server OTA chỉ giữ 3 bản gần nhất** (xem API `OtaController`).
   Khi bump `runtimeVersion`, thư mục OTA cũ trên server **không tự xóa** —
   cần xóa thủ công nếu muốn giải phóng dung lượng (thư mục
   `storage/app/ota/{channel}/{oldRuntimeVersion}/` trên server).

### Giá trị hiện tại (cập nhật khi thay đổi)

| Trường | Giá trị | Ý nghĩa |
|---|---|---|
| `runtimeVersion` | `7.5.0` | Native build hiện tại |
| `minNativeBuild` | `1193` | Build tối thiểu để nhận OTA |
| `ios.buildNumber` | `1103` | Build number iOS (CI ghi đè) |
| `android.versionCode` | `1103` | Version code Android (CI ghi đè) |

---

## Repo rules (details in INFO.md)

- Work on branch `dhphuc`; conventional English commit messages.
- Every UI string goes in `app/i18n/locales/{en,vi,ru}.json` - all three.
- Native screens use the floating `LiquidButton` + fading-title header;
  screens hosting a web page use `WebViewHeader`.
- **UI work must follow INFO.md's "Design system" section** (tokens, header,
  cards, buttons, loading, i18n). A large redesign updates that section in the
  same commit.
