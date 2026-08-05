import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import superadminRoutes from './modules/superadmin/superadminRoute.js';
import tenantRoutes from './modules/tenant/tenantRoutes.js';
import userRoutes from './modules/users/userRoutes.js';
import contactRoutes from './modules/contacts/contactRoutes.js';
import conversationRoutes from './modules/conversations/conversationRouter.js';
import messageRoutes from './modules/messages/messageRoute.js';
import tagRoutes from './modules/tags/tagRoutes.js';
import cors from 'cors'
import webhookRoutes from './modules/webhook/webhookRoutes.js';
import planRoutes from "./modules/plans/planRoutes.js";
import templateRoutes from './modules/templates/templateRoutes.js';
import broadcastRoutes from './modules/broadcasts/broadcastRoutes.js';
import whatsappRoutes from './modules/whatsapp/whatsappRoutes.js';
import notificationRoutes from "./modules/notifications/notificationRoutes.js";
import superAdminNotificationRoutes from "./modules/SuperAdminNotifications/superAdminNotificationRoutes.js";
import revenueRoutes from "./modules/revenue/revenueRoutes.js";
import ticketRoutes from "./modules/tickets/ticketRoutes.js";
import adminTicketRoutes from "./modules/tickets/adminTicketRoutes.js";
import flowRoutes from './modules/automation/flowRoutes.js'
import path from "path";

// Enquiries and Enterprise Leads
import enquiryRoutes from './modules/enquiries/enquiryRoute.js';
import enterpriseLeadRoutes from './modules/enterprise-leads/enterpriseLeadRoute.js';
import enterpriseLeadAdminRoutes from './modules/enterprise-leads/enterpriseLeadAdminRoute.js';

import billingRoutes from './modules/billing/billingRoutes.js';
import adminSubscriptionsRoute from './modules/admin-subscriptions/adminSubscriptionsRoute.js';

import auditLogRoutes from './modules/audit/auditLogRoutes.js';
import dlqRoutes from './modules/webhook/dlqRoutes.js';
import mediaRoutes from './modules/messages/mediaRoute.js';
import { verifyTenantOrUser } from './middlewares/authVerfyTenOrUser.js';

import analyticsRoutes from './modules/analytics/analyticsRoutes.js';

import publicRoutes from './modules/public/publicRoutes.js';

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

// Apply security headers
app.use(
  helmet({
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups",
    },
    crossOriginResourcePolicy: false,  // 🆕 Allow cross-origin resources (for logos in <img>)
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
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// 🔧 ═══════════════════════════════════════════════════════════
// 🔧 STATIC FILES - UPDATED
// 🔧 ═══════════════════════════════════════════════════════════

// ✅ PUBLIC: Logos accessible without auth (needed for <img> tags in browser)
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

// // 🔒 PROTECTED: All other uploads (tickets, contacts, etc.) require auth
// app.use("/uploads", verifyTenantOrUser, (req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Cross-Origin-Resource-Policy", "cross-origin");
//   next();
// }, express.static(path.join(process.cwd(), "uploads")));


app.use('/api/media', mediaRoutes);

// 🔧 ═══════════════════════════════════════════════════════════

app.use(cookieParser());

// ── CORS ──
const allowedOrigins = (process.env.FRONTEND_URLS || '')
  .split(",")
  .map((url) => url.trim());

// ── Static Files ──
app.use("/uploads", verifyTenantOrUser, (req, res, next) => {
  // 🔒 Security: Block direct static web access to invoices
  if (req.path.startsWith("/invoices")) {
    return res.status(403).json({
      success: false,
      message: "Direct access to invoice files is forbidden. Use the authenticated download API.",
    });
  }
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header("Access-Control-Allow-Origin", requestOrigin);
  }
  res.header("Cross-Origin-Resource-Policy", "same-site");
  next();
}, express.static(path.join(process.cwd(), "uploads")));


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

// ── Rate Limiting on Auth Routes ──
app.use('/api/login',            authLimiter);
app.use('/api/create',           authLimiter);
app.use('/api2/login',           authLimiter);
app.use('/api2/register',        authLimiter);
app.use('/api2/forgot-password', authLimiter);
app.use('/api2/reset-password',  authLimiter);
app.use('/api3/login',           authLimiter);

// ──────────────────────────────────────
// ⭐ SPECIFIC ROUTES FIRST
// ──────────────────────────────────────

app.use('/api/webhook', webhookRoutes)
app.use('/api/flows', flowRoutes)

// ──────────────────────────────────────
// PUBLIC ROUTES — accessible from both frontends
// ──────────────────────────────────────
app.use('/api',  publicRoutes);
app.use('/api2', publicRoutes);

// ──────────────────────────────────────
// MAIN ROUTES
// ──────────────────────────────────────

app.use('/api',  superadminRoutes)
app.use('/api2', tenantRoutes)
app.use('/api3', userRoutes)

app.use('/api4',          contactRoutes)
app.use('/api2/contacts', contactRoutes)

app.use('/api5', conversationRoutes)
app.use('/api6', messageRoutes)
app.use('/api7', tagRoutes)

app.use("/api/plans",  planRoutes)
app.use("/api2/plans", planRoutes)

app.use('/api8', templateRoutes)
app.use('/api9', broadcastRoutes)

app.use('/api2/whatsapp',       whatsappRoutes)
app.use("/api2/notifications",  notificationRoutes)
app.use("/api/super-admin/notifications", superAdminNotificationRoutes)

app.use("/api2", ticketRoutes)
app.use("/api",  adminTicketRoutes)
app.use("/api",  revenueRoutes)

// Analytics
app.use('/api2/analytics', analyticsRoutes);

// Enquiries and Enterprise Leads mounting
app.use("/api", enquiryRoutes);
app.use("/api2", enquiryRoutes);
app.use("/api/register/enterprise-lead", enterpriseLeadRoutes);
app.use("/api2/register/enterprise-lead", enterpriseLeadRoutes);
app.use("/api/admin/enterprise-leads", enterpriseLeadAdminRoutes);

app.use('/api/billing', billingRoutes);
app.use('/api2/billing', billingRoutes);
app.use('/api/admin/subscriptions', adminSubscriptionsRoute);

app.use('/api/superadmin/audit-logs', auditLogRoutes);
app.use('/api/dlq', dlqRoutes);


// ──────────────────────────────────────
// ERROR HANDLERS
// ──────────────────────────────────────
// 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found`
  });
});

// Global Error
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