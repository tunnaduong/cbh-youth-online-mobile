import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import i18n from "../i18n";

dayjs.extend(relativeTime);

const formatTime = (dateString) => {
  if (!dateString) return i18n.t("time.justNow");

  const date = dayjs(dateString);
  const now = dayjs();
  const diffInSeconds = now.diff(date, "second");

  if (diffInSeconds < 60) {
    return i18n.t("time.justNow");
  }

  const diffInMinutes = now.diff(date, "minute");
  if (diffInMinutes < 60) {
    return i18n.t("time.minutesAgo", { count: diffInMinutes });
  }

  const diffInHours = now.diff(date, "hour");
  if (diffInHours < 24) {
    return i18n.t("time.hoursAgo", { count: diffInHours });
  }

  const diffInDays = now.diff(date, "day");
  if (diffInDays < 7) {
    return i18n.t("time.daysAgo", { count: diffInDays });
  }

  const diffInWeeks = now.diff(date, "week");
  if (diffInWeeks < 4) {
    return i18n.t("time.weeksAgo", { count: diffInWeeks });
  }

  const diffInMonths = now.diff(date, "month");
  if (diffInMonths < 12) {
    return i18n.t("time.monthsAgo", { count: diffInMonths });
  }

  const diffInYears = now.diff(date, "year");
  return i18n.t("time.yearsAgo", { count: diffInYears });
};

export default formatTime;
