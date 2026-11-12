// backend/src/modules/email/email.config.js (do not remove this comment)

/**
 * SudoReply Email Brand Configuration
 *
 * Central source of truth for all email branding.
 * Templates import from here — never hardcode colors or URLs in templates.
 */

export const EMAIL_CONFIG = {
  // ── Brand Colors ──
  brand: {
    name: "SudoReply",
    tagline: "WhatsApp Business Platform",
    primaryColor: "#125EF2",
    primaryDark: "#0D47C4",
    primaryLight: "#CFE0FD",
    successColor: "#10B981",
    warningColor: "#F59E0B",
    dangerColor: "#EF4444",
    purpleColor: "#7C3AED",
    grayText: "#64748B",
    darkText: "#1E293B",
    lightBg: "#F8FAFC",
    border: "#E2E8F0",
  },

  // ── Company Info ──
  company: {
    name: "SudoReply",
    email: "info@sudoreply.com",
    website: "https://www.sudoreply.com",
    supportEmail: "info@sudoreply.com",
  },

  // ── Logo ──
  // Text-based for now. Set `url` to a CDN/S3 path when available.
  logo: {
    url: null, // e.g., "https://cdn.sudoreply.com/logo-email.png"
    alt: "SudoReply",
    width: 160,
    height: 40,
  },

  // ── Frontend URL Builder ──
  // FRONTEND_URLS env var is comma-separated: "superadmin_url,tenant_url"
  getFrontendUrl: (path = "", userType = "TENANT") => {
    const urls = (process.env.FRONTEND_URLS || "")
      .split(",")
      .map((u) => u.trim());
    const base =
      userType === "SUPERADMIN"
        ? urls[0] || "http://localhost:5173"
        : urls[1] || "http://localhost:5174";
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  },
};

export default EMAIL_CONFIG;