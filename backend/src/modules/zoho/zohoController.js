// src/modules/zoho/zohoController.js 

import { extractRequestMeta } from '../../lib/utils/requestMeta.js';
import {
  getOAuthAuthorizeUrl,
  handleOAuthCallback,
  getZohoConnectionStatus,
  testZohoConnection,
  disconnectZoho,
} from './zohoService.js';
import {
  getTenantSyncStats,
  pullContactsFromZoho, 
} from './zohoContactService.js';
import { zohoSyncQueue } from '../../queues/zohoSyncQueue.js';
import { detectZohoPlan } from './zohoPlanService.js';
import { redisConnection } from '../../config/redis.js';

// New service imports for Cases, Products, Events, and Invoices
import { getZohoProducts } from './zohoProductService.js';
import { createZohoCalendarEvent } from './zohoEventService.js';
import { syncTicketToZohoCase } from './zohoCaseService.js';
import { sendZohoInvoiceToWhatsApp } from './zohoInvoiceService.js';

const DEFAULT_PREFERENCES = {
  syncDestination: 'CONTACTS', // 'CONTACTS' | 'LEADS'
  logConversationNotes: true,
  createDealsOnOrders: true,
  createFollowUpTasks: true,
  autoSyncNewContacts: true,
};

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

/**
 * GET /api2/zoho/plan
 * Returns detected Zoho plan and available features
 */

export const getPlanInfo = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Tenant not authenticated' });
    }

    const forceRefresh = req.query.refresh === 'true' || req.query.force === 'true';
    const plan = await detectZohoPlan(tenantId, forceRefresh);
    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
/**
 * GET /api2/zoho/preferences
 * Fetches tenant-specific Zoho automation toggles
 */
export const getPreferences = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const key = `zoho_prefs:${tenantId}`;
    const raw = await redisConnection.get(key);
    const prefs = raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;

    return res.status(200).json({ success: true, data: prefs });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api2/zoho/preferences
 * Updates tenant-specific Zoho automation toggles in Redis
 */
export const updatePreferences = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const key = `zoho_prefs:${tenantId}`;
    const current = await redisConnection.get(key);
    const existing = current ? JSON.parse(current) : DEFAULT_PREFERENCES;

    const updated = {
      ...existing,
      ...req.body,
    };

    await redisConnection.set(key, JSON.stringify(updated));

    return res.status(200).json({
      success: true,
      message: 'Zoho integration preferences updated',
      data: updated,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /api2/zoho/products
 * Fetch products from Zoho CRM
 */
export const listProducts = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { search, page, limit } = req.query;

    const data = await getZohoProducts(tenantId, { search, page, limit });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api2/zoho/events
 * Schedule an appointment in Zoho CRM and send WhatsApp confirmation
 */
export const bookEvent = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { contactId, title, startTime, endTime, venue } = req.body;

    if (!contactId || !startTime) {
      return res.status(400).json({ success: false, message: 'contactId and startTime are required' });
    }

    const result = await createZohoCalendarEvent(tenantId, contactId, { title, startTime, endTime, venue });
    return res.status(200).json({ success: result.success, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api2/zoho/tickets/:ticketId/sync-case
 * Push a ticket to Zoho Cases
 */
export const syncTicketCase = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { ticketId } = req.params;

    const caseId = await syncTicketToZohoCase(tenantId, ticketId);
    return res.status(200).json({ success: Boolean(caseId), data: { caseId } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api2/zoho/invoices/:invoiceId/send-whatsapp
 * Send a Zoho invoice notification over WhatsApp
 */
export const dispatchInvoice = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const { invoiceId } = req.params;
    const { contactId } = req.body;

    if (!contactId) {
      return res.status(400).json({ success: false, message: 'contactId is required' });
    }

    const result = await sendZohoInvoiceToWhatsApp(tenantId, contactId, invoiceId);
    return res.status(200).json({ success: result.success, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


export const triggerPullSync = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.tenantId;
    const result = await pullContactsFromZoho(tenantId);
    return res.status(200).json({
      success: true,
      message: `Imported ${result.totalImported} new contacts and updated ${result.totalUpdated} from Zoho CRM`,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
