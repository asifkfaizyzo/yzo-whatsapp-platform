// backend/src/modules/email/templates/whatsappStatus.js (do not remove this comment)

import { wrapEmail, renderHeader, renderFooter } from "./_helpers.js";
import { ICONS } from "./_icons.js";

/**
 * WhatsApp connection status alert to superadmin.
 *
 * @param {Object} context
 * @param {string} context.tenantName
 * @param {string} context.tenantEmail
 * @param {string} [context.phoneNumber] - Phone number ID
 * @param {string} [context.wabaId]      - WABA ID
 * @param {string} context.action        - "CONNECTED" | "DISCONNECTED"
 * @returns {{ subject: string, html: string }}
 */
export default function whatsappStatus({ tenantName, tenantEmail, phoneNumber, wabaId, action }) {
  const isConnected = action === "CONNECTED";
  const subject = `WhatsApp ${isConnected ? "Connected" : "Disconnected"} — ${tenantName}`;
  const headerBg = isConnected ? "#125EF2" : "#EF4444";
  const headerTitle = isConnected ? "WhatsApp Connected" : "WhatsApp Disconnected";
  const headerIcon = isConnected ? ICONS.WHATSAPP : ICONS.DISCONNECT;

  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = wrapEmail({
    title: headerTitle,
    header: renderHeader({
      title: headerTitle,
      subtitle: tenantName,
      bgColor: headerBg,
      icon: headerIcon,
    }),
    body: `
      <p>A tenant has <strong>${isConnected ? "connected" : "disconnected"}</strong> their WhatsApp account on the platform.</p>

      <div class="info-card">
        <table>
          <tr>
            <td>Tenant Name</td>
            <td>${tenantName}</td>
          </tr>
          <tr>
            <td>Tenant Email</td>
            <td><a href="mailto:${tenantEmail}" style="color: #125EF2; text-decoration: none;">${tenantEmail}</a></td>
          </tr>
          <tr>
            <td>Phone Number ID</td>
            <td>${phoneNumber || "N/A"}</td>
          </tr>
          <tr>
            <td>WABA ID</td>
            <td>${wabaId || "N/A"}</td>
          </tr>
          <tr>
            <td>Action</td>
            <td>
              <span class="badge ${isConnected ? "badge-success" : "badge-danger"}">
                ${action}
              </span>
            </td>
          </tr>
          <tr>
            <td>Time</td>
            <td>${timestamp} IST</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; color: #94A3B8;">
        Log in to the admin dashboard to view more details.
      </p>
    `,
    footer: renderFooter(),
  });

  return { subject, html };
}