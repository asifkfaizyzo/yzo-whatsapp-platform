// backend/src/lib/utils/media.validator.js (do not remove this comment)
import { MEDIA_CONFIG, formatFileSize } from "../constants/media.config.js";

export function normalizeMimeType(mimeType) {
  if (typeof mimeType !== "string") return "";
  const normalizedMimeType = mimeType.split(";", 1)[0].trim().toLowerCase();
  return normalizedMimeType === "image/jpg" ? "image/jpeg" : normalizedMimeType;
}

export function detectMediaType(mimeType) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  if (!normalizedMimeType) return null;

  if (normalizedMimeType.startsWith("image/")) return "IMAGE";
  if (normalizedMimeType.startsWith("video/")) return "VIDEO";
  if (normalizedMimeType.startsWith("audio/")) return "AUDIO";

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

  if (docTypes.includes(normalizedMimeType)) return "FILE";

  return null;
}

export function getFileExtension(fileName) {
  if (!fileName || !fileName.includes(".")) return "";
  return "." + fileName.split(".").pop().toLowerCase();
}

export function validateMediaSize(fileSize, type) {
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

  return { valid: true };
}

export function validateMedia(fileName, mimeType, fileSize, type) {
  const config = MEDIA_CONFIG[type];
  const normalizedMimeType = normalizeMimeType(mimeType);
  const sizeValidation = validateMediaSize(fileSize, type);

  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  if (!config) {
    return {
      valid: false,
      error: "Invalid media type",
    };
  }

  if (!config.allowedTypes.includes(normalizedMimeType)) {
    return {
      valid: false,
      error:
        "Invalid file type. Allowed: " + config.allowedExtensions.join(", "),
    };
  }

  const ext = getFileExtension(fileName);
  if (ext && ext !== ".") {
    if (!config.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error:
          "Invalid file extension. Allowed: " +
          config.allowedExtensions.join(", "),
      };
    }
  }

  return { valid: true };
}
