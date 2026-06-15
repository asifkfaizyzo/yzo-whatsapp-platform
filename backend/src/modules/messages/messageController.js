import { handleIncomingMessage,sendMessageService } from "./messageService.js";

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




//handle incoming message
export const incomingMessageController = async (req, res) => {
 try {
    const { contactId, tenantId, text, type } = req.body

    if (!contactId || !tenantId || !text) {
      return res.status(400).json({
        success: false,
        error: 'contactId, tenantId and text are required',
      })
    }
    const result = await handleIncomingMessage({
      contactId,
      tenantId,
      text,
      type,
    })

    return res.status(200).json({
      success: true,
      action: result.action,
      reason: result.reason,
      conversationId: result.conversation.id,
      conversationStatus: result.conversation.status,
      reopenCount: result.conversation.reopenCount,
      messageId: result.message.id,
    })
  } catch (error) {
    console.error('❌ Error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}


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

    return res.status(201).json({
      success: true,
      data: message,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};