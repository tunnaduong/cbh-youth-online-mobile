import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import i18n from "../i18n";

/**
 * Uploads that keep going after the screen that started them is closed -
 * posting, editing a post, a story, a chat attachment. The composer hands its
 * work to startUpload() and leaves; the job compresses, uploads and creates
 * the content while the user does something else, like Facebook's "Posting…"
 * bar.
 *
 * Progress is shown in two places:
 *  - UploadStatusBar (in-app, every platform), fed by subscribeUploads();
 *  - Android: an ongoing notification, updated as the job advances. iOS has
 *    no silent, updatable notification, so it only gets the result, and only
 *    when the app isn't on screen.
 *
 * Limits: this is JS, not a native background service. The upload continues
 * while the app is in the background for as long as the OS keeps the process
 * running (usually minutes on Android, about 30 seconds on iOS); it does not
 * survive the app being killed.
 */

export const UPLOAD_PROGRESS_NOTIFICATION = "upload_progress";
// Emitted (DeviceEventEmitter) when a story has gone up, for the home screen.
export const STORY_POSTED_EVENT = "cbh:storyPosted";
const UPLOAD_RESULT_NOTIFICATION = "upload_result";
const CHANNEL_ID = "uploads";

// How long a finished job stays in the bar.
const DONE_VISIBLE_MS = 2500;
const FAILED_VISIBLE_MS = 8000;

let jobs = [];
let nextId = 1;
const tasks = new Map(); // id -> task function (kept for retry)
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener(jobs));

export const subscribeUploads = (listener) => {
  listeners.add(listener);
  listener(jobs);
  return () => listeners.delete(listener);
};

const find = (id) => jobs.find((job) => job.id === id);

const patch = (id, changes) => {
  if (!find(id)) return null;
  jobs = jobs.map((job) => (job.id === id ? { ...job, ...changes } : job));
  emit();
  return find(id);
};

const remove = (id) => {
  tasks.delete(id);
  notificationState.delete(id);
  jobs = jobs.filter((job) => job.id !== id);
  emit();
};

// --- wording ---------------------------------------------------------------

const t = (key, options) => i18n.t(key, options);

/**
 * Title and one-line status of a job, for the bar and the notification.
 * @returns {{ title: string, body: string }}
 */
export const describeUpload = (job) => {
  const kind = ["post", "postEdit", "story", "message"].includes(job.kind) ? job.kind : "post";

  if (job.status === "done") {
    return { title: t(`uploads.done.${kind}`), body: "" };
  }
  if (job.status === "failed") {
    return { title: t(`uploads.failed.${kind}`), body: job.error || t("uploads.failedDesc") };
  }

  const multiple = job.total > 1;
  let body;
  switch (job.stage) {
    case "compressingImage":
      body = t("uploads.stage.compressingImage");
      break;
    case "compressingVideo":
      body = multiple
        ? t("uploads.stage.compressingVideoCount", { current: job.current, total: job.total })
        : t("uploads.stage.compressingVideo");
      break;
    case "uploading":
      body = t("uploads.stage.uploading");
      break;
    case "uploadingVideo":
      body = multiple
        ? t("uploads.stage.uploadingVideoCount", { current: job.current, total: job.total })
        : t("uploads.stage.uploadingVideo");
      break;
    case "finishing":
      body = t("uploads.stage.finishing");
      break;
    default:
      body = t("uploads.stage.preparing");
  }

  if (typeof job.progress === "number") {
    body += ` ${Math.round(job.progress * 100)}%`;
  }
  return { title: t(`uploads.title.${kind}`), body };
};

// --- notifications ---------------------------------------------------------

const notificationId = (id) => `upload-${id}`;
const notificationState = new Map(); // id -> { key, at }
// One call at a time: an update that lands after the final dismiss would
// leave an "uploading" notification stuck in the shade.
let notificationChain = Promise.resolve();
let channelReady = false;

const queueNotification = (work) => {
  notificationChain = notificationChain.then(work).catch(() => {});
};

const ensureChannel = async () => {
  if (Platform.OS !== "android" || channelReady) return;
  // LOW: sits in the shade without sound or a heads-up on each update.
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: t("uploads.channelName"),
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    showBadge: false,
  });
  channelReady = true;
};

const showProgressNotification = (job) => {
  if (Platform.OS !== "android") return;

  // Posting a notification is not free: only on a new stage or another 10%.
  const step = typeof job.progress === "number" ? Math.floor(job.progress * 10) : -1;
  const key = `${job.stage}:${job.current ?? 0}:${step}`;
  if (notificationState.get(job.id)?.key === key) return;
  notificationState.set(job.id, { key });

  const { title, body } = describeUpload(job);
  queueNotification(async () => {
    // The job may have finished while this was waiting in the chain.
    if (find(job.id)?.status !== "running") return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: notificationId(job.id),
      content: {
        title,
        body,
        sticky: true,
        autoDismiss: false,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        data: { type: UPLOAD_PROGRESS_NOTIFICATION },
      },
      trigger: { channelId: CHANNEL_ID },
    });
  });
};

const clearProgressNotification = (id) => {
  if (Platform.OS !== "android") return;
  queueNotification(() => Notifications.dismissNotificationAsync(notificationId(id)));
};

// The bar already says it while the app is on screen.
const showResultNotification = (job) => {
  if (AppState.currentState === "active") return;

  const { title, body } = describeUpload(job);
  queueNotification(async () => {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: `${notificationId(job.id)}-result`,
      content: {
        title,
        body: body || undefined,
        sound: false,
        data: { type: UPLOAD_RESULT_NOTIFICATION },
      },
      trigger: Platform.OS === "android" ? { channelId: CHANNEL_ID } : null,
    });
  });
};

// --- jobs ------------------------------------------------------------------

class UploadCancelled extends Error {}

const report = (id) => (stage, extra = {}) => {
  const job = find(id);
  // Thrown inside the task, so it stops before its next request - used when
  // the account changes mid-upload (see cancelAllUploads). Only on a change
  // of stage, which happens in the task's own flow: the same stage again is
  // a progress callback, where a throw would go nowhere useful.
  if (!job || job.cancelled) {
    if (!job || job.stage !== stage) throw new UploadCancelled();
    return;
  }
  if (job.status !== "running") return;

  const next = patch(id, {
    stage,
    progress: typeof extra.progress === "number" ? Math.min(1, Math.max(0, extra.progress)) : null,
    current: extra.current ?? null,
    total: extra.total ?? null,
  });
  showProgressNotification(next);
};

const succeed = (id) => {
  const job = find(id);
  if (!job || job.status !== "running") return;
  clearProgressNotification(id);

  // Chat attachments have their own bubble; no "sent" banner for each one.
  if (job.quiet) {
    remove(id);
    return;
  }
  const done = patch(id, { status: "done", progress: null });
  showResultNotification(done);
  setTimeout(() => remove(id), DONE_VISIBLE_MS);
};

const fail = (id, error, { canRetry = false } = {}) => {
  const job = find(id);
  if (!job || job.status !== "running") return;
  clearProgressNotification(id);

  if (error instanceof UploadCancelled || job.cancelled) {
    remove(id);
    return;
  }

  const message =
    typeof error === "string"
      ? error
      : error?.response?.data?.message || (error?.message === "Network Error" ? t("uploads.networkError") : null);
  const failed = patch(id, { status: "failed", progress: null, error: message, canRetry });
  showResultNotification(failed);
  // A job that can be retried waits for the user; the others clear themselves.
  if (!canRetry) setTimeout(() => find(id)?.status === "failed" && remove(id), FAILED_VISIBLE_MS);
};

const run = async (id) => {
  const task = tasks.get(id);
  if (!task) return;
  const started = patch(id, { status: "running", stage: "preparing", progress: null, error: null });
  showProgressNotification(started);
  try {
    await task(report(id));
    succeed(id);
  } catch (error) {
    if (!(error instanceof UploadCancelled)) console.log("[Upload] failed:", error?.message || error);
    fail(id, error, { canRetry: true });
  }
};

const create = ({ kind, quiet = false }) => {
  const id = nextId++;
  jobs = [...jobs, { id, kind, quiet, status: "running", stage: "preparing", progress: null, current: null, total: null, error: null }];
  emit();
  return id;
};

/**
 * Run `task` in the background and report it in the bar / notification.
 * The caller doesn't wait: close the screen right after calling this.
 *
 * @param {{ kind: "post"|"postEdit"|"story", task: (report: (stage: string, extra?: { progress?: number, current?: number, total?: number }) => void) => Promise<any> }} options
 *   `task` must read everything it needs from values captured before the
 *   screen closes, and call `report` as it moves on. It can be run again
 *   (retry), so it has to start from scratch each time.
 */
export const startUpload = ({ kind, task }) => {
  const id = create({ kind });
  tasks.set(id, task);
  run(id);
  return id;
};

/**
 * For code that drives the upload itself (chat attachments, which already
 * show an optimistic bubble): returns the handle to report with.
 * `end()` closes it silently if nothing else did.
 */
export const beginUpload = ({ kind, quiet = true }) => {
  const id = create({ kind, quiet });
  showProgressNotification(find(id));
  return {
    report: (stage, extra) => {
      try {
        report(id)(stage, extra);
      } catch {
        // Cancelled: a handle has no task to stop, the caller carries on.
      }
    },
    succeed: () => succeed(id),
    fail: (error) => fail(id, error),
    end: () => {
      if (find(id)?.status === "running") {
        clearProgressNotification(id);
        remove(id);
      }
    },
  };
};

export const retryUpload = (id) => {
  if (find(id)?.status === "failed" && tasks.has(id)) run(id);
};

export const dismissUpload = (id) => {
  if (find(id)?.status !== "running") remove(id);
};

/**
 * Stop every job at its next step. Called when the active account changes:
 * the request that creates the post would otherwise go out with the new
 * account's token.
 */
export const cancelAllUploads = () => {
  jobs.forEach((job) => {
    if (job.status === "running") {
      jobs = jobs.map((other) => (other.id === job.id ? { ...other, cancelled: true } : other));
      clearProgressNotification(job.id);
    }
  });
  jobs = jobs.filter((job) => job.status === "running");
  emit();
};
