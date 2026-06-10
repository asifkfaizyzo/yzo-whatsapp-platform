import bcrypt from 'bcrypt';
import pkg from '@prisma/client';



export const sendMessage = async ({
  conversationId,
  senderId,
  message, 
  type = "TEXT",
}) => {
     console.log("SERVICE MESSAGE:", message); 
  // 1️⃣ Check conversation exists
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // 2️⃣ Create message
  const newMessage = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      text: message,
      type,
      isRead: false,
    },
  });

  // 3️⃣ Update conversation (IMPORTANT for inbox sorting)
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date(),
    },
  });

  return newMessage;
};