// src/middlewares/templateUpload.middleware.js
//
// Dedicated Multer config for template HEADER media uploads.
// Separate from the contact upload middleware so we can enforce
// template-specific size limits and storage paths independently.

import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ── Allowed MIME types per Meta template header limits ──────────────────────
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/3gpp'];
const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

export const TEMPLATE_MEDIA_MIMES = [
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_VIDEO_MIMES,
  ...ALLOWED_DOCUMENT_MIMES,
];

// ── Size limits per Meta template header spec ────────────────────────────────
export const TEMPLATE_SIZE_LIMITS = {
  IMAGE:    5  * 1024 * 1024,  // 5 MB
  VIDEO:    16 * 1024 * 1024,  // 16 MB
  DOCUMENT: 16 * 1024 * 1024,  // 16 MB
};

// ── Storage ──────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, _file, cb) {
    // tenantId is always from auth middleware — never from request body/query
    const tenantId = req.tenantId;
    if (!tenantId) {
      return cb(new Error('Unauthorized: tenantId missing from auth context'), null);
    }

    const uploadPath = path.join('uploads', 'tenants', tenantId, 'templates');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .substring(0, 50);
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

// ── MIME-type filter ─────────────────────────────────────────────────────────
const fileFilter = (_req, file, cb) => {
  if (TEMPLATE_MEDIA_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type for template header: ${file.mimetype}. ` +
        `Allowed: JPEG, PNG, WebP (image); MP4, 3GP (video); PDF, Word, Excel, PowerPoint, TXT (document).`
      ),
      false
    );
  }
};

// ── Multer instance ──────────────────────────────────────────────────────────
const templateUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16 MB absolute maximum
  },
});

export default templateUpload;

// ── Helper: validate uploaded file size against header-type-specific limits ─
export function validateTemplateMediaSize(file, headerType) {
  if (!file) return null;

  const limit = TEMPLATE_SIZE_LIMITS[headerType] || TEMPLATE_SIZE_LIMITS.DOCUMENT;

  if (file.size > limit) {
    const mb = (limit / (1024 * 1024)).toFixed(0);
    const actualMb = (file.size / (1024 * 1024)).toFixed(2);
    return `File too large for ${headerType} template header. Maximum: ${mb} MB, uploaded: ${actualMb} MB.`;
  }

  return null; // null = valid
}
