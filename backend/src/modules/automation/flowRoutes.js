// src/modules/automation/flowRoutes.js

import express from 'express'
import flowController from './flowController.js'
import { verifyTenantOrUser } from '../../middlewares/authVerfyTenOrUser.js'
import { checkSubscriptionAccess } from '../../middlewares/checkSubscriptionAccess.js'

const router = express.Router()

router.use(verifyTenantOrUser)
router.use(checkSubscriptionAccess)

router.get('/',                   flowController.getAllFlows)
router.get('/:id',                flowController.getFlow)
router.post('/',                  flowController.createFlow)
router.put('/:id',                flowController.saveFlow)
router.delete('/:id',             flowController.deleteFlow)
router.patch('/:id/toggle',       flowController.toggleFlow)
router.patch('/:id/set-default',  flowController.setDefault)

// ── Keyword Routes ──
router.get('/keywords/all',        flowController.getAllKeywords)
router.get('/:id/keywords',        flowController.getKeywords)
router.post('/:id/keywords',       flowController.addKeywords)
router.delete('/keywords/:keywordId', flowController.removeKeyword)


export default router