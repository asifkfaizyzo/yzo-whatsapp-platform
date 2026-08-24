// import prisma from '../../config/prisma.js';

// export const logActivity = async ({
//   conversationId,
//   action,
//   performedBy = null,
//   performedByType = 'system',
//   reason = null,
// }) => {
//   return prisma.conversationActivity.create({
//     data: {
//       conversationId,
//       action,
//       performedBy,
//       performedByType,
//       reason,
//     },
//   })
// }



import prisma from '../../config/prisma.js';

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
  });
};