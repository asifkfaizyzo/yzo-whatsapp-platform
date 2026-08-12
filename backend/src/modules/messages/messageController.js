// src/modules/messages/messageController.js

import {
  handleIncomingMessage,
  sendMessageService,
  sendMediaMessageService,
  deleteMessageService,
} from "./messageService.js";
import upload from "../../middlewares/upload.middleware.js";
import { emitToTenant } from "../../lib/socket.js";
import { generateSignedUrl } from '../../lib/utils/signedUrl.js';
import fs from "fs";
import path from "path";


// ─────────────────────────────────────────────────────────────
// INCOMING MESSAGE  (Contact → Platform)
// ─────────────────────────────────────────────────────────────
export const incomingMessageController = async (req, res) => {
  console.log("CONTENT-TYPE:", req.headers["content-type"]);
  console.log("BODY:", req.body);
  console.log("FILE:", req.file);

  try {
    const {
      contactId,
      tenantId,
      text,
      type,
      caption,
    } = req.body;

    let {
      mediaUrl,
      mediaName,
      mediaSize,
      mediaMimeType,
    } = req.body;

    // ── Validate required ─────────────────────────────────────
    if (!contactId || !tenantId) {
      return res.status(400).json({
        success: false,
        error: "contactId and tenantId are required",
      });
    }

    // ── Handle uploaded file (inbound media via simulator) ────
    // If file was uploaded directly (not via WhatsApp webhook)
//     if (req.file) {
//   const relativePath = req.file.path.replace(/\\/g, "/");
//   mediaUrl      = relativePath;              // ✅ store relative path only
//   mediaName     = req.file.originalname;
//   mediaSize     = req.file.size;
//   mediaMimeType = req.file.mimetype;

//   console.log("✅ Inbound file saved:", relativePath);
// }


    if (req.file) {
  let filePath = req.file.path.replace(/\\/g, "/");

  // ✅ If file went to temp folder, move it to proper inbound path
  if (filePath.includes('uploads/temp/')) {
    const correctDir = path.join(
      'uploads',
      'tenants',
      tenantId,
      'contacts',
      contactId,
      'inbound'
    );
    fs.mkdirSync(correctDir, { recursive: true });

    const newPath = path.join(correctDir, req.file.filename).replace(/\\/g, "/");
    
    // Move file from temp → inbound
    fs.renameSync(req.file.path, newPath);
    filePath = newPath;

    console.log(`📦 Moved file from temp → ${newPath}`);
  }

  mediaUrl      = filePath;
  mediaName     = req.file.originalname;
  mediaSize     = req.file.size;
  mediaMimeType = req.file.mimetype;

  console.log("✅ Inbound file saved:", filePath);
}

    // ── Validate message content ──────────────────────────────
    const resolvedType = type || "TEXT";

    if (resolvedType === "TEXT" && !text) {
      return res.status(400).json({
        success: false,
        error: "text is required for TEXT messages",
      });
    }

    if (resolvedType !== "TEXT" && !mediaUrl) {
      return res.status(400).json({
        success: false,
        error: `mediaUrl is required for ${resolvedType} messages`,
      });
    }

    // ── Process ───────────────────────────────────────────────
    const result = await handleIncomingMessage({
      contactId,
      tenantId,
      text,
      type:          resolvedType,
      mediaUrl,
      mediaName,
      mediaSize,
      mediaMimeType,
      caption,
    });

    // ── Socket emit ───────────────────────────────────────────
    // ✅ Generate signed URL if media exists
let socketMediaUrl = null;
if (result.message.mediaUrl) {
  socketMediaUrl = generateSignedUrl(result.message.mediaUrl, tenantId);
}

// ── Socket emit ───────────────────────────────────────────
emitToTenant(tenantId, "new_message", {
  conversationId: result.conversation.id,
  message: {
    id:             result.message.id,
    type:           result.message.type,
    text:           result.message.text,
    senderId:       result.message.senderId,
    senderType:     "CONTACT",
    direction:      "INBOUND",
    isFromCustomer: true,
    mediaUrl:       socketMediaUrl,        // ✅ signed URL
    mediaName:      result.message.mediaName,
    mediaSize:      result.message.mediaSize,
    mediaMimeType:  result.message.mediaMimeType,
    caption:        result.message.caption,
    createdAt:      result.message.createdAt,
  },
});

    return res.status(200).json({
      success:            true,
      action:             result.action,
      reason:             result.reason,
      conversationId:     result.conversation.id,
      conversationStatus: result.conversation.status,
      messageId:          result.message.id,
    });

  } catch (error) {
    console.error("❌ incomingMessageController error:", error);

    // Cleanup file if something failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (error.message.includes("blocked contact")) {
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};


// ─────────────────────────────────────────────────────────────
// SEND TEXT MESSAGE  (Tenant / Agent → Contact)
// ─────────────────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { text }      = req.body;
    const tenantId      = req.tenantId;
    const senderType    = req.userType;

    const senderId =
      senderType === "TENANT"
        ? req.tenant?.id
        : req.user?.id;

    if (!senderId) {
      return res.status(401).json({
        success: false,
        message: "Unable to identify sender",
      });
    }

    if (!text?.trim()) {
      return res.status(400).json({
        success: false,
        message: "text is required",
      });
    }

    const message = await sendMessageService({
      contactId,
      tenantId,
      senderId,
      senderType,
      text,
    });

    // ── Socket emit ───────────────────────────────────────────
    emitToTenant(tenantId, "new_message", {
      conversationId: message.conversationId,
      message: {
        id:             message.id,
        type:           "TEXT",
        text:           message.text,
        senderId:       message.senderId,
        senderType:     message.senderType,
        direction:      "OUTBOUND",
        isFromCustomer: false,
        createdAt:      message.createdAt,
      },
    });

    return res.status(201).json({
      success: true,
      data:    message,
    });

  } catch (error) {
    if (error.message.includes("blocked contact")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ─────────────────────────────────────────────────────────────
// SEND MEDIA MESSAGE  (Tenant / Agent → Contact)
// ─────────────────────────────────────────────────────────────
export const sendMediaMessage = [
  upload.single("file"),

  async (req, res) => {
    try {

      console.log("=== MEDIA UPLOAD HIT ===");
      console.log("req.body:", req.body);
      console.log("req.file:", req.file);
      console.log("req.params:", req.params);
      console.log("req.tenantId:", req.tenantId);
      console.log("req.userType:", req.userType);

      const { contactId }               = req.params;
      const { caption, conversationId } = req.body;
      const file                        = req.file;
      const tenantId                    = req.tenantId;

      // ── Validate ──────────────────────────────────────────
      if (!file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      if (!conversationId) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          error: "conversationId is required",
        });
      }

      if (!tenantId) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          success: false,
          error: "tenantId is missing",
        });
      }

      // ── Identify sender ───────────────────────────────────
      let senderId   = null;
      let senderType = null;

      if (req.userType === "TENANT" && req.tenant) {
        senderId   = req.tenant.id;
        senderType = "TENANT";
      } else if (req.userType === "USER" && req.user) {
        senderId   = req.user.id;
        senderType = "USER";
      }

      if (!senderId || !senderType) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(401).json({
          success: false,
          error: "Unable to identify sender",
        });
      }

      // ── Call service ──────────────────────────────────────
      const message = await sendMediaMessageService({
        contactId,
        conversationId,
        tenantId,
        senderId,
        senderType,
        file,
        caption,
      });

      // ── Generate Signed URL ───────────────────────────────
      // ✅ NEW: Generate signed URL for secure media access
      const signedUrl = generateSignedUrl(message.mediaUrl, tenantId);

      // ── Socket emit ───────────────────────────────────────
      emitToTenant(tenantId, "new_message", {
        conversationId: message.conversationId,
        message: {
          id:             message.id,
          type:           message.type,
          text:           message.text,
          senderId:       message.senderId,
          senderType:     message.senderType,
          direction:      "OUTBOUND",
          isFromCustomer: false,
          mediaUrl:       signedUrl,        // ✅ signed URL
          mediaName:      message.mediaName,
          mediaSize:      message.mediaSize,
          mediaMimeType:  message.mediaMimeType,
          caption:        message.caption,
          createdAt:      message.createdAt,
        },
      });

      // ── Response ──────────────────────────────────────────
      return res.status(201).json({
        success: true,
        message: {
          ...message,
          mediaUrl: signedUrl,   // ✅ signed URL to frontend
        },
      });

    } catch (error) {
      console.error("sendMediaMessage error:", error);

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "File too large. Maximum 100MB",
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  },
];


// ─────────────────────────────────────────────────────────────
// DELETE MESSAGE
// ─────────────────────────────────────────────────────────────
export const deleteMessageController = async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "messageId is required",
      });
    }

    let requesterId   = null;
    let requesterRole = null;
    let tenantId      = null;

    if (req.userType === "TENANT") {
      requesterId   = req.tenant.id;
      requesterRole = "TENANT";
      tenantId      = req.tenant.id;

    } else if (req.userType === "USER") {
      requesterId   = req.user.id;
      requesterRole = "USER";     // ✅ matches deleteMessageService check
      tenantId      = req.tenantId;

    } else {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { deletedMessage, conversationId, tenantId: msgTenantId } =
      await deleteMessageService({
        messageId,
        requesterId,
        requesterRole,
        tenantId,
      });

    emitToTenant(msgTenantId, "message_deleted", {
      messageId:      deletedMessage.id,
      conversationId: conversationId,
      deletedAt:      deletedMessage.deletedAt,
    });

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      data: {
        messageId:      deletedMessage.id,
        conversationId: conversationId,
        isDeleted:      true,
        deletedAt:      deletedMessage.deletedAt,
      },
    });

  } catch (error) {
    console.error("❌ deleteMessageController error:", error.message);

    if (error.message.includes("Message not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }

    if (
      error.message.includes("Unauthorized") ||
      error.message.includes("already deleted")
    ) {
      return res.status(403).json({ success: false, message: error.message });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};