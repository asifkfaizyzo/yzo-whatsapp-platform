// src/modules/automation/flowMediaController.js

import fs from 'fs';
import path from 'path';
import { detectMediaType, validateMedia } from '../../lib/utils/mediaValidator.js';

export const uploadFlowMedia = async (req, res) => {
  try {
    const file     = req.file;
    const tenantId = req.tenantId;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Detect media type
    const mediaType = detectMediaType(file.mimetype);

    if (!mediaType) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        message: 'Unsupported file type',
      });
    }

    // Allow IMAGE, VIDEO, and FILE (Documents)
if (!['IMAGE', 'VIDEO', 'FILE'].includes(mediaType)) {
  if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  return res.status(400).json({
    success: false,
    message: 'Unsupported media type. Only image, video, and document files are allowed.',
  });
}

    // Validate size + type
    const validation = validateMedia(
      file.originalname,
      file.mimetype,
      file.size,
      mediaType
    );

    if (!validation.valid) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const mediaUrl = file.path.replace(/\\/g, '/');

    return res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      data: {
        mediaType,
        mediaUrl,
        mediaName:     file.originalname,
        mediaSize:     file.size,
        mediaMimeType: file.mimetype,
      },
    });

  } catch (error) {
    console.error('❌ uploadFlowMedia error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload media',
    });
  }
};