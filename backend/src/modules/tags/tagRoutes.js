import express from 'express';
import { verifyTenant } from '../../middlewares/authTenant.js';
import { createTag, getTags,assignUserToTag,changeUserTag } from './tagController.js';
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js';


const router = express.Router();


router.post('/createtag', verifyTenant, createTag);

router.get('/get-all-tag', verifyTenantOrUser, getTags);
// "Assign a user to handle this tag"
router.post('/:tagId/assign-user', verifyTenant, assignUserToTag);
//change User from OldTag to newTag
router.patch('/users/:userId/change-tag', verifyTenant, changeUserTag);


export default router;