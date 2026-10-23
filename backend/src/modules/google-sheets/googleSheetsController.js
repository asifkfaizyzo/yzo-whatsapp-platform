import * as googleSheetsService from './googleSheetsService.js';

// ── 1. Auth & Connection Handlers ──

export const getAuthUrl = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const userId = req.user?.id || req.tenant?.id;
    // 💡 Capture caller frontend origin (e.g. http://localhost:5174)
    const returnUrl = req.headers.referer || req.headers.origin;
    const url = googleSheetsService.getAuthUrl(tenantId, userId, returnUrl);
    return res.json({ success: true, data: { url } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const result = await googleSheetsService.handleCallback(code, state);

    // 💡 Priority: Dynamic frontend caller URL → env variable → localhost:5174
    let targetOrigin = process.env.FRONTEND_URL || 'http://localhost:5174';

    if (result?.returnUrl) {
      try {
        const parsed = new URL(result.returnUrl);
        targetOrigin = parsed.origin;
      } catch (e) {
        // ignore invalid URL
      }
    }

    // ✅ CHANGED: redirect to Integrations page instead of Settings
    return res.redirect(`${targetOrigin}/dashboard/integrations?app=google-sheets&sheet=connected`);
  } catch (error) {
    console.error('OAuth Callback Error:', error);
    const targetOrigin = process.env.FRONTEND_URL || 'http://localhost:5174';
    // ✅ CHANGED: error also goes to Integrations page
    return res.redirect(`${targetOrigin}/dashboard/integrations?app=google-sheets&sheet=error`);
  }
};

export const getStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const status = await googleSheetsService.getConnectionStatus(tenantId);
    return res.json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const disconnect = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    await googleSheetsService.disconnect(tenantId);
    return res.json({ success: true, message: 'Google Sheets disconnected' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 2. Custom Column Fields Handlers ──

export const getFields = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const fields = await googleSheetsService.getFieldsForTenant(tenantId);
    return res.json({ success: true, data: fields });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createField = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { fieldName, fieldType, options, defaultValue, isRequired } = req.body;
    const field = await googleSheetsService.addField(tenantId, {
      fieldName,
      fieldType,
      options,
      defaultValue,
      isRequired,
    });
    return res.json({ success: true, data: field });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateField = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { fieldId } = req.params;
    
    const field = await googleSheetsService.updateField(fieldId, tenantId, req.body);
    return res.json({ success: true, data: field });
  } catch (error) {
    console.error('[UpdateField Error]:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const toggleField = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { fieldId } = req.params;
    const { isActive } = req.body;
    const field = await googleSheetsService.toggleField(fieldId, tenantId, isActive);
    return res.json({ success: true, data: field });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteField = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { fieldId } = req.params;
    await googleSheetsService.deleteField(fieldId, tenantId);
    return res.json({ success: true, message: 'Field deleted successfully' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const reorderFields = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { fieldOrders } = req.body;
    const fields = await googleSheetsService.reorderFields(tenantId, fieldOrders);
    return res.json({ success: true, data: fields });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const syncFields = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    console.log(`[GoogleSheets Controller] Syncing fields in background for tenant: ${tenantId}`);
    
    // Fire-and-forget: Trigger the sync task without awaiting it
    googleSheetsService.syncFieldsToSheet(tenantId).catch(error => {
      const errorMsg = error?.response?.data?.error?.message || error.message || 'Sync failed';
      console.error('[GoogleSheets Background Sync Error]:', errorMsg);
    });

    // Respond immediately so the frontend toast shows up instantly
    return res.json({ 
      success: true, 
      message: 'Sheet structure repair started in the background. Your sheet will update in a few seconds.' 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── 3. Preview & Broadcast Handlers ──

export const previewSheet = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const { sheetUrl, tabName } = req.query;
    const preview = await googleSheetsService.previewSheet(tenantId, sheetUrl, tabName);
    return res.json({ success: true, data: preview });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const createBroadcast = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.tenant?.id;
    const userId = req.user?.id || req.tenant?.id;
    const broadcast = await googleSheetsService.createBroadcastFromSheet({
      ...req.body,
      tenantId,
      userId,
    });
    return res.json({ success: true, data: broadcast });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};