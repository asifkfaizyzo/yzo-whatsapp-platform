// src/config/flowMediaUpload.js

import multer from 'multer';
import path   from 'path';
import fs     from 'fs';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tenantId = req.tenantId;

    if (!tenantId) {
      const fallback = path.join('uploads', 'temp');
      fs.mkdirSync(fallback, { recursive: true });
      return cb(null, fallback);
    }

    const uploadPath = path.join(
      'uploads',
      'tenants',
      tenantId,
      'flows',
      'media'
    );

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const ext      = path.extname(file.originalname);
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .substring(0, 50);

    const uniqueName = `${Date.now()}_${baseName}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    // Videos
    'video/mp4', 'video/3gpp',
    // Documents (PDF, Word, Excel, PowerPoint, Text)
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const flowMediaUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (PDF/Doc limit)
  },
});

export default flowMediaUpload;