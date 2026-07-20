// backend/src/config/ticketUpload.js

import multer from "multer";
import path from "path";
import fs from "fs";

// ── Ensure ticket uploads folder exists ──
const UPLOAD_DIR = "uploads/tickets";
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    // e.g. ticket-1721234567890-482910234.pdf
    cb(null, `ticket-${uniqueSuffix}${ext}`);
  },
});

// ── Allowed MIME types ──
const ALLOWED_MIMES = {
  // Images / Screenshots
  "image/jpeg":    { label: "Image",    ext: "JPG"  },
  "image/jpg":     { label: "Image",    ext: "JPG"  },
  "image/png":     { label: "Image",    ext: "PNG"  },
  "image/webp":    { label: "Image",    ext: "WEBP" },
  // Documents
  "application/pdf": { label: "PDF",   ext: "PDF"  },
  // Video
  "video/mp4":     { label: "Video",    ext: "MP4"  },
  // Audio
  "audio/mpeg":    { label: "Audio",    ext: "MP3"  },
  "audio/mp3":     { label: "Audio",    ext: "MP3"  },
  // Text
  "text/plain":    { label: "Text",     ext: "TXT"  },
};

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF, MP4, MP3, TXT"
      ),
      false
    );
  }
};

export const ticketUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB — covers video/audio
  },
});