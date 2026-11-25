// backend/src/modules/email/templates/_icons.js (do not remove this comment)

/**
 * SVG icon constants for SudoReply emails.
 *
 * All icons are inline SVG strings — no external files, no emojis.
 * Designed for email compatibility: explicit dimensions, white strokes/fills
 * (intended for use on colored header backgrounds via renderHeader).
 *
 * Usage:
 *   import { ICONS } from "./_icons.js";
 *   renderHeader({ title: "Success", icon: ICONS.CHECK })
 */

const S = 24;
const A = `width="${S}" height="${S}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;"`;

export const ICONS = {
  // ── Success / Approved / Connected ──
  CHECK: `<svg ${A}><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="2"/></svg>`,

  // ── Warning / Alert ──
  ALERT: `<svg ${A}><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Password / Security ──
  KEY: `<svg ${A}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── OTP / Time-sensitive ──
  CLOCK: `<svg ${A}><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="2"/><path d="M12 6v6l4 2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Pause ──
  PAUSE: `<svg ${A}><rect x="6" y="4" width="4" height="16" rx="1" fill="#fff"/><rect x="14" y="4" width="4" height="16" rx="1" fill="#fff"/></svg>`,

  // ── Resume / Play ──
  PLAY: `<svg ${A}><path d="M8 5v14l11-7L8 5z" fill="#fff"/></svg>`,

  // ── Invoice / Billing ──
  INVOICE: `<svg ${A}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v6h6M16 13H8m8 4H8m2-8H8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Support Ticket ──
  TICKET: `<svg ${A}><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Enquiry / Chat ──
  ENQUIRY: `<svg ${A}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Enterprise / Building ──
  ENTERPRISE: `<svg ${A}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 9h1m-1 4h1m4-4h1m-1 4h1" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,

  // ── WhatsApp / Phone ──
  WHATSAPP: `<svg ${A}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Template / Document ──
  TEMPLATE: `<svg ${A}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Lock ──
  LOCK: `<svg ${A}><rect x="3" y="11" width="18" height="11" rx="2" stroke="#fff" stroke-width="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,

  // ── Bell / Notification ──
  BELL: `<svg ${A}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Calendar / Expiry ──
  CALENDAR: `<svg ${A}><rect x="3" y="4" width="18" height="18" rx="2" stroke="#fff" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,

  // ── Trash / Deletion ──
  TRASH: `<svg ${A}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Refresh / Reactivation ──
  REFRESH: `<svg ${A}><path d="M23 4v6h-6M1 20v-6h6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Welcome / Star ──
  STAR: `<svg ${A}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // ── Disconnect / Error ──
  DISCONNECT: `<svg ${A}><circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
};

export default ICONS;