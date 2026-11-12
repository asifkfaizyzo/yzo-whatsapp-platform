// tenant-web/src/theme/AuthThemeContext.jsx (do not remove this comment)
import React, { createContext, useContext, useMemo } from "react";

export const authThemeTokens = {
  colors: {
    primary: "#125fe2",
    primaryHover: "#0e4bc0",
    primaryActive: "#0b3d9e",
    primaryLight: "#eaf2fe",
    primaryBorder: "#cfe0fd",
    gradientLeft: "linear-gradient(160deg, #0c3aa6 0%, #125fe2 46%, #1547a8 100%)",
    bgMuted: "#f8fafc",
    textDark: "#0f172a",
    textMuted: "#64748b",
    borderMuted: "#e6eaf1",
    borderHover: "#cbd5e1",
    error: "#dc2626",
    errorBg: "#fef2f2",
    errorBorder: "#fee2e2",
    success: "#10b981",
    successBg: "#ecfdf5",
    successBorder: "#a7f3d0",
  },
  radii: {
    card: "1.5rem",
    button: "0.75rem",
    input: "0.75rem",
    pill: "9999px",
  },
  shadows: {
    card: "0 1px 2px rgba(15,23,42,0.04), 0 24px 48px -16px rgba(15,23,42,0.08)",
    buttonHover: "0 8px 20px -6px rgba(18,95,226,0.45)",
    inputFocus: "0 0 0 4px rgba(18,95,226,0.16)",
  },
};

export const AUTH_STYLES = `
/* ── Keyframes ── */
@keyframes sr-fade-in-slide {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sr-fade-out-slide {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-8px); }
}
@keyframes sr-drift-a {
  0%,100% { transform: translate(0,0) rotate(0deg); }
  50%     { transform: translate(6px,-10px) rotate(1.5deg); }
}
@keyframes sr-drift-b {
  0%,100% { transform: translate(0,0) rotate(0deg); }
  50%     { transform: translate(-8px,8px) rotate(-1.5deg); }
}
@keyframes sr-drift-c {
  0%,100% { transform: translate(0,0); }
  50%     { transform: translate(4px,10px); }
}
@keyframes sr-pulse-dot {
  0%,100% { opacity: 0.35; }
  50%     { opacity: 1; }
}

/* ── Animation utilities ── */
.sr-animate-fade-in-slide  { animation: sr-fade-in-slide  0.35s cubic-bezier(0.16,1,0.3,1) both; }
.sr-animate-fade-out-slide { animation: sr-fade-out-slide 0.2s  cubic-bezier(0.16,1,0.3,1) both; }
.sr-bubble-a { animation: sr-drift-a 7s   ease-in-out infinite; }
.sr-bubble-b { animation: sr-drift-b 8.5s ease-in-out infinite; }
.sr-bubble-c { animation: sr-drift-c 6.5s ease-in-out infinite; }
.sr-pulse-dot { animation: sr-pulse-dot 2.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .sr-animate-fade-in-slide,
  .sr-animate-fade-out-slide,
  .sr-bubble-a,
  .sr-bubble-b,
  .sr-bubble-c,
  .sr-pulse-dot { animation: none !important; }
}

/* ── Inputs ── */
.sr-input {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  border: 1.5px solid #e6eaf1;
  background: #ffffff;
  color: #0f172a;
  font-size: 0.9375rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.sr-input::placeholder { color: #94a3b8; }
.sr-input:hover { border-color: #cbd5e1; }
.sr-input:focus {
  outline: none;
  border-color: #125fe2;
  box-shadow: 0 0 0 4px rgba(18,95,226,0.16);
}
.sr-input.sr-input-error { border-color: #dc2626; }
.sr-input.sr-input-error:focus { box-shadow: 0 0 0 4px rgba(220,38,38,0.1); }
.sr-input.sr-textarea {
  height: auto;
  padding-top: 12px;
  padding-bottom: 12px;
  resize: none;
}

/* ── Buttons ── */
.sr-btn-primary {
  background: #125fe2;
  color: #ffffff;
  border-radius: 12px;
  height: 46px;
  font-weight: 600;
  font-size: 0.9375rem;
  letter-spacing: -0.01em;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
}
.sr-btn-primary:hover:not(:disabled) {
  background: #0e4bc0;
  box-shadow: 0 8px 20px -6px rgba(18,95,226,0.45);
}
.sr-btn-primary:active:not(:disabled) {
  background: #0b3d9e;
  transform: scale(0.985);
}
.sr-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.sr-btn-secondary {
  background: #ffffff;
  color: #475569;
  border: 1.5px solid #e6eaf1;
  border-radius: 12px;
  height: 46px;
  font-weight: 600;
  font-size: 0.9375rem;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.sr-btn-secondary:hover:not(:disabled) {
  border-color: #cbd5e1;
  color: #0f172a;
  background: #f8fafc;
}

/* ── Form card compression on short viewports ── */
@media (max-height: 760px) {
  .sr-form-card {
    padding-top: 1.25rem !important;
    padding-bottom: 1.25rem !important;
  }
  .sr-form-card h2 {
    margin-bottom: 1rem !important;
    font-size: 1.35rem !important;
  }
  .sr-form-card form { row-gap: 0.85rem !important; }
}
@media (max-height: 640px) {
  .sr-form-card {
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
  }
}

/* ── Scrollbar ── */
.sr-custom-scrollbar::-webkit-scrollbar { width: 6px; }
.sr-custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.sr-custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
.sr-custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* ═══════════════════════════════════════════════════════════════
   AUTH POLISH v2
   ═══════════════════════════════════════════════════════════════ */

/* Autofill override */
.sr-input:-webkit-autofill,
.sr-input:-webkit-autofill:hover,
.sr-input:-webkit-autofill:focus,
.sr-input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
  -webkit-text-fill-color: #0f172a !important;
  caret-color: #0f172a !important;
  transition: background-color 9999s ease-in-out 0s;
}

/* Input icon turns blue on focus */
.sr-input-wrap:focus-within .sr-input-icon {
  color: #125fe2 !important;
}

/* Gradient primary button */
.sr-btn-primary-gradient {
  background: linear-gradient(135deg, #125fe2 0%, #0e4bc0 100%);
  color: #ffffff;
  border-radius: 12px;
  height: 44px;
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: -0.01em;
  transition: box-shadow 0.2s ease, transform 0.1s ease, filter 0.15s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 4px 12px -2px rgba(18,95,226,0.35);
}
.sr-btn-primary-gradient:hover:not(:disabled) {
  box-shadow: 0 2px 4px rgba(15,23,42,0.06), 0 10px 24px -4px rgba(18,95,226,0.5);
  filter: brightness(1.05);
}
.sr-btn-primary-gradient:active:not(:disabled) {
  transform: scale(0.985);
  filter: brightness(0.95);
}
.sr-btn-primary-gradient:disabled { opacity: 0.6; cursor: not-allowed; }

/* Animated underline for links */
.sr-link-underline {
  position: relative;
  text-decoration: none;
}
.sr-link-underline::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 100%;
  height: 1.5px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 0.25s ease;
}
.sr-link-underline:hover::after { transform: scaleX(1); }

/* Switch-mode arrow slide */
.sr-switch-arrow { transition: transform 0.2s ease; }
.sr-switch-link:hover .sr-switch-arrow { transform: translateX(3px); }

/* Dot-grid background — visible but clean */
.sr-right-panel-bg {
  background-color: #f8fafc;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(15,23,42,0.09) 1.2px, transparent 0);
  background-size: 20px 20px;
}

/* Crossfade seam where left blue panel meets right white panel */
.sr-crossfade-seam::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 48px;
  background: linear-gradient(to right, rgba(18,95,226,0.07), transparent);
  pointer-events: none;
  z-index: 2;
}

/* ── OTP shake animation ── */
@keyframes sr-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
.sr-shake { animation: sr-shake 0.4s ease-in-out; }

@media (prefers-reduced-motion: reduce) {
  .sr-shake { animation: none !important; }
}









`;

const AuthThemeContext = createContext(authThemeTokens);

export function AuthThemeProvider({ children }) {
  const value = useMemo(() => authThemeTokens, []);

  return (
    <AuthThemeContext.Provider value={value}>
      <style>{AUTH_STYLES}</style>
      {children}
    </AuthThemeContext.Provider>
  );
}

export function useAuthTheme() {
  return useContext(AuthThemeContext);
}