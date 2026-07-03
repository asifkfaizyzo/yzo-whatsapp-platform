// src/middleware/upload.middleware.js

import multer from "multer";
import path from "path";
import fs from "fs";

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const contactId = req.params.contactId;
    const tenantId = req.tenantId; // from verifyTenantOrUser

    const uploadPath = `uploads/tenants/${tenantId}/contacts/${contactId}`;

    // Create folder if not exists
    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, uniqueName);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
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
    cb(new Error("Unsupported file type"), false);
  }
};

// Max size = 100MB (largest limit)
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

export default upload;