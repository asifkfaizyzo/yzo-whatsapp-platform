import { google } from 'googleapis';
import { getOAuth2Client } from '../../config/googleSheets.js';
import prisma from '../../config/prisma.js';


// ── Helper: Convert column number to letter (1→A, 26→Z, 27→AA) ──
const getColumnLetter = (num) => {
  let letter = '';
  while (num > 0) {
    const mod = (num - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
};


// ── 🆕 Sync current field config & native dropdown validations to Google Sheet (CRASH-PROOF) ──
export const syncFieldsToSheet = async (tenantId) => {
  try {
    const sheetId = await getOrCreateLeadSheetId(tenantId);
    if (!sheetId) throw new Error('No sheet found. Connect Google Sheets first.');

    const sheets = await getSheetsClientForTenant(tenantId);
    const activeFields = await getActiveFieldsForTenant(tenantId);

    if (activeFields.length === 0) {
      throw new Error('No active fields to sync.');
    }

    // 1. Fetch exact spreadsheet metadata & dynamic grid limits
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const targetSheet =
      meta.data.sheets?.find((s) => s.properties.title === 'Lead Status') ||
      meta.data.sheets?.[0];

    const tabTitle = targetSheet?.properties?.title || 'Lead Status';
    const tabNumericId = targetSheet?.properties?.sheetId ?? 0;
    const sheetRows = targetSheet?.properties?.gridProperties?.rowCount || 100;
    const sheetCols = targetSheet?.properties?.gridProperties?.columnCount || 26;

    // 🏷️ FORCE RENAME DOCUMENT IN GOOGLE DRIVE TO "SudoReply..."
    try {
      const conn = await prisma.googleSheetConnection.findUnique({ where: { tenantId } });
      if (conn?.accessToken) {
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({ access_token: conn.accessToken, refresh_token: conn.refreshToken });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.update({
          fileId: sheetId,
          requestBody: { name: 'SudoReply Lead & Order Status Tracking' },
        });
        console.log(`[GoogleSheets Sync] 🏷️ Document renamed to "SudoReply Lead & Order Status Tracking"`);
      }
    } catch (renameErr) {
      console.warn(`[GoogleSheets Sync] Title rename warning:`, renameErr.message);
    }

    // 2. Clear Row 1 headers
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `'${tabTitle}'!1:1`,
    });

    // 3. Write active field names into Row 1
    const headers = [activeFields.map((f) => f.fieldName)];
    const lastColLetter = getColumnLetter(activeFields.length);

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${tabTitle}'!A1:${lastColLetter}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: headers },
    });

    // 4. Build formatting requests
    const requests = [];

    // 🎨 A. Style Header Row ONLY (Row 1: Dark Navy Background, Bold White Text)
    requests.push({
      repeatCell: {
        range: {
          sheetId: tabNumericId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: Math.min(activeFields.length, sheetCols),
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.15, green: 0.2, blue: 0.3 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });

    // 🧹 B. RESET DATA ROWS (Row 2 downwards) to Plain White Background + Dark Text
    requests.push({
      repeatCell: {
        range: {
          sheetId: tabNumericId,
          startRowIndex: 1,           // Row 2 downwards
          endRowIndex: sheetRows,
          startColumnIndex: 0,
          endColumnIndex: sheetCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 }, // White background
            textFormat: { bold: false, foregroundColor: { red: 0, green: 0, blue: 0 }, fontSize: 10 },
            horizontalAlignment: 'LEFT',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });

        // 📋 C. Process Data Validations for every column
    // for (let i = 0; i < activeFields.length; i++) {
    //   if (i >= sheetCols) break;
    //   const field = activeFields[i];

    //   if (field.fieldType === 'dropdown') {

        // 📋 C. Process Data Formats & Validations for every column
    for (let i = 0; i < activeFields.length; i++) {
      if (i >= sheetCols) break;
      const field = activeFields[i];

     // 🔒  FORCE TEXT FORMAT for Phone, Order ID, Text columns to prevent scientific notation (9.19E+11)
      if (field.fieldType === 'phone' || field.fieldType === 'text' || field.fieldKey === 'phone_number') {
        requests.push({
          repeatCell: {
            range: {
              sheetId: tabNumericId,
              startRowIndex: 1,
              endRowIndex: sheetRows,
              startColumnIndex: i,
              endColumnIndex: i + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'TEXT' },
                horizontalAlignment: 'LEFT',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        });
      }

      if (field.fieldType === 'dropdown') {

        let optionsList = [];

        if (Array.isArray(field.options)) {
          optionsList = field.options;
        } else if (typeof field.options === 'string') {
          try {
            const parsed = JSON.parse(field.options);
            optionsList = Array.isArray(parsed) ? parsed : field.options.split(',');
          } catch {
            optionsList = field.options.split(',');
          }
        }

        optionsList = optionsList.map((o) => String(o).trim()).filter((o) => o.length > 0);

        if (optionsList.length > 0) {
          // Set dropdown list for dropdown fields
          requests.push({
            setDataValidation: {
              range: {
                sheetId: tabNumericId,
                startRowIndex: 1,
                endRowIndex: sheetRows,
                startColumnIndex: i,
                endColumnIndex: i + 1,
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: optionsList.map((opt) => ({ userEnteredValue: opt })),
                },
                showCustomUi: true,
                strict: false,
              },
            },
          });
        }
      } else {
        // 🧹 EXPLICITLY CLEAR dropdown arrows/rules for non-dropdown fields (Order ID, Text, Amount, Phone)
        requests.push({
          setDataValidation: {
            range: {
              sheetId: tabNumericId,
              startRowIndex: 1,
              endRowIndex: sheetRows,
              startColumnIndex: i,
              endColumnIndex: i + 1,
            },
          },
        });
      }
    }

    // 5. Commit batch update
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests },
      });
    }

    console.log(`[GoogleSheets Sync] ✅ Successfully synced ${activeFields.length} headers & reset data formatting!`);

    return {
      success: true,
      activeFields: activeFields.length,
      sheetId,
    };
  } catch (err) {
    console.error(`[GoogleSheets Sync Error]:`, err?.response?.data?.error || err.message);
    throw err;
  }
};

// ── Helper: Get Google Sheets Client for a Tenant ────────────────
export const getSheetsClientForTenant = async (tenantId) => {
  const conn = await prisma.googleSheetConnection.findUnique({
    where: { tenantId },
  });

  if (!conn || !conn.accessToken) {
    throw new Error('Google Sheets is not connected for this tenant.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
};


// ══════════════════════════════════════════════════════════════
// 🆕 SECTION: CUSTOM FIELD MANAGEMENT
// ══════════════════════════════════════════════════════════════

// ── 🆕 NEW: Seed 8 default fields if not already present ──
export const seedDefaultFields = async (tenantId) => {
  const existing = await prisma.sheetField.findMany({ where: { tenantId } });

  const defaultFields = [
    { fieldName: 'Timestamp',      fieldKey: 'timestamp',      fieldType: 'date',     fieldCategory: 'system',  isRequired: true,  isActive: true, columnOrder: 1 },
    { fieldName: 'Contact Name',   fieldKey: 'contact_name',   fieldType: 'text',     fieldCategory: 'system',  isRequired: true,  isActive: true, columnOrder: 2 },
    { fieldName: 'Phone Number',   fieldKey: 'phone_number',   fieldType: 'phone',    fieldCategory: 'system',  isRequired: true,  isActive: true, columnOrder: 3 },
    { fieldName: 'Lead Status',    fieldKey: 'lead_status',    fieldType: 'dropdown', fieldCategory: 'default', isRequired: false, isActive: true, columnOrder: 4, options: ['New Lead', 'Contacted', 'Qualified', 'Converted', 'Lost'] },
    { fieldName: 'Order ID',       fieldKey: 'order_id',       fieldType: 'text',     fieldCategory: 'default', isRequired: false, isActive: true, columnOrder: 5 },
    { fieldName: 'Total Amount',   fieldKey: 'total_amount',   fieldType: 'number',   fieldCategory: 'default', isRequired: false, isActive: true, columnOrder: 6 },
    { fieldName: 'Payment Status', fieldKey: 'payment_status', fieldType: 'dropdown', fieldCategory: 'default', isRequired: false, isActive: true, columnOrder: 7, options: ['Pending', 'Paid', 'Failed', 'Refunded'] },
    { fieldName: 'Payment Method', fieldKey: 'payment_method', fieldType: 'dropdown', fieldCategory: 'default', isRequired: false, isActive: true, columnOrder: 8, options: ['Cash on Delivery', 'Online Payment', 'UPI', 'Bank Transfer', 'Pending'] },
    { fieldName: 'Products',       fieldKey: 'products',       fieldType: 'text',     fieldCategory: 'default', isRequired: false, isActive: true, columnOrder: 9 },
    { fieldName: 'Delivery Location', fieldKey: 'delivery_location', fieldType: 'text', fieldCategory: 'default', isRequired: false, isActive: true, columnOrder: 10 },
    { fieldName: 'Notes',          fieldKey: 'notes',          fieldType: 'text',     fieldCategory: 'default', isRequired: false, isActive: true, columnOrder: 11 },
  ];

  if (existing.length === 0) {
    await prisma.sheetField.createMany({
      data: defaultFields.map(f => ({ ...f, tenantId })),
    });
    console.log(`[SheetFields] Seeded 8 default fields for tenant ${tenantId}`);
  } else {
    // Backfill any missing default or system fields
    for (const def of defaultFields) {
      const found = existing.some(e => e.fieldKey === def.fieldKey);
      if (!found) {
        await prisma.sheetField.create({
          data: { ...def, tenantId },
        });
      }
    }
  }
};

// ── 🆕 NEW: Get all fields for a tenant (auto-seeds defaults first) ──
export const getFieldsForTenant = async (tenantId) => {
  await seedDefaultFields(tenantId);
  return await prisma.sheetField.findMany({
    where: { tenantId },
    orderBy: { columnOrder: 'asc' },
  });
};

// ── 🆕 NEW: Get only ACTIVE fields (for building sheet rows) ──
export const getActiveFieldsForTenant = async (tenantId) => {
  await seedDefaultFields(tenantId);
  return await prisma.sheetField.findMany({
    where: { tenantId, isActive: true },
    orderBy: { columnOrder: 'asc' },
  });
};

// ── 🆕 NEW: Add a custom field (appended AFTER all defaults at 9+) ──
export const addField = async (tenantId, { fieldName, fieldType, options, defaultValue, isRequired }) => {
  await seedDefaultFields(tenantId);

  const fieldKey = fieldName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');

  const existing = await prisma.sheetField.findUnique({
    where: { tenantId_fieldKey: { tenantId, fieldKey } },
  });
  if (existing) {
    throw new Error(`A field with key "${fieldKey}" already exists.`);
  }

  const lastField = await prisma.sheetField.findFirst({
    where: { tenantId },
    orderBy: { columnOrder: 'desc' },
  });
  const nextOrder = (lastField?.columnOrder || 8) + 1;

   const newField = await prisma.sheetField.create({
    data: {
      tenantId,
      fieldName: fieldName.trim(),
      fieldKey,
      fieldType: fieldType || 'text',
      fieldCategory: 'custom',
      isActive: true,
      isRequired: Boolean(isRequired),
      defaultValue: defaultValue || null,
      columnOrder: nextOrder,
      options: Array.isArray(options) ? options : undefined,
    },
  });

  // Auto-sync new field to Google Sheet headers (Background Sync)
  syncFieldsToSheet(tenantId).catch(e => {
    console.warn('[addField] Auto-sync background failed:', e.message);
  });

  return newField;
};

// ── 🆕 NEW: Update a field ──
// ── 🆕 Update a field (Handles custom & default columns) ──
export const updateField = async (fieldId, tenantId, { fieldName, fieldType, options, defaultValue, isRequired, isActive }) => {
  // Find by ID or tenantId + id
  const field = await prisma.sheetField.findFirst({
    where: { 
      id: fieldId, 
      tenantId: tenantId 
    },
  });

  if (!field) {
    throw new Error('Field not found or you do not have permission to edit it.');
  }

  // System fields cannot be renamed or change type
  if (field.fieldCategory === 'system' && fieldName && fieldName !== field.fieldName) {
    throw new Error('System fields cannot be renamed.');
  }

  const updateData = {};
  if (fieldName) updateData.fieldName = fieldName.trim();
  if (fieldType) updateData.fieldType = fieldType;
  if (options !== undefined) updateData.options = options;
  if (defaultValue !== undefined) updateData.defaultValue = defaultValue || null;
  if (isRequired !== undefined) updateData.isRequired = Boolean(isRequired);
  if (isActive !== undefined && field.fieldCategory !== 'system') updateData.isActive = Boolean(isActive);

   const updated = await prisma.sheetField.update({
    where: { id: fieldId },
    data: updateData,
  });

   // Auto-sync if field name or active status changed (Background Sync)
  if (updateData.fieldName || updateData.isActive !== undefined) {
    syncFieldsToSheet(tenantId).catch(e => {
      console.warn('[updateField] Auto-sync background failed:', e.message);
    });
  }

  return updated;
};

// ── 🆕 NEW: Toggle a field ON/OFF ──
export const toggleField = async (fieldId, tenantId, isActive) => {
  const field = await prisma.sheetField.findFirst({
    where: { id: fieldId, tenantId },
  });
  if (!field) throw new Error('Field not found');

  if (field.fieldCategory === 'system') {
    throw new Error('System fields cannot be disabled.');
  }

  const newStatus = typeof isActive === 'boolean' ? isActive : !field.isActive;

  const updated = await prisma.sheetField.update({
    where: { id: fieldId },
    data: { isActive: newStatus },
  });

   // Auto-sync headers after toggle (Background Sync)
  syncFieldsToSheet(tenantId).catch(e => {
    console.warn('[toggleField] Auto-sync background failed:', e.message);
  });

  return updated;
};

// ── 🆕 NEW: Delete a custom field ──
export const deleteField = async (fieldId, tenantId) => {
  const field = await prisma.sheetField.findFirst({
    where: { id: fieldId, tenantId },
  });
  if (!field) throw new Error('Field not found');

  if (field.fieldCategory !== 'custom') {
    throw new Error('Only custom fields can be deleted. Use toggle for default fields.');
  }

  const deleted = await prisma.sheetField.delete({
    where: { id: fieldId },
  });

   // Auto-sync headers after deletion (Background Sync)
  syncFieldsToSheet(tenantId).catch(e => {
    console.warn('[deleteField] Auto-sync background failed:', e.message);
  });

  return deleted;
};

// ── 🆕 NEW: Reorder fields ──
export const reorderFields = async (tenantId, fieldOrders) => {
  const updates = fieldOrders.map(({ fieldId, columnOrder }) =>
    prisma.sheetField.updateMany({
      where: { id: fieldId, tenantId },
      data: { columnOrder },
    })
  );

  await prisma.$transaction(updates);

  // Auto-sync new order to Google Sheet headers (Background Sync)
  syncFieldsToSheet(tenantId).catch(e => {
    console.warn('[reorderFields] Auto-sync background failed:', e.message);
  });

  return await getFieldsForTenant(tenantId);
};



// ── Helper: Find or Create Default Tracking Sheet via Drive API ──
export const getOrCreateLeadSheetId = async (tenantId, authClient = null) => {
  let client = authClient;
  if (!client) {
    const conn = await prisma.googleSheetConnection.findUnique({ where: { tenantId } });
    if (!conn) return null;
    client = getOAuth2Client();
    client.setCredentials({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
    });
  }

  const drive = google.drive({ version: 'v3', auth: client });
    // 1. Search Google Drive for existing sheet (checks both new name and old YZO name)
  const res = await drive.files.list({
    q: "(name = 'SudoReply Lead & Order Status Tracking' or name = 'YZO Lead & Order Status Tracking') and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    const existingFile = res.data.files[0];

    // 🔄 Auto-rename old "YZO" sheet to "SudoReply" in Google Drive
    if (existingFile.name.includes('YZO')) {
      try {
        await drive.files.update({
          fileId: existingFile.id,
          requestBody: { name: 'SudoReply Lead & Order Status Tracking' },
        });
        console.log(`[GoogleSheets] 🏷️ Auto-renamed existing sheet to "SudoReply Lead & Order Status Tracking"`);
      } catch (renameErr) {
        console.warn(`[GoogleSheets] Could not auto-rename sheet:`, renameErr.message);
      }
    }

    return existingFile.id;
  }

  // 2. If not found, create new sheet with headers
  const sheets = google.sheets({ version: 'v4', auth: client });
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'SudoReply Lead & Order Status Tracking' },
      sheets: [{ properties: { title: 'Lead Status' } }],
    },
  });


  const spreadsheetId = spreadsheet.data.spreadsheetId;
  
  // ✅ NEW — Dynamic headers from DB
// Seed default fields if this is first time
await seedDefaultFields(tenantId);

const activeFields = await getActiveFieldsForTenant(tenantId);
const headers = [activeFields.map(f => f.fieldName)];

// Calculate range dynamically: A1:H1 for 8 fields, A1:K1 for 11 fields, etc.
const lastCol = getColumnLetter(activeFields.length);
const range = `'Lead Status'!A1:${lastCol}1`;

await sheets.spreadsheets.values.update({
  spreadsheetId,
  range,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: headers },
});

// 🆕 Group all dropdown validation rules into a single batch update payload (Optimized)
const validationRequests = [];

for (let i = 0; i < activeFields.length; i++) {
  const field = activeFields[i];
  if (field.fieldType === 'dropdown' && field.options && field.options.length > 0) {
    validationRequests.push({
      setDataValidation: {
        range: {
          sheetId: 0,
          startColumnIndex: i,
          endColumnIndex: i + 1,
          startRowIndex: 1,
          endRowIndex: 1000,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: field.options.map(opt => ({ userEnteredValue: String(opt) })),
          },
          showCustomUi: true,
          strict: false,
        },
      },
    });
  }
}

// Fire single API request if dropdowns exist
if (validationRequests.length > 0) {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: validationRequests },
    });
  } catch (valErr) {
    console.warn(`[SheetFields] Batch dropdown validation error:`, valErr.message);
  }
}


  console.log(`[GoogleSheets] Created new lead tracking sheet with ID: ${spreadsheetId}`);
  return spreadsheetId;
};

// ── OAuth: 1. Generate Auth URL ─────────────────────────────────
export const getAuthUrl = (tenantId, userId, returnUrl = null) => {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];

  const state = Buffer.from(JSON.stringify({ tenantId, userId, returnUrl })).toString('base64');

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state,
  });
};

// ── OAuth: 2. Handle Google Callback ────────────────────────────
export const handleCallback = async (code, stateOrTenantId, rawUserId) => {
  let tenantId = stateOrTenantId;
  let userId = rawUserId || null;
  let returnUrl = null;

  if (typeof stateOrTenantId === 'string') {
    try {
      const decodedStr = Buffer.from(stateOrTenantId, 'base64').toString('utf-8');
      const decoded = JSON.parse(decodedStr);
      if (decoded && decoded.tenantId) {
        tenantId = decoded.tenantId;
        userId = decoded.userId || userId;
        returnUrl = decoded.returnUrl || null;
      }
    } catch (e) {
      // state was raw tenantId string
    }
  }
  let tenant = null;
  if (tenantId) {
    tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  }

  if (!tenant) {
    tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      throw new Error('No valid tenant record found in database.');
    }
    tenantId = tenant.id;
  }

  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const connection = await prisma.googleSheetConnection.upsert({
    where: { tenantId },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      connectedBy: userId,
      status: 'active',
      updatedAt: new Date(),
    },
    create: {
      tenantId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      connectedBy: userId,
      status: 'active',
    },
  });

  // Automatically find or create initial tracking sheet in Google Drive
  try {
    await getOrCreateLeadSheetId(tenantId, oauth2Client);
  } catch (sheetErr) {
    console.error('[GoogleSheets] Failed to initialize default sheet:', sheetErr.message);
  }

  return connection;
};

// ── OAuth: 3. Connection Status ────────────────────────────────
export const getConnectionStatus = async (tenantId) => {
  if (!tenantId) return { isConnected: false, status: 'disconnected' };

  const connection = await prisma.googleSheetConnection.findUnique({
    where: { tenantId },
  });

  if (!connection || connection.status !== 'active') {
    return { isConnected: false, status: 'disconnected' };
  }

  let spreadsheetId = null;
  let spreadsheetUrl = null;

  try {
    spreadsheetId = await getOrCreateLeadSheetId(tenantId);
    if (spreadsheetId) {
      spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    }
  } catch (e) {
    console.warn('[GoogleSheets] Could not fetch sheet status URL:', e.message);
  }

  return {
    isConnected: true,
    status: connection.status,
    spreadsheetId,
    spreadsheetUrl,
    sheetName: 'Lead Status',
    connectedAt: connection.connectedAt,
    connectedBy: connection.connectedBy,
  };
};

// ── OAuth: 4. Disconnect ───────────────────────────────────────
export const disconnect = async (tenantId) => {
  const connection = await prisma.googleSheetConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) return;

  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
    });
    await oauth2Client.revokeCredentials();
  } catch (err) {
    console.warn('Could not revoke token directly from Google:', err.message);
  }

  return await prisma.googleSheetConnection.delete({
    where: { tenantId },
  });
};

// ── 5. Extract Sheet ID from a Google Sheet URL ────────────────
export const extractSheetId = (urlOrId) => {
  if (!urlOrId) return null;
  if (!urlOrId.includes('/')) return urlOrId.trim();
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

// ── 6. Read all rows from a Google Sheet tab ───────────────────
export const readSheetData = async (tenantId, sheetId, tabName = 'Lead Status') => {
  const sheets = await getSheetsClientForTenant(tenantId);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!A:Z`,
  });

  const rows = response.data.values || [];
  if (rows.length < 2) {
    return { headers: [], dataRows: [] };
  }

  const headers = rows[0].map(h => (h || '').trim());
  const dataRows = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = (row[idx] || '').trim();
    });
    return obj;
  });

  return { headers, dataRows };
};

// ── 7. Preview Sheet ───────────────────────────────────────────
export const previewSheet = async (tenantId, sheetUrlOrId, tabName = 'Lead Status') => {
  const sheetId = extractSheetId(sheetUrlOrId);
  if (!sheetId) throw new Error('Invalid Google Sheet URL or ID');

  const { headers, dataRows } = await readSheetData(tenantId, sheetId, tabName);

  return {
    sheetId,
    tabName,
    headers,
    totalRows: dataRows.length,
    previewRows: dataRows.slice(0, 5),
  };
};

// ── 8. Create & Launch Broadcast from Google Sheet ────────────
export const createBroadcastFromSheet = async ({
  tenantId,
  userId,
  name,
  templateId,
  sheetUrlOrId,
  tabName = 'Lead Status',
  columnMapping,
}) => {
  const sheetId = extractSheetId(sheetUrlOrId);
  if (!sheetId) throw new Error('Invalid Google Sheet URL or ID');

  const { headers, dataRows } = await readSheetData(tenantId, sheetId, tabName);
  if (dataRows.length === 0) throw new Error('Sheet is empty or has no data rows');

  const phoneColumn = Object.keys(columnMapping).find(
    key => columnMapping[key] === 'phone'
  );
  if (!phoneColumn) throw new Error('You must map one column to "phone"');

  const template = await prisma.template.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new Error('Template not found');

  const contacts = [];
  const recipientParamsMap = new Map();

  for (const row of dataRows) {
    const phone = (row[phoneColumn] || '').replace(/[^0-9+]/g, '');
    if (!phone || phone.length < 8) continue;

    let contact = await prisma.contact.findFirst({
      where: { phone, tenantId },
    });

    if (!contact) {
      const nameColumn = Object.keys(columnMapping).find(
        key => columnMapping[key] === 'name'
      );
      contact = await prisma.contact.create({
        data: {
          phone,
          name: nameColumn ? (row[nameColumn] || 'Unknown') : 'Unknown',
          tenantId,
        },
      });
    }

    contacts.push(contact);

    const bodyParams = [];
    const variableMappings = Object.entries(columnMapping)
      .filter(([, val]) => val && val.startsWith('{{'))
      .sort((a, b) => {
        const numA = parseInt(a[1].match(/\d+/)[0]);
        const numB = parseInt(b[1].match(/\d+/)[0]);
        return numA - numB;
      });

    for (const [columnName] of variableMappings) {
      bodyParams.push(row[columnName] || '-');
    }

    recipientParamsMap.set(contact.id, { body: bodyParams });
  }

  if (contacts.length === 0) throw new Error('No valid phone numbers found in the sheet');

  const broadcast = await prisma.broadcast.create({
    data: {
      tenantId,
      name,
      templateId,
      targetType: 'GOOGLE_SHEET',
      sheetId,
      sheetTabName: tabName,
      columnMapping,
      defaultParams: { body: [] },
      status: 'PROCESSING',
      totalRecipients: contacts.length,
      createdById: userId,
    },
  });

  const recipientRecords = contacts.map(contact => ({
    broadcastId: broadcast.id,
    contactId: contact.id,
    status: 'PENDING',
  }));

  await prisma.broadcastRecipient.createMany({
    data: recipientRecords,
    skipDuplicates: true,
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  const jobs = contacts.map(contact => ({
    name: `broadcast-${broadcast.id}-${contact.id}`,
    data: {
      broadcastId: broadcast.id,
      tenant,
      contact,
      template,
      defaultParams: recipientParamsMap.get(contact.id) || { body: [] },
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    },
  }));

  const { broadcastQueue } = await import('../../queues/broadcastQueue.js');
  await broadcastQueue.addBulk(jobs);

  console.log(`🚀 Queued ${jobs.length} Google Sheet broadcast jobs for campaign ${broadcast.id}`);

  return {
    broadcastId: broadcast.id,
    totalRecipients: contacts.length,
    status: 'PROCESSING',
  };
};



// ── 9. Log Lead & Order Status directly to Google Sheet (FIXED) ─────────
// ── 9. Log Lead & Order Status directly to Google Sheet (FIXED) ─────────
export async function logLeadStatusToSheet(tenantId, payload) {
  try {
    const sheets = await getSheetsClientForTenant(tenantId);
    const spreadsheetId = await getOrCreateLeadSheetId(tenantId);

    if (!spreadsheetId) {
      console.warn(`[GoogleSheets] No sheet found for tenant ${tenantId}, skipping.`);
      return;
    }

    const TAB_NAME = 'Lead Status';

    // 1. Fetch current sheet headers & existing data
    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB_NAME}'!A1:Z1000`,
    });

    const rows = getRes.data.values || [];
    if (rows.length === 0) return;

    const headers = rows[0].map(h => String(h).trim());

    // 💡 Auto-check if required columns (Products, Delivery Location, etc.) are missing from Row 1 and add them
    const requiredHeaders = ['Timestamp', 'Contact Name', 'Phone Number', 'Lead Status', 'Order ID', 'Total Amount', 'Payment Status', 'Payment Method', 'Products', 'Delivery Location', 'Notes'];
    let headersUpdated = false;

    for (const reqH of requiredHeaders) {
      const exists = headers.some(h => h.toLowerCase() === reqH.toLowerCase());
      if (!exists) {
        headers.push(reqH);
        headersUpdated = true;
      }
    }

    if (headersUpdated) {
      try {
        const lastColLetter = getColumnLetter(headers.length);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${TAB_NAME}'!A1:${lastColLetter}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headers] },
        });
        console.log(`[GoogleSheets] ➕ Auto-updated Row 1 headers to include missing columns: ${headers.join(', ')}`);
      } catch (headerUpdateErr) {
        console.warn('[GoogleSheets] Header auto-update notice:', headerUpdateErr.message);
      }
    }

    // 2. Find Phone & Order ID Columns for Smart Order History Matching
    const phoneColIndex = headers.findIndex(h => 
      ['phone', 'phone number', 'contact phone', 'wa_id'].includes(h.toLowerCase())
    );
    const orderIdColIndex = headers.findIndex(h => 
      ['order id', 'order_id', 'orderid'].includes(h.toLowerCase())
    );

    const targetPhone = String(
      payload["Phone Number"] || payload["Phone"] || payload.phone_number || payload.phone || ''
    ).trim();
    
    const targetOrderId = String(
      payload["Order ID"] || payload.order_id || payload.orderId || ''
    ).trim();

    let existingRowIndex = -1;

    if (phoneColIndex !== -1 && targetPhone) {
      const cleanTarget = targetPhone.replace(/[^0-9]/g, '');
      for (let i = 1; i < rows.length; i++) {
        const rowPhone = String(rows[i][phoneColIndex] || '').trim().replace(/[^0-9]/g, '');
        const rowOrderId = orderIdColIndex !== -1 ? String(rows[i][orderIdColIndex] || '').trim() : '';

        const phoneMatches = rowPhone && cleanTarget && (rowPhone === cleanTarget || rowPhone.endsWith(cleanTarget.slice(-8)));

        if (phoneMatches) {
          // Matches if: Order ID matches exactly OR row has the same active order
          const orderIdMatches = !targetOrderId || !rowOrderId || rowOrderId.toLowerCase() === targetOrderId.toLowerCase();

          if (orderIdMatches) {
            existingRowIndex = i + 1; // Google Sheets row numbers are 1-based
            break;
          }
        }
      }
    }

    // 3. Construct row values — wrapped safely in headers.map()
    const newRowValues = headers.map(header => {
      const lh = header.toLowerCase();

      if (lh.includes('timestamp') || lh === 'date')
        return payload["Timestamp"] || payload.timestamp || new Date().toLocaleString();

      if (lh.includes('contact name') || lh === 'name')
        return payload["Contact Name"] || payload.contact_name || payload.contactName || '';

      // if (lh.includes('phone'))
      //   return payload["Phone Number"] || payload["Phone"] || payload.phone_number || payload.phone || '';
 
       if (lh.includes('phone')) {
        const rawPhone = payload["Phone Number"] || payload["Phone"] || payload.phone_number || payload.phone || '';
        if (!rawPhone) return '';
        const digits = String(rawPhone).trim().replace(/[^0-9]/g, '');
        
        // 🔒 Format with a space (+91 9911223344) to force Excel/CSV to keep it as Plain Text
        if (digits.length > 10) {
          const countryCode = digits.slice(0, digits.length - 10);
          const nationalNumber = digits.slice(digits.length - 10);
          return `+${countryCode} ${nationalNumber}`;
        } else if (digits.length === 10) {
          return `+91 ${digits}`;
        }
        return `+${digits}`;
      }  

      if (lh.includes('lead status') || lh.includes('order status'))
        return payload["Order Status"] || payload["Lead Status"] || payload.lead_status || payload.status || '';

      if (lh.includes('order id') || lh === 'orderid')
        return payload["Order ID"] || payload.order_id || payload.orderId || '';

      // 💳 STRICT PAYMENT FIELD MAPPING
      if (lh.includes('payment method') || lh.includes('pay method'))
        return payload["Payment Method"] || payload.payment_method || payload.paymentMethod || "WhatsApp Interactive";

      if (lh.includes('payment status') || lh.includes('pay status'))
        return payload["Payment Status"] || payload.payment_status || payload.paymentStatus || "Pending";

      if (lh.includes('amount'))
        return payload["Total Amount"] || payload["Amount"] || payload.total_amount || payload.amount || '';

      if (lh.includes('product') || lh.includes('items'))
        return payload["Products"] || payload["Items"] || payload.products || payload.items || '';

      if (lh.includes('location') || lh.includes('address'))
        return payload["Delivery Location"] || payload["Location"] || payload["Address"] || payload.delivery_location || payload.location || payload.address || '';

      if (lh.includes('notes'))
        return payload["Notes"] || payload.notes || '';

      return payload[header] || payload[lh] || '';
    });

       // 4. Update existing row OR Append new row (RAW keeps phone numbers as literal text strings)
    if (existingRowIndex > 0) {
      console.log(`[GoogleSheets] 🔄 Updating row #${existingRowIndex} for ${targetPhone}`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TAB_NAME}'!A${existingRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: { values: [newRowValues] },
      });
    } else {
      console.log(`[GoogleSheets] ➕ Appending new row for ${targetPhone}`);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${TAB_NAME}'!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [newRowValues] },
      });
    }

    console.log(`[GoogleSheets] ✅ Synced successfully for ${targetPhone}`);
  } catch (error) {
    console.error('❌ [logLeadStatusToSheet]:', error?.response?.data?.error || error.message);
  }
}