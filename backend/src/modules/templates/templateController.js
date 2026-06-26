import prisma from '../../config/prisma.js';
import { fetchMetaTemplates, submitMetaTemplate, deleteMetaTemplate } from './templateService.js';

// Count unique variables like {{1}}, {{2}} in a text block
const countPlaceholders = (text) => {
  if (!text) return 0;
  const matches = text.match(/\{\{(\d+)\}\}/g);
  return matches ? new Set(matches).size : 0;
};

// 1. GET: Fetch all templates for the logged-in tenant
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

// 2. POST: Create a Template locally and register it on Meta
export const createTemplate = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.tenant.id; // User ID mapped to tenant in verifyTenant
    const { name, category, language, components } = req.body;

    if (!name || !category || !components) {
      return res.status(400).json({ success: false, message: 'Name, Category and Components are required.' });
    }

    // Clean template name to lowercase + underscores (Meta requirement)
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Parse parameters counts
    let headerParams = 0;
    let bodyParams = 0;

    const headerComp = components.find(c => c.type === 'HEADER');
    if (headerComp && headerComp.format === 'TEXT') {
      headerParams = countPlaceholders(headerComp.text);
    }
    const bodyComp = components.find(c => c.type === 'BODY');
    if (bodyComp) {
      bodyParams = countPlaceholders(bodyComp.text);
    }

    // Check if Tenant has WhatsApp Credentials configured
    const tenant = req.tenant;
    const hasMetaConfig = tenant.whatsappWabaId && tenant.whatsappAccessToken;

    let metaTemplateId = null;
    let initialStatus = 'APPROVED'; // Sandbox simulation auto-approves templates!

    if (hasMetaConfig) {
      // Meta requires sample values for placeholders like {{1}} inside BODY components
      const enrichedComponents = components.map(comp => {
        const copy = { ...comp };
        if (copy.type === 'BODY') {
          const placeholders = copy.text.match(/\{\{(\d+)\}\}/g);
          if (placeholders) {
            const count = new Set(placeholders).size;
            const samples = Array.from({ length: count }, (_, i) => `sample_${i + 1}`);
            copy.example = {
              body_text: [samples]
            };
          }
        }
        return copy;
      });

      // Create on Meta Cloud API
      try {
        const metaRes = await submitMetaTemplate(tenant, {
          name: cleanName,
          category,
          language: language || 'en_US',
          components: enrichedComponents
        });
        metaTemplateId = metaRes.id;
        initialStatus = 'PENDING'; // real Meta starts as PENDING review
      } catch (err) {
        return res.status(400).json({ success: false, message: `Meta API Submission Error: ${err.message}` });
      }
    }

    // Find a User record matching the tenantId to fulfill Prisma createdBy relation
    const user = await prisma.user.findFirst({ where: { tenantId } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Please create at least one Agent User for this tenant before creating templates.' });
    }

    // Save Template to Local DB
    const template = await prisma.template.create({
      data: {
        tenantId,
        metaTemplateId,
        name: cleanName,
        language: language || 'en_US',
        category,
        status: initialStatus,
        components,
        headerParams,
        bodyParams,
        createdById: user.id
      }
    });

    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    console.error('Error creating template:', error);
    return res.status(500).json({ success: false, message: 'Failed to create template.' });
  }
};

// 3. POST: Sync Templates from Meta Business Account (WABA)
export const syncTemplates = async (req, res) => {
  try {
    const tenant = req.tenant;

    if (!tenant.whatsappWabaId || !tenant.whatsappAccessToken) {
      return res.status(400).json({ success: false, message: 'WhatsApp Business Credentials are not configured in settings.' });
    }

    // Fetch from Meta WABA
    const metaTemplates = await fetchMetaTemplates(tenant);

    const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Sync requires at least one Agent User in the tenant account.' });
    }

    const synced = [];

    for (const mt of metaTemplates) {
      // Calculate body and header params count
      let headerParams = 0;
      let bodyParams = 0;
      const headerComp = mt.components?.find(c => c.type === 'HEADER');
      if (headerComp && headerComp.format === 'TEXT') {
        headerParams = countPlaceholders(headerComp.text);
      }
      const bodyComp = mt.components?.find(c => c.type === 'BODY');
      if (bodyComp) {
        bodyParams = countPlaceholders(bodyComp.text);
      }

      // Map Meta template status to Prisma enum
      let localStatus = 'APPROVED';
      if (mt.status === 'PENDING') localStatus = 'PENDING';
      if (mt.status === 'REJECTED') localStatus = 'REJECTED';
      if (mt.status === 'PAUSED') localStatus = 'PAUSED';
      if (mt.status === 'DISABLED') localStatus = 'DISABLED';

      // Upsert into local database
      const dbTemp = await prisma.template.upsert({
        where: {
          name_language_tenantId: {
            name: mt.name,
            language: mt.language,
            tenantId: tenant.id
          }
        },
        update: {
          metaTemplateId: mt.id,
          status: localStatus,
          components: mt.components || {},
          headerParams,
          bodyParams,
          lastSyncedAt: new Date()
        },
        create: {
          tenantId: tenant.id,
          metaTemplateId: mt.id,
          name: mt.name,
          language: mt.language,
          category: mt.category,
          status: localStatus,
          components: mt.components || {},
          headerParams,
          bodyParams,
          createdById: user.id
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

// 4. DELETE: Delete a Template locally and from Meta WABA
export const deleteTemplate = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const template = await prisma.template.findFirst({
      where: { id, tenantId }
    });

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    // Attempt to delete on Meta
    const tenant = req.tenant;
    if (template.metaTemplateId && tenant.whatsappWabaId && tenant.whatsappAccessToken) {
      try {
        await deleteMetaTemplate(tenant, template.name);
      } catch (err) {
        console.warn('Meta API deletion failed (might be already deleted on Meta):', err.message);
      }
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