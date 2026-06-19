import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import i18n from "../i18n";

dayjs.extend(relativeTime);

const getTranslation = (unit, count) => {
  const lang = i18n.language?.split("-")[0] || "vi";

  if (lang === "vi") {
    return i18n.t(`time.${unit}Ago`, { count });
  }

  if (lang === "en") {
    if (count === 1) {
      const singularUnits = {
        seconds: "time.secondAgo",
        minutes: "time.minuteAgo",
        hours: "time.hourAgo",
        days: "time.dayAgo",
        weeks: "time.weekAgo",
        months: "time.monthAgo",
        years: "time.yearAgo",
      };
      return i18n.t(singularUnits[unit] || `time.${unit}Ago`, { count });
    }
    return i18n.t(`time.${unit}Ago`, { count });
  }

  if (lang === "ru") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    let form = "many"; // default: секунд, минут, часов, дней, лет

    if (mod10 === 1 && mod100 !== 11) {
      form = "one"; // секунду, минуту, час, день, год
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      form = "few"; // секунды, минуты, часа, дня, года
    }

    return i18n.t(`time.${unit}Ago_${form}`, { count });
  }

  return i18n.t(`time.${unit}Ago`, { count });
};

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
      return getTranslation("minutes", diffInMinutes);
    }

    const diffInHours = now.diff(date, "hour");
    if (diffInHours < 24) {
      return getTranslation("hours", diffInHours);
    }

    const diffInDays = now.diff(date, "day");
    if (diffInDays < 7) {
      return getTranslation("days", diffInDays);
    }

    const diffInWeeks = now.diff(date, "week");
    if (diffInWeeks < 4) {
      return getTranslation("weeks", diffInWeeks);
    }

    const diffInMonths = now.diff(date, "month");
    if (diffInMonths < 1) {
      return getTranslation("weeks", diffInWeeks);
    }
    if (diffInMonths < 12) {
      return getTranslation("months", diffInMonths);
    }

    const diffInYears = now.diff(date, "year");
    return getTranslation("years", diffInYears);
  }

  // Parse and translate Vietnamese relative time strings
  const cleaned = cleanString.toLowerCase();

  if (
    cleaned === "vừa xong" ||
    cleaned === "vừa đăng" ||
    cleaned === "vài giây trước" ||
    cleaned.includes("vừa xong") ||
    cleaned.includes("vừa đăng") ||
    cleaned.includes("vài giây trước")
  ) {
    return i18n.t("time.justNow");
  }

  const match = cleaned.match(/^(\d+)\s+(giây|phút|giờ|ngày|tuần|tháng|năm)\s+trước$/);
  if (match) {
    const count = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "giây":
        return getTranslation("seconds", count);
      case "phút":
        return getTranslation("minutes", count);
      case "giờ":
        return getTranslation("hours", count);
      case "ngày":
        return getTranslation("days", count);
      case "tuần":
        return getTranslation("weeks", count);
      case "tháng":
        return getTranslation("months", count);
      case "năm":
        return getTranslation("years", count);
      default:
        break;
    }
  }

  return dateString;
};

export default formatTime;
