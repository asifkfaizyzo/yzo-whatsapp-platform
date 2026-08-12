import { Router } from 'express';
import { body } from 'express-validator';
import { 
  submitEnterpriseLead, 
  resetEnterpriseLead 
} from './enterpriseLeadController.js';
import { verifyOnboarding } from '../../middlewares/authTenant.js';

const router = Router();

// Onboarding endpoints (Secured by onboarding session token cookie)
router.post(
  '/',
  verifyOnboarding,
  [
    body('companyName').trim().notEmpty().withMessage('Company Name is required'),
    body('contactName').trim().notEmpty().withMessage('Contact Name is required'),
    body('email').trim().isEmail().withMessage('Valid Email is required'),
    body('companySize').isIn(['1-10', '11-50', '51-200', '200+']).withMessage('Valid Company Size is required'),
    body('timeline').isIn(['urgent', '1-3months', 'exploring']).withMessage('Valid Timeline is required'),
    body('preferredContact').isIn(['email', 'phone', 'video_call']).withMessage('Preferred Contact Method is required'),
    body('estimatedUsers').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Estimated users must be a positive integer'),
  ],
  submitEnterpriseLead
);

router.post(
  '/reset',
  verifyOnboarding,
  resetEnterpriseLead
);

export default router;
