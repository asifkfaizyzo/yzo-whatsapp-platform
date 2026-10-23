import path from 'path';
import fs from 'fs';
import prisma from '../../config/prisma.js';
import { detectQuickReplyMediaType } from './uploadQuickReply.middleware.js';

/**
 * Safely unlinks a file from disk without throwing errors
 */
const safeUnlink = async (relativePath) => {
  if (!relativePath) return;
  try {
    const fullPath = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(process.cwd(), relativePath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (err) {
    console.warn(`⚠️ Warning: Failed to unlink file at "${relativePath}":`, err.message);
  }
};

/**
 * List quick replies with search, category, scope, and pagination
 */
export const getQuickReplies = async ({
  tenantId,
  userId,
  userType,
  search,
  category,
  scope = 'ALL',
  agentId,
  sortBy = 'newest',
  page = 1,
  limit = 50,
  includeInactive = false,
}) => {
  const where = { tenantId };

  if (!includeInactive) {
    where.isActive = true;
  }

  if (category && category.trim() && category !== 'All') {
    where.category = category.trim();
  }

  // Scope filtering
  if (scope === 'GLOBAL') {
    where.scope = 'GLOBAL';
  } else if (scope === 'PERSONAL') {
    where.scope = 'PERSONAL';
    if (userType === 'USER' && userId) {
      where.userId = userId;
    } else if (userType === 'TENANT' && agentId) {
      where.userId = agentId;
    }
  } else {
    // scope === 'ALL'
    if (userType === 'USER' && userId) {
      where.OR = [
        { scope: 'GLOBAL' },
        { scope: 'PERSONAL', userId: userId },
      ];
    } else if (userType === 'TENANT' && agentId) {
      where.userId = agentId;
    }
  }

  // Text search across shortcut, title, and content
  if (search && search.trim()) {
    const query = search.trim();
    const searchFilter = [
      { shortcut: { contains: query, mode: 'insensitive' } },
      { title: { contains: query, mode: 'insensitive' } },
      { content: { contains: query, mode: 'insensitive' } },
    ];

    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchFilter }];
      delete where.OR;
    } else {
      where.OR = searchFilter;
    }
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const take = Math.min(100, Math.max(1, limit));

  let orderBy = [{ createdAt: 'desc' }];
  if (sortBy === 'usage') {
    orderBy = [{ usageCount: 'desc' }, { createdAt: 'desc' }];
  } else if (sortBy === 'shortcut') {
    orderBy = [{ shortcut: 'asc' }];
  } else if (sortBy === 'oldest') {
    orderBy = [{ createdAt: 'asc' }];
  }

  const [total, items] = await Promise.all([
    prisma.quickReply.count({ where }),
    prisma.quickReply.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    limit: take,
    totalPages: Math.ceil(total / take) || 1,
  };
};

/**
 * Fast resolution for typing `/shortcut`
 * Resolves PERSONAL first, then falls back to GLOBAL.
 * Exclusively returns active records (isActive: true).
 */
export const getQuickReplyByShortcut = async ({ tenantId, userId, shortcut }) => {
  if (!shortcut || !tenantId) return null;
  const normalized = shortcut.trim().replace(/^\/+/, '').toLowerCase();

  // 1. Check PERSONAL first if agent userId is available
  if (userId) {
    const personal = await prisma.quickReply.findFirst({
      where: {
        tenantId,
        shortcut: normalized,
        scope: 'PERSONAL',
        userId,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    if (personal) return personal;
  }

  // 2. Fall back to GLOBAL
  return prisma.quickReply.findFirst({
    where: {
      tenantId,
      shortcut: normalized,
      scope: 'GLOBAL',
      isActive: true,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
};

/**
 * Get a single quick reply by ID
 */
export const getQuickReplyById = async ({ id, tenantId, userId, userType }) => {
  const qr = await prisma.quickReply.findFirst({
    where: { id, tenantId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!qr) {
    const err = new Error('Quick reply not found');
    err.statusCode = 404;
    throw err;
  }

  // If personal and user is an agent, verify ownership
  if (qr.scope === 'PERSONAL' && userType === 'USER' && qr.userId !== userId) {
    const err = new Error('Unauthorized: You do not have access to this personal quick reply');
    err.statusCode = 403;
    throw err;
  }

  return qr;
};

/**
 * Create a new quick reply
 */
export const createQuickReply = async ({
  tenantId,
  userId,
  userType,
  userName,
  data,
  file,
}) => {
  // Enforce role-based scope: Agents are forced to PERSONAL; Tenant defaults to GLOBAL
  let effectiveScope = data.scope || (userType === 'USER' ? 'PERSONAL' : 'GLOBAL');
  if (userType === 'USER') {
    effectiveScope = 'PERSONAL';
  }

  const effectiveUserId = effectiveScope === 'PERSONAL' ? userId : null;

  // Check for shortcut collision within the target scope
  const existingConflict = await prisma.quickReply.findFirst({
    where: {
      tenantId,
      shortcut: data.shortcut,
      scope: effectiveScope,
      ...(effectiveScope === 'PERSONAL' ? { userId: effectiveUserId } : {}),
    },
  });

  if (existingConflict) {
    if (file?.path) await safeUnlink(file.path);
    const err = new Error(
      `A ${effectiveScope.toLowerCase()} quick reply with shortcut "/${data.shortcut}" already exists.`
    );
    err.statusCode = 409;
    throw err;
  }

  let mediaUrl = null;
  let mediaName = null;
  let mediaSize = null;
  let mediaMimeType = null;
  let mediaType = null;

  if (file) {
    mediaUrl = `uploads/tenants/${tenantId}/quick-replies/${file.filename}`.replace(/\\/g, '/');
    mediaName = file.originalname;
    mediaSize = file.size;
    mediaMimeType = file.mimetype;
    mediaType = detectQuickReplyMediaType(file.mimetype);
  }

  try {
    return await prisma.quickReply.create({
      data: {
        tenantId,
        shortcut: data.shortcut,
        title: data.title,
        content: data.content,
        category: data.category || 'General',
        scope: effectiveScope,
        userId: effectiveUserId,
        createdByType: userType,
        createdByName: userName || (userType === 'TENANT' ? 'Workspace Admin' : 'Agent'),
        mediaUrl,
        mediaName,
        mediaSize,
        mediaMimeType,
        mediaType,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  } catch (err) {
    if (file?.path) await safeUnlink(file.path);
    if (err.code === 'P2002') {
      const conflictErr = new Error(
        `A ${effectiveScope.toLowerCase()} quick reply with shortcut "/${data.shortcut}" already exists.`
      );
      conflictErr.statusCode = 409;
      throw conflictErr;
    }
    throw err;
  }
};

/**
 * Update an existing quick reply
 */
export const updateQuickReply = async ({
  id,
  tenantId,
  userId,
  userType,
  data,
  file,
}) => {
  const existing = await prisma.quickReply.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    if (file?.path) await safeUnlink(file.path);
    const err = new Error('Quick reply not found');
    err.statusCode = 404;
    throw err;
  }

  // Permission check: Agents can only update their own personal quick replies
  if (userType === 'USER') {
    if (existing.scope === 'GLOBAL') {
      if (file?.path) await safeUnlink(file.path);
      const err = new Error('Unauthorized: Only administrators can edit company-wide global quick replies');
      err.statusCode = 403;
      throw err;
    }
    if (existing.scope === 'PERSONAL' && existing.userId !== userId) {
      if (file?.path) await safeUnlink(file.path);
      const err = new Error('Unauthorized: You can only edit your own personal quick replies');
      err.statusCode = 403;
      throw err;
    }
    if (data.scope === 'GLOBAL') {
      if (file?.path) await safeUnlink(file.path);
      const err = new Error('Unauthorized: Only administrators can promote quick replies to Global');
      err.statusCode = 403;
      throw err;
    }
  }

  const targetScope = data.scope || existing.scope;
  const targetShortcut = data.shortcut || existing.shortcut;

  // If shortcut or scope is changing, ensure no collision
  if (targetShortcut !== existing.shortcut || targetScope !== existing.scope) {
    const conflict = await prisma.quickReply.findFirst({
      where: {
        tenantId,
        shortcut: targetShortcut,
        scope: targetScope,
        ...(targetScope === 'PERSONAL' ? { userId: targetScope === existing.scope ? existing.userId : userId } : {}),
        NOT: { id: existing.id },
      },
    });

    if (conflict) {
      if (file?.path) await safeUnlink(file.path);
      const err = new Error(
        `A ${targetScope.toLowerCase()} quick reply with shortcut "/${targetShortcut}" already exists.`
      );
      err.statusCode = 409;
      throw err;
    }
  }

  // Change-aware caption limit validation
  const effectiveContent = data.content !== undefined ? data.content : existing.content;
  const willHaveAttachment = !!file || (!!existing.mediaUrl && !data.removeMedia);
  const contentChanged = data.content !== undefined && data.content !== existing.content;
  const attachmentChanged = !!file || (data.removeMedia !== undefined && data.removeMedia !== false);

  if ((contentChanged || attachmentChanged) && willHaveAttachment && effectiveContent.length > 1024) {
    if (file?.path) await safeUnlink(file.path);
    const err = new Error(
      'Content exceeds 1,024 characters. Trim the message before adding or modifying an attachment (WhatsApp caption limit).'
    );
    err.statusCode = 400;
    throw err;
  }

  const updateData = {};
  if (data.shortcut !== undefined) updateData.shortcut = data.shortcut;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (data.scope !== undefined) {
    updateData.scope = data.scope;
    if (data.scope === 'GLOBAL') {
      updateData.userId = null; // Promote to global removes user-lock so it's team-wide
    }
  }

  let oldFileToUnlink = null;

  if (file) {
    oldFileToUnlink = existing.mediaUrl;
    updateData.mediaUrl = `uploads/tenants/${tenantId}/quick-replies/${file.filename}`.replace(/\\/g, '/');
    updateData.mediaName = file.originalname;
    updateData.mediaSize = file.size;
    updateData.mediaMimeType = file.mimetype;
    updateData.mediaType = detectQuickReplyMediaType(file.mimetype);
  } else if (data.removeMedia) {
    oldFileToUnlink = existing.mediaUrl;
    updateData.mediaUrl = null;
    updateData.mediaName = null;
    updateData.mediaSize = null;
    updateData.mediaMimeType = null;
    updateData.mediaType = null;
  }

  try {
    const updated = await prisma.quickReply.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (oldFileToUnlink) {
      await safeUnlink(oldFileToUnlink);
    }

    return updated;
  } catch (err) {
    if (file?.path) await safeUnlink(file.path);
    if (err.code === 'P2002') {
      const conflictErr = new Error(
        `A ${targetScope.toLowerCase()} quick reply with shortcut "/${targetShortcut}" already exists.`
      );
      conflictErr.statusCode = 409;
      throw conflictErr;
    }
    throw err;
  }
};

/**
 * Delete a quick reply and clean up its file
 */
export const deleteQuickReply = async ({ id, tenantId, userId, userType }) => {
  const existing = await prisma.quickReply.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    const err = new Error('Quick reply not found');
    err.statusCode = 404;
    throw err;
  }

  if (userType === 'USER' && existing.scope === 'PERSONAL' && existing.userId !== userId) {
    const err = new Error('Unauthorized: You can only delete your own personal quick replies');
    err.statusCode = 403;
    throw err;
  }

  await prisma.quickReply.delete({
    where: { id: existing.id },
  });

  if (existing.mediaUrl) {
    await safeUnlink(existing.mediaUrl);
  }

  return { success: true, id: existing.id };
};

/**
 * Atomically increment usage statistics upon message send
 */
export const trackUsage = async (id, tenantId) => {
  if (!id || !tenantId) return;
  try {
    await prisma.quickReply.updateMany({
      where: { id, tenantId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(`⚠️ Warning: Failed to track usage for QuickReply "${id}":`, err.message);
  }
};

/**
 * Get distinct categories for filtering
 */
export const getCategories = async ({ tenantId }) => {
  const categories = await prisma.quickReply.findMany({
    where: { tenantId },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });

  return categories.map((c) => c.category).filter(Boolean);
};
