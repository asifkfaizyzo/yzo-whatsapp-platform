// backend/src/modules/messages/media.controller.js (do not remove this comment)

import fs from "fs";
import path from "path";
import mime from "mime-types";
import prisma from "../../config/prisma.js";
import {
  verifySignedUrl,
  generateSignedUrl,
} from "../../lib/utils/signed.url.js";

const isPathInside = (parentPath, childPath) => {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
};

const resolveUploadFile = async (storedPath) => {
  if (typeof storedPath !== "string" || !storedPath.trim()) {
    throw Object.assign(new Error("Media file not found"), { status: 404 });
  }

  const uploadsRoot = await fs.promises.realpath(
    path.resolve(process.cwd(), "uploads"),
  );
  const relativeUploadPath = storedPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  const candidatePath = path.resolve(process.cwd(), relativeUploadPath);
  if (!isPathInside(uploadsRoot, candidatePath)) {
    throw Object.assign(new Error("Access denied"), { status: 403 });
  }

  let realPath;
  try {
    realPath = await fs.promises.realpath(candidatePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw Object.assign(new Error("Media file not found"), { status: 404 });
    }
    throw error;
  }

  if (!isPathInside(uploadsRoot, realPath)) {
    throw Object.assign(new Error("Access denied"), { status: 403 });
  }

  const stat = await fs.promises.stat(realPath);
  if (!stat.isFile()) {
    throw Object.assign(new Error("Media file not found"), { status: 404 });
  }
  return { filePath: realPath, stat };
};

const isPdfFile = async (filePath) => {
  const file = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(1024);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    return header.subarray(0, bytesRead).includes(Buffer.from("%PDF-"));
  } finally {
    await file.close();
  }
};

const getContentDispositionFileName = (fileName) => {
  const cleanName = String(fileName || "media").replace(/[\r\n]/g, "");
  const safeName = cleanName.replace(/[^\x20-\x7E]|["\\]/g, "_");
  const encodedName = encodeURIComponent(cleanName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `filename="${safeName}"; filename*=UTF-8''${encodedName}`;
};

export const previewMessageMedia = async (req, res) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: req.params.messageId },
      include: {
        conversation: {
          include: {
            contact: { select: { assignedTo: true } },
          },
        },
      },
    });

    if (
      !message ||
      message.conversation.tenantId !== req.tenantId ||
      (req.actorType === "USER" &&
        message.conversation.contact?.assignedTo !== req.userId)
    ) {
      return res.status(404).json({
        success: false,
        message: "Media not found",
      });
    }
    if (message.isDeleted || !message.mediaUrl) {
      return res.status(404).json({
        success: false,
        message: "Message has no available media",
      });
    }

    const { filePath, stat } = await resolveUploadFile(message.mediaUrl);
    const fileName = message.mediaName || path.basename(filePath);
    const isDownload = req.query.download === "true";
    const isPdf = await isPdfFile(filePath);

    if (!isDownload && !isPdf) {
      return res.status(415).json({
        success: false,
        message: "Preview is available for PDF files only. Download this file to view it.",
      });
    }

    const contentType = isPdf
      ? "application/pdf"
      : message.mediaMimeType ||
        mime.lookup(fileName) ||
        "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; ${getContentDispositionFileName(fileName)}`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const fileStream = fs.createReadStream(filePath);
    fileStream.once("error", (error) => {
      console.error("Message media preview stream failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Failed to read media file",
        });
      } else {
        res.destroy(error);
      }
    });
    fileStream.pipe(res);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    console.error("Message media preview failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load media file",
    });
  }
};

// ── Serve Media File via Signed URL ──────────────────────────
export const serveMediaFile = async (req, res) => {
  try {
    const {
      path: filePath,
      tenant: tenantId,
      expires,
      sig: signature,
    } = req.query;

    // 1. Validate all params exist
    if (!filePath || !tenantId || !expires || !signature) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
      });
    }

    // 2. Verify signed URL
    const verification = verifySignedUrl(
      filePath,
      tenantId,
      expires,
      signature,
    );

    if (!verification.valid) {
      return res.status(403).json({
        success: false,
        error: verification.reason,
      });
    }

    // 3. Build absolute path
    const absolutePath = path.join(process.cwd(), filePath);

    // 4. Security: prevent path traversal attack
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!absolutePath.startsWith(uploadsDir)) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    // 5. Check file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        error: "File not found",
      });
    }

    // 6. Get file info
    const stat = fs.statSync(absolutePath);
    const mimeType = mime.lookup(absolutePath) || "application/octet-stream";
    const fileName = path.basename(absolutePath);

    // 7. Set response headers
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // 8. Stream file to client
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);

    fileStream.on("error", (err) => {
      console.error("❌ File stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "File read error" });
      }
    });
  } catch (error) {
    console.error("❌ serveMediaFile error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// ── Refresh Expired Signed URL ────────────────────────────────
export const refreshMediaUrl = async (req, res) => {
  try {
    const { messageId } = req.params;
    const tenantId = req.tenantId;

    // 1. Find message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    // 2. Verify tenant owns this message
    if (message.conversation.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // 3. Check message has media
    if (!message.mediaUrl) {
      return res.status(400).json({
        success: false,
        error: "Message has no media",
      });
    }

    // 4. Generate fresh signed URL
    const signedUrl = generateSignedUrl(message.mediaUrl, tenantId);

    return res.status(200).json({
      success: true,
      signedUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("❌ refreshMediaUrl error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
