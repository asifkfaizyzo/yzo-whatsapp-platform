import { handleIncomingMessage, sendMessageService, sendMediaMessageService, deleteMessageService } from "./messageService.js";
import upload from "../../middlewares/upload.middleware.js";
import { emitToTenant } from '../../lib/socket.js';


// export const sendMessageController = async (req, res) => {
//   try {
//     const { conversationId, message } = req.body;
//     console.log("REQ BODY:", req.body);

//     // 1️⃣ Validate user
//     if (!req.user || !req.user.id) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized",
//       });
//     }

//     const senderId = req.user.id;

//     console.log("req.user =", req.user);
// console.log("req.tenant =", req.tenant);
// console.log("req.userType =", req.userType);

// console.log("Controller senderType =", req.userType);

//     // 2️⃣ Call service
//     const newMessage = await sendMessage({
//       conversationId,
//       senderId,
//       senderType : req.userType,

//       message,
//     //   type: "TEXT",
//     });

//     console.log({
//   senderId,
//   senderType: req.userType,
// });

//     // 3️⃣ Response
//     return res.status(200).json({
//       success: true,
//       message: "Message sent successfully",
//       data: newMessage,
//     });

//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };




export const incomingMessageController = async (req, res) => {
  try {
    const {
      contactId,
      tenantId,
      text,
      type,
      // ✅ Add media fields
      mediaUrl,
      mediaName,
      mediaSize,
      mediaMimeType,
      caption,
    } = req.body;

    // ✅ Fix: text is only required for TEXT messages
    if (!contactId || !tenantId) {
      return res.status(400).json({
        success: false,
        error: "contactId and tenantId are required",
      });
    }

    if (type === "TEXT" && !text) {
      return res.status(400).json({
        success: false,
        error: "text is required for TEXT messages",
      });
    }

    const result = await handleIncomingMessage({
      contactId,
      tenantId,
      text,
      type: type || "TEXT",
      // ✅ Pass media fields
      mediaUrl,
      mediaName,
      mediaSize,
      mediaMimeType,
      caption,
    });

    // Emit realtime event
    emitToTenant(tenantId, "new_message", {
      conversationId: result.conversation.id,
      message: {
        id: result.message.id,
        text: result.message.text,
        senderId: result.message.senderId,
        isFromCustomer: true,
        type: result.message.type,
        mediaUrl: result.message.mediaUrl,
        mediaName: result.message.mediaName,
        mediaSize: result.message.mediaSize,
        mediaMimeType: result.message.mediaMimeType,
        caption: result.message.caption,
        createdAt: result.message.createdAt,
      },
    });

    return res.status(200).json({
      success: true,
      action: result.action,
      reason: result.reason,
      conversationId: result.conversation.id,
      conversationStatus: result.conversation.status,
      messageId: result.message.id,
    });

  } catch (error) {
    console.error("❌ Error:", error);
    if (error.message.includes("blocked contact")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};


//Send Message Tenant to contact
export const sendMessage = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { text } = req.body;

    const tenantId = req.tenantId;

    const senderType = req.userType;

    const senderId =
      senderType === "TENANT"
        ? req.tenant.id
        : req.user.id;

    const message = await sendMessageService({
      contactId,
      tenantId,
      senderId,
      senderType,
      text,
    });

    // ─── ADDED: Emit Socket Event ───
    emitToTenant(tenantId, 'new_message', {
      conversationId: message.conversationId,
      message: {
        id: message.id,
        text: message.text,
        senderId: message.senderId,
        isFromCustomer: false,
        createdAt: message.createdAt
      }
    });

    return res.status(201).json({
      success: true,
      data: message,
    });

  } catch (error) {
    if (error.message.includes('blocked contact')) {
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



// src/modules/messages/messageController.js
export const sendMediaMessage = [
  upload.single("file"),

  async (req, res) => {
    try {
      console.log("req.user:", req.user);
      console.log("req.tenant:", req.tenant);
      console.log("req.tenantId:", req.tenantId);
      console.log("req.userType:", req.userType);

      const { contactId } = req.params;
      const { caption, conversationId } = req.body;
      const file = req.file;

      // 1. Check file exists
      if (!file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      // 2. Check conversationId
      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: "conversationId is required",
        });
      }

      // 3. Get sender info safely
      let senderId = null;
      let senderType = null;

      if (req.userType === "TENANT" && req.tenant) {
        senderId = req.tenant.id;
        senderType = "TENANT";
      } else if (req.userType === "USER" && req.user) {
        senderId = req.user.id;
        senderType = "AGENT"; // map USER -> AGENT
      }

      if (!senderId || !senderType) {
        return res.status(401).json({
          success: false,
          error: "Unable to identify sender",
        });
      }

      // 4. Call service
      const message = await sendMediaMessageService({
        contactId,
        conversationId,
        senderId,
        senderType,
        file,
        caption,
      });

      // 5. Return response
      return res.status(201).json({
        success: true,
        message,
      });

    } catch (error) {
      console.error("sendMediaMessage error:", error);

      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: "File too large",
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
// DELETE MESSAGE CONTROLLER
// ─────────────────────────────────────────────────────────────
export const deleteMessageController = async (req, res) => {
  try {
    const { messageId } = req.params;

    // ── Step 1: Validate messageId ──────────────────────────
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "messageId is required",
      });
    }

    // ── Step 2: Identify requester ──────────────────────────
    /*
      Your existing middlewares set:
        req.userType  → "TENANT" | "USER" 
        req.tenant    → tenant object  (if TENANT)
        req.user      → user object    (if USER/SUPER_ADMIN)
        req.tenantId  → tenant id
    */

    let requesterId   = null;
    let requesterRole = null;
    let tenantId      = null;

     if (req.userType === "TENANT") {
      requesterId   = req.tenant.id;
      requesterRole = "TENANT";
      tenantId      = req.tenant.id;  // same as requesterId for tenant

    } else if (req.userType === "USER") {
      requesterId   = req.user.id;
      requesterRole = "AGENT";
      tenantId      = req.tenantId;   // set by verifyTenantOrUser middleware

    } else {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // ── Step 3: Call service ────────────────────────────────
    const { deletedMessage, conversationId, tenantId: msgTenantId } =
      await deleteMessageService({
        messageId,
        requesterId,
        requesterRole,
        tenantId,
      });

    // ── Step 4: Emit socket event ───────────────────────────
    // Notify all connected clients in this tenant room
    emitToTenant(msgTenantId, "message_deleted", {
      messageId:      deletedMessage.id,
      conversationId: conversationId,
      deletedAt:      deletedMessage.deletedAt,
    });

    console.log("📤 Emitted message_deleted event for:", messageId);

    // ── Step 5: Return response ─────────────────────────────
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

    // ── Known errors → 400/403 ──────────────────────────────
    const unauthorizedErrors = [
      "Unauthorized",
      "already deleted",
    ];

    const notFoundErrors = [
      "Message not found",
    ];

    if (notFoundErrors.some((e) => error.message.includes(e))) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (unauthorizedErrors.some((e) => error.message.includes(e))) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    // ── Unknown errors → 500 ───────────────────────────────
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};