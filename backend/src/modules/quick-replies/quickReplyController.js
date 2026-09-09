import * as quickReplyService from './quickReplyService.js';
import {
  createQuickReplySchema,
  updateQuickReplySchema,
  queryQuickRepliesSchema,
} from './quickReplyValidation.js';
import { ZodError } from 'zod';

const formatZodError = (err) => {
  return err.errors?.map((e) => e.message).join(', ') || 'Validation error';
};

export const listQuickReplies = async (req, res) => {
  try {
    const validatedQuery = queryQuickRepliesSchema.parse(req.query);

    const result = await quickReplyService.getQuickReplies({
      tenantId: req.tenantId,
      userId: req.user?.id,
      userType: req.userType,
      ...validatedQuery,
    });

    return res.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(err) });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch quick replies',
    });
  }
};

export const getByShortcut = async (req, res) => {
  try {
    const { shortcut } = req.params;
    const result = await quickReplyService.getQuickReplyByShortcut({
      tenantId: req.tenantId,
      userId: req.user?.id,
      shortcut,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `Quick reply with shortcut "/${shortcut}" not found`,
      });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch quick reply by shortcut',
    });
  }
};

export const getQuickReply = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await quickReplyService.getQuickReplyById({
      id,
      tenantId: req.tenantId,
      userId: req.user?.id,
      userType: req.userType,
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch quick reply',
    });
  }
};

export const createQuickReply = async (req, res) => {
  try {
    // hasAttachment is derived server-side from !!req.file, not client-sent
    const dataToValidate = {
      ...req.body,
      hasAttachment: !!req.file,
    };

    const validated = createQuickReplySchema.parse(dataToValidate);

    const result = await quickReplyService.createQuickReply({
      tenantId: req.tenantId,
      userId: req.user?.id,
      userType: req.userType,
      userName: req.user?.name || req.tenant?.tenantName,
      data: validated,
      file: req.file,
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: 'Quick reply created successfully',
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(err) });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to create quick reply',
    });
  }
};

export const updateQuickReply = async (req, res) => {
  try {
    const dataToValidate = {
      ...req.body,
      hasAttachment: !!req.file,
    };

    const validated = updateQuickReplySchema.parse(dataToValidate);

    const result = await quickReplyService.updateQuickReply({
      id: req.params.id,
      tenantId: req.tenantId,
      userId: req.user?.id,
      userType: req.userType,
      data: validated,
      file: req.file,
    });

    return res.json({
      success: true,
      data: result,
      message: 'Quick reply updated successfully',
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, message: formatZodError(err) });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to update quick reply',
    });
  }
};

export const deleteQuickReply = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await quickReplyService.deleteQuickReply({
      id,
      tenantId: req.tenantId,
      userId: req.user?.id,
      userType: req.userType,
    });

    return res.json({
      success: true,
      data: result,
      message: 'Quick reply deleted successfully',
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to delete quick reply',
    });
  }
};

export const listCategories = async (req, res) => {
  try {
    const categories = await quickReplyService.getCategories({
      tenantId: req.tenantId,
    });

    return res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to fetch categories',
    });
  }
};
