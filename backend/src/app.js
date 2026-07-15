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

const app = express();

// ── Security ──
app.use(helmet());

// ── Rate Limiter ──
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
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// ── Static Files ──
app.use("/uploads", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(process.cwd(), "uploads")));

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
// (before generic /api catches them)
// ──────────────────────────────────────

// Webhook - always first
app.use('/api/webhook', webhookRoutes)

// Flow routes - before /api superadmin
app.use('/api/flows', flowRoutes)

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