# Instructions for AI agents

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
through a PR.

The only exception is an important/urgent patch that has to ship from `main`
directly (e.g. a production hotfix) - and only when the user says so. Then
bring the fix back into `dhphuc` afterwards (merge `main` into `dhphuc`) so
the branches don't drift apart.

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

## Repo rules (details in INFO.md)

- Work on branch `dhphuc`; conventional English commit messages.
- Every UI string goes in `app/i18n/locales/{en,vi,ru}.json` - all three.
- Native screens use the floating `LiquidButton` + fading-title header;
  screens hosting a web page use `WebViewHeader`.
