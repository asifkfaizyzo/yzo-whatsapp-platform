// backend/src/modules/email/templates/_baseStyles.js (do not remove this comment)

import { EMAIL_CONFIG } from "../email.config.js";

const { brand } = EMAIL_CONFIG;

/**
 * Meta tags for email <head>.
 * Includes viewport, color-scheme for dark mode, and Outlook compat.
 */
export const BASE_META_TAGS = `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
`;

/**
 * Base CSS for all SudoReply emails.
 *
 * Covers:
 * - Email client resets (Outlook, Apple Mail, Gmail)
 * - Dark mode via @media (prefers-color-scheme: dark)
 * - Responsive breakpoint at 620px
 * - Reusable component classes: .info-card, .badge, .btn, .icon-circle
 */
export const BASE_STYLES = `
  /* ── Client Resets ── */
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }

  /* ── Typography ── */
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: ${brand.darkText};
    background-color: #F1F5F9;
  }

  /* ── Layout ── */
  .email-wrapper {
    width: 100%;
    background-color: #F1F5F9;
    padding: 24px 0;
  }
  .email-container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  /* ── Header ── */
  .email-header {
    background: ${brand.primaryColor};
    padding: 28px 24px;
    text-align: center;
  }
  .email-header h1 {
    color: #ffffff;
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .email-header p {
    color: ${brand.primaryLight};
    margin: 6px 0 0 0;
    font-size: 13px;
  }

  /* ── Body ── */
  .email-body {
    padding: 28px 24px;
    color: ${brand.darkText};
    line-height: 1.6;
  }
  .email-body h2 {
    color: ${brand.darkText};
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 12px 0;
  }
  .email-body h3 {
    color: ${brand.darkText};
    font-size: 15px;
    font-weight: 700;
    margin: 20px 0 8px 0;
  }
  .email-body p {
    margin: 0 0 14px 0;
    font-size: 14px;
    color: #475569;
  }
  .email-body strong { color: ${brand.darkText}; }

  /* ── Info Card ── */
  .info-card {
    background: ${brand.lightBg};
    border: 1px solid ${brand.border};
    border-radius: 8px;
    padding: 18px 20px;
    margin: 18px 0;
  }
  .info-card table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .info-card td {
    padding: 6px 0;
    border-bottom: 1px solid #F1F5F9;
  }
  .info-card tr:last-child td { border-bottom: none; }
  .info-card td:first-child {
    color: ${brand.grayText};
    font-weight: 600;
    width: 40%;
  }
  .info-card td:last-child {
    color: ${brand.darkText};
    font-weight: 700;
    text-align: right;
  }

  /* ── Status Badges ── */
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
  }
  .badge-success { background: #DCFCE7; color: #16A34A; }
  .badge-warning { background: #FEF3C7; color: #D97706; }
  .badge-danger  { background: #FEE2E2; color: #DC2626; }
  .badge-info    { background: #DBEAFE; color: #2563EB; }
  .badge-purple  { background: #EDE9FE; color: #7C3AED; }

  /* ── Buttons ── */
  .btn {
    display: inline-block;
    padding: 12px 28px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
    text-align: center;
  }
  .btn-primary { background: ${brand.primaryColor}; color: #ffffff !important; }
  .btn-success { background: ${brand.successColor}; color: #ffffff !important; }
  .btn-danger  { background: ${brand.dangerColor};  color: #ffffff !important; }
  .btn-purple  { background: ${brand.purpleColor};  color: #ffffff !important; }

  /* ── Footer ── */
  .email-footer {
    background: ${brand.lightBg};
    border-top: 1px solid ${brand.border};
    padding: 16px 24px;
    text-align: center;
  }
  .email-footer p {
    color: #94A3B8;
    font-size: 12px;
    margin: 0;
  }
  .email-footer a {
    color: ${brand.primaryColor};
    text-decoration: none;
  }

  /* ── Icon Container ── */
  .icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    margin: 0 auto 12px auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Dark Mode ── */
  @media (prefers-color-scheme: dark) {
    body, .email-wrapper { background-color: #0F172A !important; }
    .email-container {
      background-color: #1E293B !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    }
    .email-body { color: #E2E8F0 !important; }
    .email-body h2, .email-body h3 { color: #F1F5F9 !important; }
    .email-body p { color: #CBD5E1 !important; }
    .email-body strong { color: #F1F5F9 !important; }
    .info-card {
      background: #0F172A !important;
      border-color: #334155 !important;
    }
    .info-card td { border-bottom-color: #1E293B !important; }
    .info-card td:first-child { color: #94A3B8 !important; }
    .info-card td:last-child { color: #F1F5F9 !important; }
    .email-footer {
      background: #0F172A !important;
      border-top-color: #334155 !important;
    }
    .email-footer p { color: #64748B !important; }
  }

  /* ── Responsive ── */
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; border-radius: 0 !important; }
    .email-body { padding: 20px 16px !important; }
    .email-header { padding: 20px 16px !important; }
  }
`;