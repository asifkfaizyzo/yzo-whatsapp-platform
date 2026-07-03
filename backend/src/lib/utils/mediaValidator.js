import { MEDIA_CONFIG, formatFileSize } from "../constants/mediaConfig.js";

export function detectMediaType(mimeType) {
  if (!mimeType) return null;

  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";

  const docTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ];

  if (docTypes.includes(mimeType)) return "FILE";

  return null;
}

export function getFileExtension(fileName) {
  if (!fileName || !fileName.includes(".")) return "";
  return "." + fileName.split(".").pop().toLowerCase();
}

export function validateMedia(fileName, mimeType, fileSize, type) {
  const config = MEDIA_CONFIG[type];

  if (!config) {
    return {
      valid: false,
      error: "Invalid media type",
    };
  }

  if (fileSize > config.maxSize) {
    return {
      valid: false,
      error:
        config.label +
        " size must be less than " +
        formatFileSize(config.maxSize) +
        ". Your file is " +
        formatFileSize(fileSize),
    };
  }

  if (!config.allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: "Invalid file type. Allowed: " + config.allowedExtensions.join(", "),
    };
  }

  const ext = getFileExtension(fileName);
   if (ext && ext !== ".") {
  if (!config.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: "Invalid file extension. Allowed: " + config.allowedExtensions.join(", "),
    };
  }
}

  return { valid: true };
}