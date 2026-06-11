import {
       getOrCreateConversation,getConversationByContact,
       getAssignedConversations,getMessages
       } from './conversationService.js';




 // MANUAL CREATE / GET CONVERSATION
export const createConversation = async (req, res) => {
  try {
    const { contactId } = req.body;
    const tenantId = req.user.tenantId;

    const result = await getOrCreateConversation(contactId, tenantId);

    return res.json({
      success: true,
      message: result.isNew
        ? "New conversation created"
        : "Conversation ready",
      isNew: result.isNew,
      conversation: result,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



//Get conversation by contactId
export const getConversationController = async (req, res) => {
  try {
    const { contactId } = req.params;

    const tenantId = req.user.tenantId;

    const conversation = await getConversationByContact(
      contactId,
      tenantId
    );
    console.log("Fetched conversation:", conversation);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation fetched successfully",
      data: conversation,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




//getAssignedConversations - conversations assigned to the logged in user
export const getAssignedConversationsController = async (req, res) => {
  try {
    // 1️⃣ Get logged-in user info
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // 2️⃣ Get pagination from URL
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // 3️⃣ Call service
    const result = await getAssignedConversations({
      userId,
      tenantId,
      page,
      limit,
    });

    // 4️⃣ Send response
    return res.status(200).json({
      success: true,
      message: "Conversations fetched successfully",
      ...result,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



//Get messages for a conversation (pagination + infinite scroll)
export const getMessagesController = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const conversationId = req.params.conversationId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
    const before = req.query.before || undefined;

    const data = await getMessages({
      tenantId,
      conversationId,
      limit,
      before,
    });

    return res.status(200).json({
      success: true,
      message: 'Messages fetched successfully',
      ...data,
    });

  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to fetch messages',
    });
  }
};



