// backend/src/modules/quick-replies/quickReply.upload.js (do not remove this comment)
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  getFileExtension,
  normalizeMimeType,
  validateMedia,
  validateMediaSize,
} from "../../lib/utils/media.validator.js";

const ALLOWED_MIME_TYPES = {
  // Images
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",

  // Documents
  "application/pdf": "DOCUMENT",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCUMENT",
  "application/vnd.ms-excel": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "DOCUMENT",
  "text/plain": "DOCUMENT",

  // Videos
  "video/mp4": "VIDEO",
  "video/3gpp": "VIDEO",

  // Audio
  "audio/mpeg": "AUDIO",
  "audio/mp3": "AUDIO",
  "audio/ogg": "AUDIO",
  "audio/mp4": "AUDIO",
  "audio/aac": "AUDIO",
};

export const detectQuickReplyMediaType = (mimeType) => {
  return ALLOWED_MIME_TYPES[normalizeMimeType(mimeType)] || null;
};

const MIME_EXTENSIONS = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "video/mp4": [".mp4"],
  "video/3gpp": [".3gp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "text/plain": [".txt"],
};

export const validateQuickReplyMediaFile = (file) => {
  const mimetype = normalizeMimeType(file.mimetype);
  const mediaType = detectQuickReplyMediaType(mimetype);
  const validationType = mediaType === "DOCUMENT" ? "FILE" : mediaType;
  const validation =
    mediaType === "AUDIO"
      ? validateMediaSize(file.size, validationType)
      : validateMedia(
          file.originalname,
          mimetype,
          file.size,
          validationType,
        );

  if (!validation.valid) {
    const error = new Error(validation.error);
    error.statusCode = 400;
    throw error;
  }

  const extensions = MIME_EXTENSIONS[mimetype];
  if (extensions && !extensions.includes(getFileExtension(file.originalname))) {
    const error = new Error(
      `File extension does not match ${mimetype}. Expected: ${extensions.join(", ")}`,
    );
    error.statusCode = 400;
    throw error;
  }

  return { mediaType, mediaMimeType: mimetype };
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return cb(new Error("Unauthorized: Tenant identification missing"), null);
    }

    // Tenant-isolated storage directory
    const dir = path.join(
      process.cwd(),
      "uploads",
      "tenants",
      tenantId,
      "quick-replies",
    );

    try {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err, null);
    }
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Use random UUID for storage to prevent path traversal and collision
    const uniqueFilename = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueFilename);
  },
});

const fileFilter = (req, file, cb) => {
  const mime = normalizeMimeType(file.mimetype);
  if (ALLOWED_MIME_TYPES[mime]) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type: "${file.mimetype}". Allowed: Images (JPG, PNG, WEBP), Documents (PDF, Word, Excel, TXT), Videos (MP4), and Audio.`,
      ),
      false,
    );
  }
};

const uploadQuickReply = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max
  },
});

export default uploadQuickReply;
