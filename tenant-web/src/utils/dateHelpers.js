// tenant-web/src/utils/dateHelpers.js (do not remove this comment)

/**
 * Formats a date value as a localized time string (HH:MM).
 * @param {string|Date|number} dateVal - The date to format.
 * @returns {string} The formatted time, or empty string if invalid.
 */
export const formatTime = (dateVal) => {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/**
 * Formats a date value as a localized date string.
 * Defaults to "Weekday, Mon DD" format when no options are provided.
 * @param {string|Date|number} dateVal - The date to format.
 * @param {Intl.DateTimeFormatOptions} [options] - Optional formatting options.
 * @returns {string} The formatted date, or empty string if invalid.
 */
export function formatDate(dateVal, options) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(
    [],
    options || { month: "short", day: "numeric", year: "numeric" },
  );
}
