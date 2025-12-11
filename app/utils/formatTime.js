import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";

dayjs.extend(relativeTime);
dayjs.locale("vi");

/**
 * Format time to relative Vietnamese format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted time string
 */
const formatTime = (dateString) => {
  if (!dateString) return "Vừa xong";

  const date = dayjs(dateString);
  const now = dayjs();
  const diffInSeconds = now.diff(date, "second");

  if (diffInSeconds < 60) {
    return "Vừa xong";
  }

  const diffInMinutes = now.diff(date, "minute");
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }

  const diffInHours = now.diff(date, "hour");
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }

  const diffInDays = now.diff(date, "day");
  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  const diffInWeeks = now.diff(date, "week");
  if (diffInWeeks < 4) {
    return `${diffInWeeks} tuần trước`;
  }

  const diffInMonths = now.diff(date, "month");
  if (diffInMonths < 12) {
    return `${diffInMonths} tháng trước`;
  }

  const diffInYears = now.diff(date, "year");
  return `${diffInYears} năm trước`;
};

export default formatTime;



