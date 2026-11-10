// backend/src/app.js (do not remove this comment)

// ═══════════════════════════════════════════════════════════════
// CORE IMPORTS
// ═══════════════════════════════════════════════════════════════
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import path from "path";

// ═══════════════════════════════════════════════════════════════
// CONFIG & MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
import { serverAdapter } from "./config/bull.board.js";
import { bullBoardAuth } from "./middlewares/auth.bullBoard.js";

// ═══════════════════════════════════════════════════════════════
// NEW AUTH ROUTES (Phase 5, 6, 7) — mounted FIRST, take precedence
// ═══════════════════════════════════════════════════════════════
import tenantAuthRoutes from "./modules/tenant/auth/tenant.auth.routes.js";
import userAuthRoutes from "./modules/users/user.auth.routes.js";
import sradminAuthRoutes from "./modules/superadmin/auth/sradmin.auth.routes.js";

// ═══════════════════════════════════════════════════════════════
// NEW SRADMIN TENANT MANAGEMENT (Phase 9)
// ═══════════════════════════════════════════════════════════════
import sradminTenantRoutes from "./modules/superadmin/tenant/sradmin.tenant.routes.js";

// ═══════════════════════════════════════════════════════════════
// OLD SUPERADMIN ROUTES (revenue, GST, notifications, audit, etc.)
// These handle everything NOT caught by the new routes above.
// Phase 10 will remove auth + tenant CRUD from this file.
// ═══════════════════════════════════════════════════════════════
import superadminRoutes from "./modules/superadmin/superadmin.routes.js";
import adminTicketRoutes from "./modules/tickets/ticket.admin.routes.js";
import revenueRoutes from "./modules/revenue/revenue.routes.js";
import adminSubscriptionsRoute from "./modules/admin-subscriptions/adminSubscription.routes.js";
import enterpriseLeadAdminRoutes from "./modules/enterprise-leads/enterpriseLead.admin.routes.js";
import superAdminNotificationRoutes from "./modules/superadmin-notifications/superadminNotification.routes.js";
import auditLogRoutes from "./modules/audit/audit.routes.js";
import dlqRoutes from "./modules/webhook/dlq.routes.js";
import flowRoutes from "./modules/automation/flow.routes.js";
import mediaRoutes from "./modules/messages/media.routes.js";

// ═══════════════════════════════════════════════════════════════
// OLD TENANT ROUTES (contacts, conversations, messages, etc.)
// Auth paths handled by new tenantAuthRoutes above.
// ═══════════════════════════════════════════════════════════════
import tenantRoutes from "./modules/tenant/tenant.routes.js";
import contactRoutes from "./modules/contacts/contact.routes.js";
import conversationRoutes from "./modules/conversations/conversation.routes.js";
import messageRoutes from "./modules/messages/message.routes.js";
import tagRoutes from "./modules/tags/tag.routes.js";
import templateRoutes from "./modules/templates/template.routes.js";
import broadcastRoutes from "./modules/broadcasts/broadcast.routes.js";
import quickReplyRoutes from "./modules/quick-replies/quickReply.routes.js";
import ticketRoutes from "./modules/tickets/ticket.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";

// ═══════════════════════════════════════════════════════════════
// OLD USER / AGENT ROUTES (non-auth paths)
// ═══════════════════════════════════════════════════════════════
import userRoutes from "./modules/users/user.routes.js";

// ═══════════════════════════════════════════════════════════════
// SHARED ROUTES (mounted on both /sradmin and /tenant)
// ═══════════════════════════════════════════════════════════════
import planRoutes from "./modules/plans/plan.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import enquiryRoutes from "./modules/enquiries/enquiry.routes.js";
import enterpriseLeadRoutes from "./modules/enterprise-leads/enterpriseLead.routes.js";
import googleSheetsRoutes from "./modules/google-sheets/googleSheets.routes.js";
import publicRoutes from "./modules/public/public.routes.js";

// ═══════════════════════════════════════════════════════════════
// INTEGRATION ROUTES
// ═══════════════════════════════════════════════════════════════
import whatsappRoutes from "./modules/whatsapp/whatsapp.routes.js";
import shopifyRoutes from "./modules/shopify/shopify.routes.js";
import woocommerceRoutes from "./modules/woocommerce/woocommerce.routes.js";
import zohoRoutes from "./modules/zoho/zoho.routes.js";

// ═══════════════════════════════════════════════════════════════
// WEBHOOK & OAUTH HANDLERS
// ═══════════════════════════════════════════════════════════════
import webhookRoutes from "./modules/webhook/webhook.routes.js";
import { handleWooCommerceWebhook } from "./modules/webhook/woocommerce/woocommerce.webhook.controller.js";
import { handleZohoWebhook } from "./modules/zoho/webhooks/zoho.webhook.controller.js";
import { triggerOutboundMessage } from "./modules/zoho/webhooks/zoho.trigger.controller.js";
import { zohoCallbackHandler } from "./modules/zoho/zoho.controller.js";
import { handleOAuthCallback } from "./modules/tenant/razorpay.oauth.controller.js";

// ═══════════════════════════════════════════════════════════════
// APP SETUP
// ═══════════════════════════════════════════════════════════════
const app = express();
app.set("trust proxy", 1);

// ═══════════════════════════════════════════════════════════════
// HEALTH & CRAWLERS
// ═══════════════════════════════════════════════════════════════
app.get("/sradmin/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send("User-agent: *\nAllow: /\n");
});

// ═══════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ═══════════════════════════════════════════════════════════════
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: false,
    frameguard: false,
  }),
);

// ═══════════════════════════════════════════════════════════════
// BODY PARSER (with raw body capture for webhooks)
// ═══════════════════════════════════════════════════════════════
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      if (
        req.originalUrl &&
        (req.originalUrl.includes("webhook") ||
          req.originalUrl.includes("auth-events"))
      ) {
        req.rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ═══════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════
const allowedOrigins = (process.env.FRONTEND_URLS || "")
  .split(",")
  .map((url) => url.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// ═══════════════════════════════════════════════════════════════
// BULL BOARD DASHBOARD (Secured)
// ═══════════════════════════════════════════════════════════════
app.use("/admin/queues", bullBoardAuth, serverAdapter.getRouter());

// ═══════════════════════════════════════════════════════════════
// STATIC FILES
// ═══════════════════════════════════════════════════════════════
app.use(
  "/uploads/logos",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Cross-Origin-Embedder-Policy", "unsafe-none");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept",
    );
    next();
  },
  express.static(path.join(process.cwd(), "uploads/logos"), {
    setHeaders: (res) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("Access-Control-Allow-Origin", "*");
    },
  }),
);

app.use(
  "/uploads",
  (req, res, next) => {
    if (req.path.startsWith("/invoices")) {
      return res.status(403).json({
        success: false,
        message:
          "Direct access to invoice files is forbidden. Use the authenticated download API.",
      });
    }
    res.removeHeader("X-Frame-Options");
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    next();
  },
  express.static(path.join(process.cwd(), "uploads")),
);

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING — REMOVED from app level.
// All auth routes now use route-level rateLimiter middleware
// from backend/src/middleware/rateLimiter.js (Phase 3).
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// MEDIA ROUTES (signed-URL serving)
// ═══════════════════════════════════════════════════════════════
app.use("/sradmin/media", mediaRoutes);

// ═══════════════════════════════════════════════════════════════
// WEBHOOKS & OAUTH CALLBACKS (specific routes — must come first)
// ═══════════════════════════════════════════════════════════════
app.use("/sradmin/webhook", webhookRoutes);

app.use("/sradmin/flows", flowRoutes);
app.use("/tenant/flows", flowRoutes);

app.post("/sradmin/webhooks/woocommerce", handleWooCommerceWebhook);
app.post("/sradmin/woocommerce/webhook", handleWooCommerceWebhook);
app.post("/tenant/webhooks/woocommerce", handleWooCommerceWebhook);
app.post("/tenant/woocommerce/webhook", handleWooCommerceWebhook);

app.get("/sradmin/auth/razorpay/callback", handleOAuthCallback);
app.get("/tenant/auth/razorpay/callback", handleOAuthCallback);
app.get("/auth/razorpay/callback", handleOAuthCallback);

app.get("/sradmin/zoho/callback", zohoCallbackHandler);
app.get("/tenant/zoho/callback", zohoCallbackHandler);
app.get("/auth/zoho/callback", zohoCallbackHandler);

app.post("/sradmin/zoho/webhook", handleZohoWebhook);
app.post("/sradmin/zoho/trigger/message", triggerOutboundMessage);

// ═══════════════════════════════════════════════════════════════
// LEGACY /api/* ALIASES — DO NOT RENAME
// ═══════════════════════════════════════════════════════════════
app.get("/api/zoho/callback", zohoCallbackHandler);
app.post("/api/zoho/webhook", handleZohoWebhook);
app.post("/api/zoho/trigger/message", triggerOutboundMessage);
app.get("/api/auth/razorpay/callback", handleOAuthCallback);
app.post("/api/webhooks/woocommerce", handleWooCommerceWebhook);
app.post("/api/woocommerce/webhook", handleWooCommerceWebhook);

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════
app.use("/sradmin", publicRoutes);
app.use("/tenant", publicRoutes);

// ═══════════════════════════════════════════════════════════════
// NEW AUTH ROUTES — mounted BEFORE old routes (first match wins)
// ═══════════════════════════════════════════════════════════════
app.use("/tenant", tenantAuthRoutes);
app.use("/tenant/user", userAuthRoutes);
app.use("/sradmin", sradminAuthRoutes);

// ═══════════════════════════════════════════════════════════════
// NEW SRADMIN TENANT MANAGEMENT (Phase 9)
// ═══════════════════════════════════════════════════════════════
app.use("/sradmin/tenants", sradminTenantRoutes);

// ═══════════════════════════════════════════════════════════════
// OLD SUPERADMIN ROUTES (revenue, GST, notifications, audit, etc.)
// Auth + tenant CRUD paths are shadowed by new routes above.
// ═══════════════════════════════════════════════════════════════
app.use("/sradmin", superadminRoutes);
app.use("/sradmin", adminTicketRoutes);
app.use("/sradmin", revenueRoutes);
app.use("/sradmin", enquiryRoutes);
app.use("/sradmin/plans", planRoutes);
app.use("/sradmin/billing", billingRoutes);
app.use("/sradmin/google-sheets", googleSheetsRoutes);
app.use("/sradmin/super-admin/notifications", superAdminNotificationRoutes);
app.use("/sradmin/admin/subscriptions", adminSubscriptionsRoute);
app.use("/sradmin/superadmin/audit-logs", auditLogRoutes);
app.use("/sradmin/dlq", dlqRoutes);
app.use("/sradmin/register/enterprise-lead", enterpriseLeadRoutes);
app.use("/sradmin/admin/enterprise-leads", enterpriseLeadAdminRoutes);

// ═══════════════════════════════════════════════════════════════
// OLD TENANT ROUTES (contacts, conversations, etc.)
// Auth paths shadowed by new tenantAuthRoutes above.
// ═══════════════════════════════════════════════════════════════
app.use("/tenant", tenantRoutes);
app.use("/tenant", ticketRoutes);
app.use("/tenant", enquiryRoutes);
app.use("/tenant/contacts", contactRoutes);
app.use("/tenant/conversations", conversationRoutes);
app.use("/tenant/messages", messageRoutes);
app.use("/tenant/tags", tagRoutes);
app.use("/tenant/templates", templateRoutes);
app.use("/tenant/broadcasts", broadcastRoutes);
app.use("/tenant/quick-replies", quickReplyRoutes);
app.use("/tenant/orders", orderRoutes);
app.use("/tenant/analytics", analyticsRoutes);
app.use("/tenant/notifications", notificationRoutes);
app.use("/tenant/plans", planRoutes);
app.use("/tenant/billing", billingRoutes);
app.use("/tenant/google-sheets", googleSheetsRoutes);
app.use("/tenant/register/enterprise-lead", enterpriseLeadRoutes);

// ═══════════════════════════════════════════════════════════════
// OLD USER / AGENT ROUTES (non-auth paths)
// ═══════════════════════════════════════════════════════════════
app.use("/tenant/user", userRoutes);

// ═══════════════════════════════════════════════════════════════
// INTEGRATION ROUTES
// ═══════════════════════════════════════════════════════════════
app.use("/tenant/whatsapp", whatsappRoutes);
app.use("/tenant/shopify", shopifyRoutes);
app.use("/tenant/woocommerce", woocommerceRoutes);
app.use("/tenant/zoho", zohoRoutes);

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLERS
// ═══════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found`,
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  const isProduction = process.env.NODE_ENV === "production";
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500 && isProduction
        ? "Internal Server Error"
        : err.message || "Internal Server Error",
  });
});

export default app;