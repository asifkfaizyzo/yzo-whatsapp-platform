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
import templateRoutes from './modules/templates/templateRoutes.js';
import broadcastRoutes from './modules/broadcasts/broadcastRoutes.js';

const app = express();

// Apply security headers
app.use(helmet());
// Configure rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(cookieParser());

const allowedOrigins = process.env.FRONTEND_URLS.split(",");

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Apply rate limiting to sensitive routes (login, register, forgot/reset password)
app.use('/api/login', authLimiter);
app.use('/api/create', authLimiter);
app.use('/api2/login', authLimiter);
app.use('/api2/register', authLimiter);
app.use('/api2/forgot-password', authLimiter);
app.use('/api2/reset-password', authLimiter);
app.use('/api3/login', authLimiter);

app.use('/api', superadminRoutes);

app.use('/api2', tenantRoutes);

app.use('/api3', userRoutes);
  
app.use('/api4', contactRoutes);

app.use('/api5', conversationRoutes);

app.use('/api6', messageRoutes);

app.use('/api7',tagRoutes);

app.use('/api/webhook', webhookRoutes);

app.use('/api8', templateRoutes);

app.use('/api9', broadcastRoutes);

// 1. 404 Handler (Place this AFTER all routes)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} not found on this server.`
  });
});

// 2. Global Error Handler (Place this as the LAST middleware)
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

export default app;