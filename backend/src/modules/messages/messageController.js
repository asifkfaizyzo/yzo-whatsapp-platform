import { sendMessage } from "./messageService.js";

export const sendMessageController = async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    console.log("REQ BODY:", req.body);

    // 1️⃣ Validate user
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const senderId = req.user.id;

    // 2️⃣ Call service
    const newMessage = await sendMessage({
      conversationId,
      senderId : req.user.id,
      message,
    //   type: "TEXT",
    });

    // 3️⃣ Response
    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};