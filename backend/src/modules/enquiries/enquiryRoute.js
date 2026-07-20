import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { 
  submitEnquiry, 
  getEnquiries, 
  getEnquiry, 
  updateStatus, 
  deleteEnquiry 
} from './enquiryController.js';
import { verifySuperAdmin } from '../../middlewares/authSuperAdmin.js';

const router = Router();

// Rate limiter: max 5 submissions per IP per hour
const enquiryRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many enquiry submissions from this IP. Please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public Routes ──
// POST /api/enquiries
router.post(
  '/enquiries',
  enquiryRateLimiter,
  [
    body('name').trim().notEmpty().withMessage('Full Name is required'),
    body('email').trim().isEmail().withMessage('Valid Email Address is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  submitEnquiry
);

// ── Admin Routes (Protected by Super Admin Auth) ──
// GET /api/admin/enquiries
router.get('/admin/enquiries', verifySuperAdmin, getEnquiries);

// GET /api/admin/enquiries/:id
router.get('/admin/enquiries/:id', verifySuperAdmin, getEnquiry);

// PATCH /api/admin/enquiries/:id/status
router.patch('/admin/enquiries/:id/status', verifySuperAdmin, updateStatus);

// DELETE /api/admin/enquiries/:id
router.delete('/admin/enquiries/:id', verifySuperAdmin, deleteEnquiry);

export default router;
