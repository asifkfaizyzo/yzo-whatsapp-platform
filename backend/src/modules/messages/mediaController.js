// src/modules/messages/mediaController.js

import fs    from 'fs';
import path  from 'path';
import mime  from 'mime-types';
import prisma from '../../config/prisma.js';
import { verifySignedUrl, generateSignedUrl } from '../../lib/utils/signedUrl.js';


// ── Serve Media File via Signed URL ──────────────────────────
export const serveMediaFile = async (req, res) => {
  try {
    const {
      path:    filePath,
      tenant:  tenantId,
      expires,
      sig:     signature,
    } = req.query;

    // 1. Validate all params exist
    if (!filePath || !tenantId || !expires || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
      });
    }

    // 2. Verify signed URL
    const verification = verifySignedUrl(
      filePath,
      tenantId,
      expires,
      signature
    );

    if (!verification.valid) {
      return res.status(403).json({
        success: false,
        error: verification.reason,
      });
    }

    // 3. Build absolute path
    const absolutePath = path.join(process.cwd(), filePath);

    // 4. Security: prevent path traversal attack
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!absolutePath.startsWith(uploadsDir)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // 5. Check file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    // 6. Get file info
    const stat     = fs.statSync(absolutePath);
    const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
    const fileName = path.basename(absolutePath);

    // 7. Set response headers
    res.setHeader('Content-Type',        mimeType);
    res.setHeader('Content-Length',      stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control',       'private, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin',  '*');

    // 8. Stream file to client
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      console.error('❌ File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'File read error' });
      }
    });

  } catch (error) {
    console.error('❌ serveMediaFile error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};


// ── Refresh Expired Signed URL ────────────────────────────────
export const refreshMediaUrl = async (req, res) => {
  try {
    const { messageId } = req.params;
    const tenantId      = req.tenantId;

    // 1. Find message
    const message = await prisma.message.findUnique({
      where:   { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    // 2. Verify tenant owns this message
    if (message.conversation.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // 3. Check message has media
    if (!message.mediaUrl) {
      return res.status(400).json({
        success: false,
        error: 'Message has no media',
      });
    }

    // 4. Generate fresh signed URL
    const signedUrl = generateSignedUrl(message.mediaUrl, tenantId);

    return res.status(200).json({
      success:   true,
      signedUrl,
      expiresIn: 3600,
    });

  } catch (error) {
    console.error('❌ refreshMediaUrl error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};