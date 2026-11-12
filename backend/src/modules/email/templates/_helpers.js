// backend/src/modules/email/templates/_helpers.js (do not remove this comment)

import { EMAIL_CONFIG } from "../email.config.js";
import { BASE_META_TAGS, BASE_STYLES } from "./_baseStyles.js";

const { brand, company } = EMAIL_CONFIG;

/**
 * Full <head> content for email HTML documents.
 * Includes meta tags, Outlook conditional comments, and all base styles.
 *
 * @param {string} [title="SudoReply"] - Document <title>
 * @returns {string} HTML for <head>
 */
export const getBaseHeadContent = (title = "SudoReply") => `
  ${BASE_META_TAGS}
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>${BASE_STYLES}</style>
`;

/**
 * Render the branded email header block.
 *
 * @param {Object} opts
 * @param {string} opts.title       - Main heading text
 * @param {string} [opts.subtitle]  - Smaller text below heading
 * @param {string} [opts.bgColor]   - Override header background (default: brand primary)
 * @param {string} [opts.icon]      - SVG icon string from _icons.js
 * @returns {string} HTML
 */
export const renderHeader = ({ title, subtitle, bgColor, icon }) => {
  const bg = bgColor || brand.primaryColor;
  const iconHtml = icon
    ? `<div class="icon-circle" style="background: rgba(255,255,255,0.2);">${icon}</div>`
    : "";

  return `
    <div class="email-header" style="background: ${bg};">
      ${iconHtml}
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ""}
    </div>
  `;
};

/**
 * Render a CTA button with Outlook VML fallback.
 *
 * @param {Object} opts
 * @param {string} opts.href        - Button URL
 * @param {string} opts.text        - Button label
 * @param {string} [opts.color]     - Color variant: primary | success | danger | purple
 * @returns {string} HTML
 */
export const renderButton = ({ href, text, color = "primary" }) => {
  const hexColor =
    color === "success"
      ? brand.successColor
      : color === "danger"
        ? brand.dangerColor
        : color === "purple"
          ? brand.purpleColor
          : brand.primaryColor;

  return `
    <div style="text-align: center; margin: 28px 0 16px 0;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
        href="${href}"
        style="height:44px;v-text-anchor:middle;width:220px;"
        arcsize="18%"
        fillcolor="${hexColor}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">${text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" class="btn btn-${color}">${text}</a>
      <!--<![endif]-->
    </div>
  `;
};

/**
 * Render the standard email footer.
 *
 * @param {Object} [opts]
 * @param {string} [opts.extra] - Additional line above the company info
 * @returns {string} HTML
 */
export const renderFooter = ({ extra } = {}) => `
  <div class="email-footer">
    ${extra ? `<p style="margin-bottom: 6px;">${extra}</p>` : ""}
    <p>
      ${company.name} |
      <a href="mailto:${company.email}">${company.email}</a> |
      <a href="${company.website}">${company.website.replace("https://", "")}</a>
    </p>
  </div>
`;

/**
 * Wrap content in a complete <!DOCTYPE html> email document.
 *
 * This is the main entry point for templates. Each template calls this
 * with its header, body, and optional footer to get a full email.
 *
 * @param {Object} opts
 * @param {string} opts.title      - Document <title>
 * @param {string} opts.header     - HTML from renderHeader()
 * @param {string} opts.body       - Main content HTML
 * @param {string} [opts.footer]   - HTML from renderFooter() (defaults to standard)
 * @returns {string} Complete email HTML
 */
export const wrapEmail = ({ title, header, body, footer }) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  ${getBaseHeadContent(title)}
</head>
<body>
  <div class="email-wrapper">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding: 24px 0;">
          <div class="email-container">
            ${header}
            <div class="email-body">
              ${body}
            </div>
            ${footer || renderFooter()}
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

/**
 * Build a frontend URL for a given path.
 * Convenience wrapper around EMAIL_CONFIG.getFrontendUrl.
 *
 * @param {string} path              - URL path (e.g., "/login")
 * @param {string} [userType="TENANT"] - SUPERADMIN or TENANT
 * @returns {string} Full URL
 */
export const getFrontendUrl = (path, userType = "TENANT") =>
  EMAIL_CONFIG.getFrontendUrl(path, userType);