import express from 'express';
import { verifyTenant, requireApprovedTenant } from '../../middlewares/authTenant.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';
import { setupWhatsApp, getWhatsAppStatus, getMyWabas, disconnectWhatsApp,sendLocation, } from './whatsappController.js';
import { 
  acceptCall, rejectCall, terminateCall, initiateCall, 
  getCallPermissions, requestCallPermission,
  getCallSettings, updateCallSettings, uploadVoicemailGreeting
} from './callController.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/temp/' });
import { setupWhatsAppSchema } from '../../validations/tenant.validation.js';
import validate from '../../middlewares/validate.middleware.js';
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js';
import { sendLocationSchema } from '../../validations/whatsapp.validation.js';

const router = express.Router();

// GET /api2/whatsapp/status - Allowed for both Tenants and Users (Agents)
router.get('/status', verifyTenantOrUser, getWhatsAppStatus);

// send-location
router.post('/send-location',verifyTenantOrUser, checkSubscriptionAccess, validate(sendLocationSchema),sendLocation);

// Call Management Routes (Allowed for both Tenants and Users)
router.post('/calls/accept', verifyTenantOrUser, acceptCall);
router.post('/calls/reject', verifyTenantOrUser, rejectCall);
router.post('/calls/terminate', verifyTenantOrUser, terminateCall);
router.post('/calls/initiate', verifyTenantOrUser, checkSubscriptionAccess, initiateCall);
router.get('/calls/permissions/:contactId', verifyTenantOrUser, getCallPermissions);
router.post('/calls/permissions/request', verifyTenantOrUser, checkSubscriptionAccess, requestCallPermission);

// All other routes require a verified, approved tenant admin
router.use(verifyTenant, requireApprovedTenant);

// POST /api2/whatsapp/exchange-token
// Exchanges auth code for long-lived access token and saves WABA/Phone to tenant
router.post('/exchange-token', exchangeToken);

// POST /api2/whatsapp/setup
// Saves WABA ID + Phone Number ID directly (fallback system token approach)
router.post('/setup',validate(setupWhatsAppSchema), setupWhatsApp);

// POST /api2/whatsapp/register-phone
// Completes Cloud API phone number registration with Meta
router.post('/register-phone', registerPhoneNumber);

// GET /api2/whatsapp/status
// Returns whether this tenant has a WhatsApp number connected
router.get('/status', getWhatsAppStatus);

// GET /api2/whatsapp/my-businesses
// Fetches Meta Business Portfolios using system user token (business_management)
// router.get('/my-businesses', getMyBusinesses);

// GET /api2/whatsapp/my-wabas
// Returns available WABAs for fallback connection
router.get('/my-wabas', getMyWabas);

// POST /api2/whatsapp/disconnect
// Disconnects WhatsApp integration for the tenant
router.post('/disconnect', disconnectWhatsApp);

// Call Settings Routes (Tenant Admin only)
router.get('/calls/settings/:phoneId', getCallSettings);
router.put('/calls/settings/:phoneId', updateCallSettings);
router.post('/calls/settings/:phoneId/voicemail-greeting', upload.single('audio'), uploadVoicemailGreeting);


export default router;