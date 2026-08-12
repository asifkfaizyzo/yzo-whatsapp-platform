export const MEDIA_CONFIG = {
  IMAGE: {
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
    label: "Image",
  },
  FILE: {
    maxSize: 100 * 1024 * 1024,
    allowedTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ],
    allowedExtensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"],
    label: "Document",
  },
  VIDEO: {
    maxSize: 16 * 1024 * 1024,
   allowedTypes: ["video/mp4", "video/3gpp"],
    allowedExtensions: [".mp4", ".3gp"],
    label: "Video",
  },
  AUDIO: {
    maxSize: 16 * 1024 * 1024,
    allowedTypes: ["audio/mpeg", "audio/ogg", "audio/m4a", "audio/amr", "audio/mp4","audio/webm"],
    allowedExtensions: [".mp3", ".ogg", ".m4a", ".amr",".webm"],
    label: "Audio",
  },
};

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}