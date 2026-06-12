import bcrypt from 'bcrypt';
import pkg from '@prisma/client';

export const logActivity = async ({
  conversationId,
  action,
  performedBy = null,
  performedByType = 'system',
  reason = null,
}) => {
  return prisma.conversationActivity.create({
    data: {
      conversationId,
      action,
      performedBy,
      performedByType,
      reason,
    },
  })
}