import { storage } from "../global/storage";

// One saved draft per account (the app supports switching accounts, and one
// person's half-written post must never show up in another's composer).
//
// Only what survives a relaunch is stored: text, category, privacy and the
// anonymous flag. Attachments are local file URIs that may be wiped from the
// cache at any time, so they're deliberately not part of a draft - images the
// author placed in the text are already uploaded and travel as plain URLs.
const keyFor = (userId) => `postDraft:${userId ?? "anonymous"}`;

export const loadPostDraft = (userId) => {
  try {
    const raw = storage.getString(keyFor(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== "object") return null;
    return {
      title: typeof draft.title === "string" ? draft.title : "",
      content: typeof draft.content === "string" ? draft.content : "",
      subforum: draft.subforum ?? null,
      privacy: typeof draft.privacy === "string" ? draft.privacy : "public",
      anonymous: !!draft.anonymous,
      savedAt: draft.savedAt ?? null,
    };
  } catch (error) {
    return null;
  }
};

export const savePostDraft = (userId, draft) => {
  try {
    storage.set(keyFor(userId), JSON.stringify({ ...draft, savedAt: Date.now() }));
    return true;
  } catch (error) {
    return false;
  }
};

export const clearPostDraft = (userId) => {
  try {
    storage.delete(keyFor(userId));
  } catch (error) {
    // Nothing useful to do - a stale draft is harmless.
  }
};

// A draft with no title and no body isn't worth keeping or restoring.
export const isDraftEmpty = (draft) =>
  !draft || (!draft.title?.trim() && !draft.content?.trim());
