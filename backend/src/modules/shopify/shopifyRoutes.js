import express from 'express';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import * as shopifyController from './shopifyController.js';

const router = express.Router();

// All routes are protected by tenant/user auth
router.use(verifyTenantOrUser);

router.post('/connect', shopifyController.connect);
router.get('/status', shopifyController.getStatus);
router.delete('/disconnect', shopifyController.disconnect);

export default router;