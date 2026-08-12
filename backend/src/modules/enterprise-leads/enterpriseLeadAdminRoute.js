import { Router } from 'express';
import { 
  getLeads, 
  getLead, 
  updateStatus, 
  updateNotes, 
  activateTenant, 
  deleteLead 
} from './enterpriseLeadController.js';
import { verifySuperAdmin } from '../../middlewares/authSuperAdmin.js';

const router = Router();

// Apply Super Admin Authentication to all admin lead routes
router.use(verifySuperAdmin);

router.get('/', getLeads);
router.get('/:id', getLead);
router.patch('/:id/status', updateStatus);
router.patch('/:id/notes', updateNotes);
router.post('/:id/activate', activateTenant);
router.delete('/:id', deleteLead);

export default router;
