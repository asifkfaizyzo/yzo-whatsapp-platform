import prisma from '../../config/prisma.js';
import fs from 'fs/promises';
import {
  fetchMetaTemplates,
  submitMetaTemplate,
  deleteMetaTemplate,
  uploadMediaToMeta,
  buildTemplateComponents,
  inferHeaderTypeFromComponents,
} from './templateService.js';
import { validateTemplateMediaSize } from '../../middlewares/templateUpload.middleware.js';

// ── Valid values ────────────────────────────────────────────────────────────
const VALID_HEADER_TYPES = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'];
const VALID_CATEGORIES   = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const MEDIA_HEADER_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT'];

// Meta LOCATION header only valid for MARKETING and UTILITY (not AUTHENTICATION)
const LOCATION_INCOMPATIBLE_CATEGORIES = ['AUTHENTICATION'];

// ── Count unique {{n}} variables in a text block ─────────────────────────────
const countPlaceholders = (text) => {
  if (!text) return 0;
  const matches = text.match(/\{\{(\d+)\}\}/g);
  return matches ? new Set(matches).size : 0;
};

// ── Safely delete a local file (non-throwing) ────────────────────────────────
const safeDeleteFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // Log but never fail the parent operation because of a stale file
    console.warn(`⚠️  Could not delete local template media file: ${filePath}`);
  }
};

// ─────────────────────────────────────────────────────────────
// 1. GET: Fetch all templates for the logged-in tenant
// ─────────────────────────────────────────────────────────────
export const getTemplates = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const templates = await prisma.template.findMany({
      where: { tenantId, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
};

// ─────────────────────────────────────────────────────────────
// 2. POST: Create a Template locally and register it on Meta
// ─────────────────────────────────────────────────────────────
export const createTemplate = async (req, res) => {
  const uploadedFile = req.file || null; // set by templateUpload multer middleware

  try {
    const tenantId = req.tenantId;
    const tenant   = req.tenant;

    // Parse form fields — multipart/form-data sends everything as strings
    const {
      name,
      category,
      language    = 'en_US',
      headerType  = 'NONE',
      headerText,
      // Location fields
      headerLocationName,
      headerLocationAddress,
      headerLocationLat,
      headerLocationLng,
      // Body
      bodyText,
      footerText,
    } = req.body;

    // Parse JSON fields that arrive as strings in multipart forms
    let bodyExampleValues = [];
    let buttons = [];
    try {
      if (req.body.bodyExampleValues) {
        bodyExampleValues = JSON.parse(req.body.bodyExampleValues);
      }
      if (req.body.buttons) {
        buttons = JSON.parse(req.body.buttons);
      }
    } catch {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(400).json({ success: false, message: 'Invalid JSON in bodyExampleValues or buttons field.' });
    }

    // ── Field validation ──────────────────────────────────────
    if (!name || !category || !bodyText) {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(400).json({ success: false, message: 'name, category, and bodyText are required.' });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(400).json({ success: false, message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.` });
    }

    if (!VALID_HEADER_TYPES.includes(headerType)) {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(400).json({ success: false, message: `Invalid headerType. Must be one of: ${VALID_HEADER_TYPES.join(', ')}.` });
    }

    if (bodyText.length > 1024) {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(400).json({ success: false, message: 'Body text must not exceed 1024 characters.' });
    }

    if (footerText && footerText.length > 60) {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(400).json({ success: false, message: 'Footer text must not exceed 60 characters.' });
    }

    // Header-type specific validation
    if (headerType === 'TEXT') {
      if (!headerText || !headerText.trim()) {
        if (uploadedFile) await safeDeleteFile(uploadedFile.path);
        return res.status(400).json({ success: false, message: 'headerText is required when headerType is TEXT.' });
      }
      if (headerText.length > 60) {
        if (uploadedFile) await safeDeleteFile(uploadedFile.path);
        return res.status(400).json({ success: false, message: 'Header text must not exceed 60 characters.' });
      }
    }

    if (MEDIA_HEADER_TYPES.includes(headerType) && !uploadedFile) {
      return res.status(400).json({ success: false, message: `A media file is required when headerType is ${headerType}.` });
    }

    if (headerType === 'LOCATION') {
      if (LOCATION_INCOMPATIBLE_CATEGORIES.includes(category)) {
        if (uploadedFile) await safeDeleteFile(uploadedFile.path);
        return res.status(400).json({
          success: false,
          message: 'LOCATION header type is not compatible with the AUTHENTICATION category.',
        });
      }
      const lat = parseFloat(headerLocationLat);
      const lng = parseFloat(headerLocationLng);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ success: false, message: 'Invalid latitude. Must be a number between -90 and 90.' });
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return res.status(400).json({ success: false, message: 'Invalid longitude. Must be a number between -180 and 180.' });
      }
    }

    // Per-type file size check (Multer already enforces the global 16 MB limit,
    // but IMAGE headers have a lower 5 MB limit)
    if (uploadedFile) {
      const sizeError = validateTemplateMediaSize(uploadedFile, headerType);
      if (sizeError) {
        await safeDeleteFile(uploadedFile.path);
        return res.status(400).json({ success: false, message: sizeError });
      }
    }

    // Check tenant WhatsApp credentials
    if (!tenant.whatsappWabaId || !tenant.whatsappAccessToken) {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(400).json({
        success: false,
        requiresWhatsApp: true,
        message: 'Please connect your WhatsApp Business Account in Settings before creating message templates.',
      });
    }

    // ── Clean template name ────────────────────────────────────
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // ── Check if a template with the same name + language already exists ──
    const existingTemplate = await prisma.template.findUnique({
      where: {
        name_language_tenantId: {
          name: cleanName,
          language,
          tenantId,
        },
      },
    });

    if (existingTemplate && existingTemplate.status !== 'DELETED') {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(409).json({
        success: false,
        message: `A template named "${cleanName}" already exists for language "${language}". Please choose a different name.`,
      });
    }

    // ── Upload media to Meta (if needed) ─────────────────────
    let headerMediaHandle = null;
    let headerMediaUrl    = null;

    if (MEDIA_HEADER_TYPES.includes(headerType)) {
      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('⚠️  MOCK_WHATSAPP=true → skipping Meta media upload, using mock handle');
        headerMediaHandle = `mock_handle_${Date.now()}`;
      } else {
        try {
          headerMediaHandle = await uploadMediaToMeta(tenant, uploadedFile.path, uploadedFile.mimetype);
        } catch (uploadErr) {
          await safeDeleteFile(uploadedFile.path);
          return res.status(502).json({
            success: false,
            code: uploadErr.code || 'META_MEDIA_UPLOAD_FAILED',
            message: `Failed to upload media to Meta: ${uploadErr.message}`,
          });
        }
      }

      // Store the local file path for preview/download purposes
      headerMediaUrl = uploadedFile.path.replace(/\\/g, '/');
    }

    // ── Build Meta components array ───────────────────────────
    const { components, validationError } = buildTemplateComponents({
      headerType,
      headerText:          headerType === 'TEXT'     ? headerText     : null,
      headerHandle:        headerMediaHandle,
      bodyText,
      bodyExampleValues,
      footerText,
      buttons,
    });

    if (validationError) {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(400).json({ success: false, message: validationError });
    }

    // ── Submit to Meta ────────────────────────────────────────
    let metaTemplateId = null;
    let initialStatus  = 'PENDING';

    if (process.env.MOCK_WHATSAPP === 'true') {
      console.log('⚠️  MOCK_WHATSAPP=true → creating mock template without Meta API call');
      metaTemplateId = `mock_tpl_${Date.now()}`;
      initialStatus  = 'APPROVED';
    } else {
      try {
        const metaRes = await submitMetaTemplate(tenant, {
          name: cleanName,
          category,
          language,
          components,
        });
        metaTemplateId = metaRes.id;
      } catch (err) {
        // Meta rejected the template — clean up local file and return friendly error
        if (uploadedFile) await safeDeleteFile(uploadedFile.path);
        return res.status(400).json({
          success: false,
          message: `Template creation failed. Meta rejected this template: ${err.message}`,
        });
      }
    }

    // ── Derive param counts for UI ────────────────────────────
    const headerParams = headerType === 'TEXT' ? countPlaceholders(headerText) : 0;
    const bodyParams   = countPlaceholders(bodyText);

    // ── Persist to local DB (create or update soft-deleted record) ─
    const templateData = {
      tenantId,
      metaTemplateId,
      name:           cleanName,
      language,
      category,
      status:         initialStatus,
      components,
      headerParams,
      bodyParams,

      // Header fields
      headerType,
      headerText:            headerType === 'TEXT'     ? headerText                     : null,
      headerMediaUrl,
      headerMediaHandle,
      headerLocationName:    headerType === 'LOCATION' ? (headerLocationName    || null) : null,
      headerLocationAddress: headerType === 'LOCATION' ? (headerLocationAddress || null) : null,
      headerLocationLat:     headerType === 'LOCATION' ? parseFloat(headerLocationLat)  : null,
      headerLocationLng:     headerType === 'LOCATION' ? parseFloat(headerLocationLng)  : null,
      footerText:            footerText || null,
      buttons:               buttons.length > 0 ? buttons : null,

      createdById: null,
    };

    let template;
    if (existingTemplate && existingTemplate.status === 'DELETED') {
      // Clean up previous media file if any
      if (existingTemplate.headerMediaUrl && existingTemplate.headerMediaUrl !== headerMediaUrl) {
        await safeDeleteFile(existingTemplate.headerMediaUrl);
      }
      template = await prisma.template.update({
        where: { id: existingTemplate.id },
        data: templateData,
      });
    } else {
      template = await prisma.template.create({
        data: templateData,
      });
    }

    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    // P2002 = Prisma unique constraint violation fallback
    if (error.code === 'P2002') {
      if (uploadedFile) await safeDeleteFile(uploadedFile.path);
      return res.status(409).json({
        success: false,
        message: `A template named "${req.body.name?.toLowerCase().replace(/[^a-z0-9_]/g, '_')}" already exists for language "${req.body.language || 'en_US'}". Please use a different template name.`,
      });
    }
    console.error('Error creating template:', error);
    if (uploadedFile) await safeDeleteFile(uploadedFile.path);
    return res.status(500).json({ success: false, message: 'Failed to create template.' });
  }
};


// ─────────────────────────────────────────────────────────────
// 3. POST: Sync Templates from Meta Business Account (WABA)
// ─────────────────────────────────────────────────────────────
export const syncTemplates = async (req, res) => {
  try {
    const tenant = req.tenant;

    if (!tenant.whatsappWabaId || !tenant.whatsappAccessToken) {
      return res.status(400).json({ success: false, message: 'WhatsApp Business Credentials are not configured in settings.' });
    }

    if (process.env.MOCK_WHATSAPP === 'true') {
      console.log('⚠️  MOCK_WHATSAPP=true → skipping Meta template sync, returning local templates');
      const localTemplates = await prisma.template.findMany({ where: { tenantId: tenant.id } });
      return res.status(200).json({ success: true, count: localTemplates.length, data: localTemplates });
    }

    const metaTemplates = await fetchMetaTemplates(tenant);
    const synced = [];

    for (const mt of metaTemplates) {
      const components = mt.components || [];

      // Infer typed header values from components
      const derivedHeaderType = inferHeaderTypeFromComponents(components);

      const headerComp   = components.find(c => c.type === 'HEADER');
      const footerComp   = components.find(c => c.type === 'FOOTER');
      const buttonsComp  = components.find(c => c.type === 'BUTTONS');
      const bodyComp     = components.find(c => c.type === 'BODY');

      const derivedHeaderText         = derivedHeaderType === 'TEXT' ? (headerComp?.text || null) : null;
      const derivedHeaderMediaHandle  = MEDIA_HEADER_TYPES.includes(derivedHeaderType)
        ? (headerComp?.example?.header_handle?.[0] || null)
        : null;
      const derivedFooterText = footerComp?.text || null;
      const derivedButtons    = buttonsComp?.buttons || null;

      const headerParams = derivedHeaderType === 'TEXT' ? countPlaceholders(derivedHeaderText) : 0;
      const bodyParams   = countPlaceholders(bodyComp?.text);

      // Map Meta status to Prisma enum
      let localStatus = 'APPROVED';
      if (mt.status === 'PENDING')  localStatus = 'PENDING';
      if (mt.status === 'REJECTED') localStatus = 'REJECTED';
      if (mt.status === 'PAUSED')   localStatus = 'PAUSED';
      if (mt.status === 'DISABLED') localStatus = 'DISABLED';

      const dbTemp = await prisma.template.upsert({
        where: {
          name_language_tenantId: {
            name: mt.name,
            language: mt.language,
            tenantId: tenant.id
          }
        },
        update: {
          metaTemplateId:       mt.id,
          status:               localStatus,
          components,
          headerParams,
          bodyParams,
          headerType:           derivedHeaderType,
          headerText:           derivedHeaderText,
          headerMediaHandle:    derivedHeaderMediaHandle,
          footerText:           derivedFooterText,
          buttons:              derivedButtons,
          lastSyncedAt:         new Date(),
        },
        create: {
          tenantId:             tenant.id,
          metaTemplateId:       mt.id,
          name:                 mt.name,
          language:             mt.language,
          category:             mt.category,
          status:               localStatus,
          components,
          headerParams,
          bodyParams,
          headerType:           derivedHeaderType,
          headerText:           derivedHeaderText,
          headerMediaHandle:    derivedHeaderMediaHandle,
          footerText:           derivedFooterText,
          buttons:              derivedButtons,
          createdById:          null,
        }
      });

      synced.push(dbTemp);
    }

    return res.status(200).json({ success: true, count: synced.length, data: synced });
  } catch (error) {
    console.error('Error syncing templates:', error);
    return res.status(500).json({ success: false, message: `Sync failed: ${error.message}` });
  }
};

// ─────────────────────────────────────────────────────────────
// 4. DELETE: Delete a Template locally and from Meta WABA
// ─────────────────────────────────────────────────────────────
export const deleteTemplate = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id }   = req.params;

    const template = await prisma.template.findFirst({
      where: { id, tenantId }
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    // Attempt to delete on Meta
    const tenant = req.tenant;
    if (
      process.env.MOCK_WHATSAPP !== 'true' &&
      template.metaTemplateId &&
      tenant.whatsappWabaId &&
      tenant.whatsappAccessToken
    ) {
      try {
        await deleteMetaTemplate(tenant, template.name);
      } catch (err) {
        console.warn('Meta API deletion failed (may already be deleted on Meta):', err.message);
      }
    }

    // Clean up local media file (non-blocking)
    if (template.headerMediaUrl) {
      await safeDeleteFile(template.headerMediaUrl);
    }

    // Soft delete locally
    await prisma.template.update({
      where: { id },
      data: { status: 'DELETED' }
    });

    return res.status(200).json({ success: true, message: 'Template deleted successfully.' });
  } catch (error) {
    console.error('Error deleting template:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete template.' });
  }
};

