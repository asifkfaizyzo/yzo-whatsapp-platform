import express from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { createTag, getTags,assignUserToTag,removeUserFromTag } from './tagController.js';


const router = express.Router();


router.post('/createtag', verifyTenant, createTag);

router.get('/get-all-tag', verifyTenant, getTags);
// "Assign a user to handle this tag"
router.post('/:tagId/assign-user', verifyTenant, assignUserToTag);
//Remove User from Tag
router.delete('/:tagId/users/:userId', verifyTenant, removeUserFromTag);


export default router;