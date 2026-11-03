// backend/src/modules/tenant/conversations/tenant.conversations.controller.js (do not remove this comment)
import {
    listConversations,
    getAutoReopenConfigService,
    updateAutoReopenConfigService,
} from './tenant.conversations.service.js';

export const listConversationsController = async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await listConversations(tenantId, { page, limit });

        return res.status(200).json({
            success: true,
            message: 'Conversations fetched successfully',
            ...result,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getAutoReopenConfig = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const config = await getAutoReopenConfigService(tenantId);
        return res.status(200).json({
            success: true,
            data: config
        });
    } catch (error) {
        next(error);
    }
};

export const updateAutoReopenConfig = async (req, res, next) => {
    try {
        const tenantId = req.tenant?.id;
        const config = await updateAutoReopenConfigService(tenantId, req.body);
        return res.status(200).json({
            success: true,
            message: 'Auto-reopen configuration updated successfully',
            data: config,
        });
    } catch (error) {
        next(error);
    }
};
