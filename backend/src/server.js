import express from 'express';
import dotenv from 'dotenv';
import superadminRoutes from './modules/superadmin/superadminRoute.js';

dotenv.config();

const app = express();

app.use(express.json());

const port = process.env.PORT || 3000;

app.use('/api', superadminRoutes);

app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});