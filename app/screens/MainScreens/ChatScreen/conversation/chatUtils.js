import dayjs from "dayjs";
import i18n from "../../../../i18n";
import "dayjs/locale/vi";
import "dayjs/locale/ru";

// Attachment URLs coming from the API are host-relative (e.g. "/storage/...");
// local optimistic messages use file:// or content:// URIs, and http(s) may
// already be absolute if the backend ever returns a CDN url. Storage files
// are served by the API app, not the marketing site - every other screen in
// this app resolves relative paths against api.chuyenbienhoa.com (see
// ArchiveScreen/HomeScreen's resolveStoryMediaUrl), so match that instead of
// the bare domain, which 404s.
const resolveMediaUrl = (url) => {
  if (!url) return null;
  if (
    url.startsWith("http") ||
    url.startsWith("file:") ||
    url.startsWith("content:")
  ) {
    return url;
  }
  return `https://api.chuyenbienhoa.com${url}`;
};

dayjs.locale(i18n.language || "vi");

const CONVERSATION_CACHE_KEY = "conversation_";
const CONVERSATION_TIMESTAMP_KEY = "conversation_timestamp_";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
// axiosInstance's default timeout (10s) is tuned for regular API calls and is
// far too short for multi-MB attachment uploads (video/file allow up to
// 100MB on the backend). 120s was still too short on slower mobile uplinks -
// a ~90MB video comfortably takes several minutes on 3G/weak wifi, and the
// old timeout made those uploads fail with no clear explanation partway
// through instead of either succeeding or failing fast. Matches the 10-minute
// budget used on web.
const ATTACHMENT_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const ATTACHMENT_UPLOAD_CONFIG = { timeout: ATTACHMENT_UPLOAD_TIMEOUT_MS };

// Mirrors the backend's per-type validation (ChatController::sendMessage) so
// we can reject an attachment that's guaranteed to fail instantly, with a
// clear reason, instead of letting the user watch a spinner for minutes only
// to hit a generic error once the upload finally reaches the server (or
// times out before it even gets there).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB

function formatBytesForToast(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const formatMessageTime = (timestamp, t) => {
  const messageTime = dayjs(timestamp);
  const hours = parseInt(messageTime.format("H"));
  const period =
    hours < 12 ? t("chatConversation.am") : t("chatConversation.pm");
  return `${messageTime.format("hh:mm")} ${period}`;
};

const injectTimeHeaders = (messages, t) => {
  const result = [];
  let currentDate = null;

  messages.forEach((msg, index) => {
    const prev = messages[index - 1];
    const currTime = dayjs(msg.created_at);
    const currDate = currTime.startOf("day");

    // Check if we need to add a date header
    if (!currentDate || !currDate.isSame(currentDate)) {
      currentDate = currDate;
      const today = dayjs().startOf("day");
      const isToday = currDate.isSame(today);
      const isYesterday = currDate.isSame(today.subtract(1, "day"));

      let dateText;
      if (isToday) {
        dateText = t("chatConversation.today");
      } else if (isYesterday) {
        dateText = t("chatConversation.yesterday");
      } else {
        dateText = currDate.format("DD/MM/YYYY");
      }

      result.push({
        id: `date-${msg.id}`,
        type: "date",
        date: dateText,
      });
    }

    // Check if we need to add a time header (for messages more than 5 minutes apart)
    let showTimeHeader = false;
    if (!prev) {
      showTimeHeader = true;
    } else {
      const prevTime = dayjs(prev.created_at);
      if (currTime.diff(prevTime, "minute") > 5) {
        showTimeHeader = true;
      }
    }

    if (showTimeHeader) {
      result.push({
        id: `time-${msg.id}`,
        type: "time",
        time: currTime.format("HH:mm"),
      });
    }

    // `type` doubles as the list-envelope discriminator ("message" vs "date"/"time"
    // headers) elsewhere in this screen, which would otherwise clobber the backend's
    // content type (text/image/file) - keep that around separately so attachment
    // bubbles still render correctly after any refetch. Messages that already went
    // through this function (e.g. re-merged on scroll-up pagination) have `type`
    // set to "message" already, so fall back to their existing `content_type`
    // instead of overwriting it.
    // Already in that shape: keep the very same object. Rows are memoized on
    // it, and a fresh copy of every message on every call re-rendered the
    // whole list each time one message arrived.
    result.push(
      msg.type === "message" && msg.content_type !== undefined
        ? msg
        : {
            ...msg,
            type: "message",
            content_type: msg.content_type ?? msg.type,
          },
    );
  });

  return result;
};

export { resolveMediaUrl, CONVERSATION_CACHE_KEY, CONVERSATION_TIMESTAMP_KEY, CACHE_EXPIRY, ATTACHMENT_UPLOAD_TIMEOUT_MS, ATTACHMENT_UPLOAD_CONFIG, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MAX_FILE_BYTES, formatBytesForToast, formatMessageTime, injectTimeHeaders };
