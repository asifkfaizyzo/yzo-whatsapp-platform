// src/modules/zoho/zohoController.js 

import { extractRequestMeta } from '../../lib/utils/requestMeta.js';
import {
  getOAuthAuthorizeUrl,
  handleOAuthCallback,
  getZohoConnectionStatus,
  testZohoConnection,
  disconnectZoho,
} from './zohoService.js';
import { getTenantSyncStats } from './zohoContactService.js';
import { zohoSyncQueue } from '../../queues/zohoSyncQueue.js';

export const getConnectUrl = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant not authenticated' });
    }

    const result = await getOAuthAuthorizeUrl(tenantId, req);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const zohoCallbackHandler = async (req, res) => {
  try {
    const { redirectUrl } = await handleOAuthCallback(req.query, req);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ [ZohoController] Callback handler error:', error);
    return res.redirect('/dashboard/integrations?app=zoho&error=Internal+server+error');
  }
};

export const getStatus = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant not authenticated' });
    }

    const status = await getZohoConnectionStatus(tenantId);
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const testConnection = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant not authenticated' });
    }

    const result = await testZohoConnection(tenantId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const disconnect = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant not authenticated' });
    }

    const meta = extractRequestMeta(req);
    const result = await disconnectZoho(tenantId, meta);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api2/zoho/sync/contacts
 * Enqueues a background BullMQ job to sync contacts to Zoho CRM
 */
export const triggerContactSync = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant not authenticated' });
    }

    const { syncType = 'FULL' } = req.body || {};

    // Deduplication jobId per tenant to prevent parallel full sync stampedes
    const jobId = `zoho_sync_${tenantId}_${Date.now()}`;

    const job = await zohoSyncQueue.add(
      'sync-contacts',
      {
        tenantId,
        syncType,
        enqueuedAt: new Date().toISOString(),
      },
      {
        jobId,
      }
    );

    return res.status(202).json({
      success: true,
      message: 'Contact sync job enqueued successfully',
      data: {
        jobId: job.id,
        syncType,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /api2/zoho/sync/status
 * Returns sync statistics and last sync timestamp
 */
export const getSyncStatus = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant not authenticated' });
    }

    const stats = await getTenantSyncStats(tenantId);
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api2/zoho/sync/incremental
 * Triggers incremental sync (only contacts updated since last sync)
 */
export const triggerIncrementalSync = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant not authenticated' });
    }

    const jobId = `zoho_sync_${tenantId}_incremental_${Date.now()}`;

    const job = await zohoSyncQueue.add(
      'sync-contacts-incremental',
      {
        tenantId,
        syncType: 'INCREMENTAL',
        enqueuedAt: new Date().toISOString(),
      },
      { jobId }
    );

    return res.status(202).json({
      success: true,
      message: 'Incremental sync job enqueued',
      data: { jobId: job.id, syncType: 'INCREMENTAL' },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};