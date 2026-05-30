import express from 'express';
import superadminRoutes from './modules/superadmin/superadminRoute.js';
import cors from 'cors'

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use('/api', superadminRoutes);

export default app;