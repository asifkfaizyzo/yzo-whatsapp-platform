import express from 'express';
import superadminRoutes from './modules/superadmin/superadminRoute.js';
import tenantRoutes from './modules/tenant/tenantRoutes.js';
import userRoutes from './modules/users/userRoutes.js';
import contactRoutes from './modules/contacts/contactRoutes.js';
import cors from 'cors'

const app = express();

app.use(express.json());

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

app.use('/api', superadminRoutes);

app.use('/api2', tenantRoutes);

app.use('/api3', userRoutes);
  
app.use('/api4', contactRoutes);

export default app;