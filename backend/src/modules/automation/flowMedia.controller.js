// backend/src/modules/automation/flowMedia.controller.js (do not remove this comment)
import fs from "fs/promises";
import { checkStorageAccess } from "../../lib/entitlements/access.js";
import { registerMediaAsset } from "../../lib/entitlements/storage.service.js";

export const uploadFlowMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No media file uploaded." });
    }

    const tenantId = req.tenantId;
    const incomingBytes = req.file.size || 0;

    // Enforce storage limit before accepting the uploaded file
    const storageCheck = await checkStorageAccess(tenantId, incomingBytes);
    if (!storageCheck.allowed) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(storageCheck.status || 403).json({
        success: false,
        code: storageCheck.code || "STORAGE_LIMIT_REACHED",
        error: storageCheck.message,
        message: storageCheck.message,
      });
    }

    // Construct the relative path (normalize Windows backslashes to forward slashes)
    const relativePath = req.file.path.replace(/\\/g, "/");
    const fileUrl = `/${relativePath}`;

    // Register in MediaAsset ledger for storage tracking & 14-day purge
    await registerMediaAsset({
      tenantId,
      kind: "FLOW_MEDIA",
      url: relativePath,
      fileName: req.file.originalname || req.file.filename,
      mimeType: req.file.mimetype || "application/octet-stream",
      sizeBytes: incomingBytes,
    });

    return res.status(200).json({
      message: "Flow media uploaded successfully",
      url: fileUrl,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    console.error("Flow Media Upload Error:", error);
    return res
      .status(500)
      .json({ error: "Failed to process uploaded media." });
  }
};
