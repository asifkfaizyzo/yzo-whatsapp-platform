// tenant-web/src/utils/mediaHelpers.js (do not remove this comment)

/**
 * Resolves a media URL to a full absolute URL.
 * Handles legacy prefixes like "undefined/" and localhost/backend hostnames.
 * @param {string} mediaUrl - The raw media URL or path from the backend.
 * @returns {string} The resolved absolute URL, or empty string if input is falsy.
 */
export const getMediaUrl = (mediaUrl) => {
  if (!mediaUrl) return "";

  let cleaned = mediaUrl;

  if (cleaned.startsWith("undefined/")) {
    cleaned = cleaned.replace("undefined/", "");
  }

  if (cleaned.includes("localhost") || cleaned.includes("backend:5000")) {
    cleaned = cleaned.replace(/^https?:\/\/[^\/]+/, "").replace(/^\/+/, "");
  }

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  const backend = (
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000"
  ).replace(/\/+$/, "");

  const cleanPath = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  return `${backend}${cleanPath}`;
};

/**
 * Resolves an avatar URL to a full absolute URL.
 * @param {string} url - The raw avatar URL or path.
 * @returns {string|null} The resolved absolute URL, or null if input is falsy.
 */
export const getAvatarUrl = (url) => {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const backend = (
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000"
  ).replace(/\/+$/, "");

  return `${backend}/${url.replace(/^\/+/, "")}`;
};

/**
 * Returns a consistent Tailwind background/text color class pair based on
 * the first character of the provided name. Used for initials avatars.
 * @param {string} name - The display name.
 * @returns {string} Tailwind utility classes.
 */
export const getAvatarStyle = (name) => {
  const chars = name ? name.charCodeAt(0) : 0;
  const colors = [
    "bg-emerald-100 text-emerald-800",
    "bg-teal-100 text-teal-800",
    "bg-green-100 text-green-800",
    "bg-lime-100 text-lime-800",
    "bg-cyan-100 text-cyan-800",
  ];
  return colors[chars % colors.length];
};