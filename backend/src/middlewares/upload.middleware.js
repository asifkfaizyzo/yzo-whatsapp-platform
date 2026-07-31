// src/middlewares/upload.middleware.js

import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    const tenantId  = req.tenantId;
    const contactId = req.params.contactId;

    // For inbound route, contactId comes from body
    const resolvedContactId = contactId || req.body?.contactId;
    const resolvedTenantId  = tenantId  || req.body?.tenantId;

    if (!resolvedTenantId || !resolvedContactId) {
      const fallback = path.join("uploads", "temp");
      fs.mkdirSync(fallback, { recursive: true });
      return cb(null, fallback);
    }

    // ✅ Detect inbound or outbound
    const isInbound = req.path.includes('incoming');
    const direction = isInbound ? 'inbound' : 'outbound';

    const uploadPath = path.join(
      "uploads",
      "tenants",
      resolvedTenantId,
      "contacts",
      resolvedContactId,
      direction          // ✅ /outbound or /inbound
    );

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    // ✅ Sanitize filename
    const ext      = path.extname(file.originalname);
    const baseName = path
      .basename(file.originalname, ext)
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .substring(0, 50);

    const uniqueName = `${Date.now()}_${baseName}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    // Video
    "video/mp4",
    "video/3gpp",
    // Audio
    "audio/mpeg",
    "audio/ogg",
    "audio/m4a",
    "audio/amr",
    "audio/mp4",
    "audio/webm",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

export default upload;