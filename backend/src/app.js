// backend/src/app.js (do not remove this comment)

import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import path from "path";

// Route Imports
import superadminRoutes from './modules/superadmin/superadmin.routes.js';
import tenantRoutes from './modules/tenant/tenant.routes.js';
import userRoutes from './modules/users/user.routes.js';
import contactRoutes from './modules/contacts/contact.routes.js';
import conversationRoutes from './modules/conversations/conversation.routes.js';
import messageRoutes from './modules/messages/message.routes.js';
import tagRoutes from './modules/tags/tag.routes.js';
import webhookRoutes from './modules/webhook/webhook.routes.js';
import planRoutes from "./modules/plans/plan.routes.js";
import templateRoutes from './modules/templates/template.routes.js';
import broadcastRoutes from './modules/broadcasts/broadcast.routes.js';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes.js';
import googleSheetsRoutes from './modules/google-sheets/googleSheets.routes.js';
import shopifyRoutes from './modules/shopify/shopify.routes.js';
import woocommerceRoutes from './modules/woocommerce/woocommerce.routes.js';
import { handleWooCommerceWebhook } from './modules/webhook/woocommerce.webhook.controller.js';
import notificationRoutes from "./modules/notifications/notification.routes.js";
import superAdminNotificationRoutes from "./modules/superadmin-notifications/superadminNotification.routes.js";
import revenueRoutes from "./modules/revenue/revenue.routes.js";
import ticketRoutes from "./modules/tickets/ticket.routes.js";
import adminTicketRoutes from "./modules/tickets/ticket.admin.routes.js";
import flowRoutes from './modules/automation/flow.routes.js';
import mediaRoutes from './modules/messages/media.routes.js';
import quickReplyRoutes from './modules/quick-replies/quickReply.routes.js';
import orderRoutes from './modules/orders/order.routes.js';

// Enquiries and Enterprise Leads
import enquiryRoutes from './modules/enquiries/enquiry.routes.js';
import enterpriseLeadRoutes from './modules/enterprise-leads/enterpriseLead.routes.js';
import enterpriseLeadAdminRoutes from './modules/enterprise-leads/enterpriseLead.admin.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';
import adminSubscriptionsRoute from './modules/admin-subscriptions/adminSubscription.routes.js';
import auditLogRoutes from './modules/audit/audit.routes.js';
import dlqRoutes from './modules/webhook/dlq.routes.js';

// Zoho CRM Integration Imports
import zohoRoutes from './modules/zoho/zoho.routes.js';
import { handleZohoWebhook } from './modules/zoho/zoho.webhook.controller.js';
import { zohoCallbackHandler } from './modules/zoho/zoho.controller.js';
import { triggerOutboundMessage } from './modules/zoho/zoho.trigger.controller.js';

// Other Imports
import { verifyTenantOrUser } from './middlewares/auth.verifyTenantOrUser.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import { serverAdapter } from './config/bull.board.js';
import { bullBoardAuth } from './middlewares/auth.bullBoard.js';
import { handleOAuthCallback } from './modules/tenant/razorpay.oauth.controller.js';

const app = express();

app.set('trust proxy', 1);

// Add Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Allow Meta and search crawlers cleanly
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nAllow: /\n');
});

// Apply security headers
app.use(
  helmet({
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups",
    },
    crossOriginResourcePolicy: false,
    frameguard: false,
  })
);

// Configure rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Body Parser ──
// app.use(express.json({
//   limit: '10mb',
//   verify: (req, res, buf) => {
//     if (req.originalUrl && req.originalUrl.includes('/api/webhook')) {
//       req.rawBody = buf;
//     }
//   }
// }));
// app.use(express.urlencoded({ extended: true }));

// ── Body Parser ──
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && (req.originalUrl.includes('webhook') || req.originalUrl.includes('auth-events'))) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// 📊 Bull Board Queue Dashboard (Secured with Basic Auth)
app.use('/admin/queues', bullBoardAuth, serverAdapter.getRouter());

// 🔧 STATIC LOGO FILES
app.use("/uploads/logos", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  res.header("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
}, express.static(path.join(process.cwd(), "uploads/logos"), {
  setHeaders: (res) => {
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Access-Control-Allow-Origin", "*");
  }
}));

app.use('/api/media', mediaRoutes);

app.use(cookieParser());

// ── CORS ──
const allowedOrigins = (process.env.FRONTEND_URLS || '')
  .split(",")
  .map((url) => url.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// ── Static Files ──
app.use("/uploads", (req, res, next) => {
  if (req.path.startsWith("/invoices")) {
    return res.status(403).json({
      success: false,
      message: "Direct access to invoice files is forbidden. Use the authenticated download API.",
    });
  }
  res.removeHeader("X-Frame-Options");
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  next();
}, express.static(path.join(process.cwd(), "uploads")));

// ── Rate Limiting on Auth Routes ──
app.use('/api/login',            authLimiter);
app.use('/api/create',           authLimiter);
app.use('/api2/login',           authLimiter);
app.use('/api2/register',        authLimiter);
app.use('/api2/forgot-password', authLimiter);
app.use('/api2/reset-password',  authLimiter);
app.use('/api3/login',           authLimiter);

// ──────────────────────────────────────
// ⭐ SPECIFIC WEBHOOK ROUTES FIRST
// ──────────────────────────────────────
app.use('/api/webhook', webhookRoutes);
app.use('/api/flows', flowRoutes);

// WooCommerce Direct Webhook Aliases (Fixes 404 errors)
app.post('/api/webhooks/woocommerce', handleWooCommerceWebhook);
app.post('/api/woocommerce/webhook', handleWooCommerceWebhook);

app.post('/api2/webhooks/woocommerce', handleWooCommerceWebhook);
app.post('/api2/woocommerce/webhook', handleWooCommerceWebhook);

// ──────────────────────────────────────
// PUBLIC OAUTH CALLBACKS & WEBHOOKS
// ──────────────────────────────────────
app.get('/api/auth/razorpay/callback', handleOAuthCallback);
app.get('/api2/auth/razorpay/callback', handleOAuthCallback);
app.get('/auth/razorpay/callback', handleOAuthCallback);

// Zoho CRM OAuth Redirect Endpoints
app.get('/api/zoho/callback', zohoCallbackHandler);
app.get('/api2/zoho/callback', zohoCallbackHandler);
app.get('/auth/zoho/callback', zohoCallbackHandler);

// Zoho CRM Webhook Ingestion & Messaging Trigger
app.post('/api/zoho/webhook', handleZohoWebhook);
app.post('/api/zoho/trigger/message', triggerOutboundMessage);

// General Public Endpoints
app.use('/api',  publicRoutes);
app.use('/api2', publicRoutes);

// ──────────────────────────────────────
// MAIN SaaS ROUTES
// ──────────────────────────────────────
app.use('/api',  superadminRoutes);
app.use('/api2', tenantRoutes);
app.use('/api3', userRoutes);

app.use('/api4',          contactRoutes);
app.use('/api2/contacts', contactRoutes);

app.use('/api5', conversationRoutes);
app.use('/api6', messageRoutes);
app.use('/api7', tagRoutes);

app.use("/api/plans",  planRoutes);
app.use("/api2/plans", planRoutes);

app.use('/api8', templateRoutes);
app.use('/api9', broadcastRoutes);

app.use('/api2/whatsapp',       whatsappRoutes);
app.use('/api/google-sheets', googleSheetsRoutes);
app.use('/api2/google-sheets', googleSheetsRoutes);
app.use('/api2/shopify', shopifyRoutes);
app.use('/api2/woocommerce', woocommerceRoutes);
app.use("/api2/notifications",  notificationRoutes)
app.use("/api/super-admin/notifications", superAdminNotificationRoutes)
app.use('/api2/quick-replies', quickReplyRoutes)

app.use("/api2", ticketRoutes);
app.use("/api",  adminTicketRoutes);
app.use("/api",  revenueRoutes);

// Analytics & Reports
app.use('/api2/analytics', analyticsRoutes);
app.use("/api", enquiryRoutes);
app.use("/api2", enquiryRoutes);

// Enterprise Leads
app.use("/api/register/enterprise-lead", enterpriseLeadRoutes);
app.use("/api2/register/enterprise-lead", enterpriseLeadRoutes);
app.use("/api/admin/enterprise-leads", enterpriseLeadAdminRoutes);

// Billing & Subscriptions
app.use('/api/billing', billingRoutes);
app.use('/api2/billing', billingRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionsRoute);

// Security Audit logs & DLQ Failovers
app.use('/api/superadmin/audit-logs', auditLogRoutes);
app.use('/api/dlq', dlqRoutes);
app.use('/api2/orders', orderRoutes);

// Zoho Protected API endpoints
app.use('/api2/zoho', zohoRoutes);

// ──────────────────────────────────────
// ERROR HANDLERS
// ──────────────────────────────────────
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found`
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && isProduction
      ? 'Internal Server Error'
      : (err.message || 'Internal Server Error')
  });
});

export default app;
