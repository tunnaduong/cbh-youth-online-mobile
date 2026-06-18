import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import i18n from "../i18n";

dayjs.extend(relativeTime);

const formatTime = (dateString) => {
  if (!dateString) return i18n.t("time.justNow");

  let cleanString = String(dateString).trim();

  // Try standard dayjs parsing first if it looks like an ISO date/timestamp
  const date = dayjs(cleanString);
  if (
    date.isValid() &&
    !/^[0-9]+\s+[a-zA-Z\u00C0-\u1EF9]+/.test(cleanString) &&
    !cleanString.includes("trước") &&
    !cleanString.includes("xong")
  ) {
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
    if (diffInMonths < 1) {
      return i18n.t("time.weeksAgo", { count: diffInWeeks });
    }
    if (diffInMonths < 12) {
      return i18n.t("time.monthsAgo", { count: diffInMonths });
    }

    const diffInYears = now.diff(date, "year");
    return i18n.t("time.yearsAgo", { count: diffInYears });
  }

  // Parse and translate Vietnamese relative time strings
  const cleaned = cleanString.toLowerCase();

  if (
    cleaned === "vừa xong" ||
    cleaned === "vừa đăng" ||
    cleaned.includes("vừa xong") ||
    cleaned.includes("vừa đăng")
  ) {
    return i18n.t("time.justNow");
  }

  const match = cleaned.match(/^(\d+)\s+(phút|giờ|ngày|tuần|tháng|năm)\s+trước$/);
  if (match) {
    const count = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "phút":
        return i18n.t("time.minutesAgo", { count });
      case "giờ":
        return i18n.t("time.hoursAgo", { count });
      case "ngày":
        return i18n.t("time.daysAgo", { count });
      case "tuần":
        return i18n.t("time.weeksAgo", { count });
      case "tháng":
        return i18n.t("time.monthsAgo", { count });
      case "năm":
        return i18n.t("time.yearsAgo", { count });
      default:
        break;
    }
  }

  return dateString;
};

export default formatTime;
