import {
       getOrCreateConversation,getConversationByContact,
       getAssignedConversations,getMessages,updateConversationStatus,
       archiveConversation,unarchiveConversation,deleteConversation,
       getArchivedConversations, 
       } from './conversationService.js';




 // MANUAL CREATE / GET CONVERSATION
export const createConversation = async (req, res) => {
  try {

    console.log("req.user =>", req.user);
console.log("req.tenant =>", req.tenant);
console.log("req.auth =>", req.auth);

    const { contactId } = req.body;
    const tenantId = req.tenantId;

    const resultt = await getOrCreateConversation(
      contactId,
      tenantId
    );


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

    const tenantId = req.tenantId;

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
     console.log("🔥 tenantId:", req.tenantId);      
    console.log("🔥 userType:", req.userType); 
    // 1️⃣ Get logged-in user info
    const userId = req.userType === 'TENANT' ? null : req.user.id;
    const tenantId = req.tenantId;

    // 2️⃣ Get pagination and filter from URL
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = req.query.filter || (req.userType === 'TENANT' ? 'all' : 'my');

    let status = 'ALL'; // ← default is ALL (no status filter)
let assignmentType = 'all';

if (req.userType === 'TENANT') {
  if (filter === 'closed') {
    status = 'CLOSED';
  } else if (filter === 'open') {
    status = 'OPEN';
  } else if (filter === 'assigned') {
    assignmentType = 'assigned';
  } else if (filter === 'unassigned') {
    assignmentType = 'unassigned';
  }
  // filter === 'all' → status stays 'ALL' → returns everything
} else {
  // User/Agent
  assignmentType = 'my';
  if (filter === 'closed') {
    status = 'CLOSED';
  } else if (filter === 'open') {
    status = 'OPEN';
  }
  // filter === 'my' → status stays 'ALL' → returns all their chats
}



    // 3️⃣ Call service
    const result = await getAssignedConversations({
      userId,
      tenantId,
      page,
      limit,
      status,
      assignmentType,
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
    const tenantId = req.tenantId;
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


// Update conversation status controller
export const updateConversationStatusController = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;
    const tenantId = req.tenantId;

    // Extract agent context
    const agentId = req.userType === 'TENANT' ? null : req.user.id;
    const userType = req.userType;

    const conversation = await updateConversationStatus({
      conversationId,
      tenantId,
      status,
      agentId,
      userType,
    });

    return res.status(200).json({
      success: true,
      message: `Conversation status updated successfully to ${status}`,
      data: conversation,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};




// ── Archive Conversation ──────────────────────────────────
export const archiveConversationController = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const tenantId    = req.tenantId;
    const requesterId = req.userType === "TENANT" ? req.tenant.id : req.user.id;
    const requesterRole = req.userType; // "TENANT" or "USER"

    const result = await archiveConversation({
      conversationId,
      tenantId,
      requesterId,
      requesterRole,
    });

    return res.status(200).json({
      success: true,
      message: "Conversation archived successfully",
      data:    result,
    });

  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes("already archived")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ── Unarchive Conversation ────────────────────────────────
export const unarchiveConversationController = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const tenantId      = req.tenantId;
    const requesterId   = req.userType === "TENANT" ? req.tenant.id : req.user.id;
    const requesterRole = req.userType;

    const result = await unarchiveConversation({
      conversationId,
      tenantId,
      requesterId,
      requesterRole,
    });

    return res.status(200).json({
      success: true,
      message: "Conversation unarchived successfully",
      data:    result,
    });

  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ── Delete Conversation ───────────────────────────────────
export const deleteConversationController = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const tenantId      = req.tenantId;
    const requesterId   = req.userType === "TENANT" ? req.tenant.id : req.user.id;
    const requesterRole = req.userType;

    const result = await deleteConversation({
      conversationId,
      tenantId,
      requesterId,
      requesterRole,
    });

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully",
      data:    result,
    });

  } catch (error) {
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ── Get Archived Conversations ────────────────────────────
export const getArchivedConversationsController = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId   = req.userType === "USER" ? req.user.id : null;
    const page     = parseInt(req.query.page)  || 1;
    const limit    = parseInt(req.query.limit) || 20;

    const result = await getArchivedConversations({
      tenantId,
      userId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "Archived conversations fetched successfully",
      ...result,
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};