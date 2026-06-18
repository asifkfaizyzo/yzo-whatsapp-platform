import { isJunkMessage } from "./smartFilter.js"
import prisma from '../../config/prisma.js';


const determineAgent = (currentAssignedTo, strategy) => {
  if (strategy === 'original_agent' && currentAssignedTo) {
    return currentAssignedTo
  }
  // unassigned_pool or no original agent
  return null
}


export const evaluateReopen = async (conversation, messageText) => {
  const config = await prisma.autoReopenConfig.findUnique({
    where: { tenantId: conversation.tenantId },
  })

  // 🔍 Fetch the actual assignment status from the Contact model
  const contact = await prisma.contact.findUnique({
    where: { id: conversation.contactId },
  });
  const currentAssignedTo = contact?.assignedTo || conversation.assignedTo;

  const enabled = config?.enabled ?? true
  const reopenWindowHours = config?.reopenWindowHours ?? 72
  const maxReopenCount = config?.maxReopenCount ?? 5
  const smartFilterEnabled = config?.smartFilterEnabled ?? true
  const assignmentStrategy = config?.assignmentStrategy ?? 'original_agent'

  if (!enabled) {
    return {
      shouldReopen: false,
      reason: 'Auto-reopen is disabled for this tenant',
      assignToAgentId: null,
    }
  }

  let statusTime = null

  if (conversation.status === 'CLOSED') {
    statusTime = conversation.closedAt
  } else if (conversation.status === 'RESOLVED') {
    statusTime = conversation.resolvedAt
  }

  console.log('conversation.status:', conversation.status)
  console.log('conversation.closedAt:', conversation.closedAt)
  console.log('conversation.resolvedAt:', conversation.resolvedAt)
  console.log('chosen statusTime:', statusTime)
  console.log('reopenWindowHours:', reopenWindowHours)

  console.log('server now:', new Date().toISOString())
  console.log('statusTime:', statusTime)

  if (statusTime) {
    const hoursSinceClosed =
      (Date.now() - new Date(statusTime).getTime()) / (1000 * 60 * 60)

      console.log('hoursSinceClosed:', hoursSinceClosed)

    if (hoursSinceClosed > reopenWindowHours) {
      return {
        shouldReopen: false,
        reason: `Outside reopen window (${Math.floor(hoursSinceClosed)}h > ${reopenWindowHours}h)`,
        assignToAgentId: null,
      }
    }
  }

  if (conversation.reopenCount >= maxReopenCount) {
    return {
      shouldReopen: false,
      reason: `Max reopen limit reached (${conversation.reopenCount}/${maxReopenCount})`,
      assignToAgentId: null,
    }
  }

  if (smartFilterEnabled && isJunkMessage(messageText)) {
    return {
      shouldReopen: false,
      reason: `Junk message filtered: "${messageText}"`,
      assignToAgentId: null,
    }
  }

  const assignToAgentId = determineAgent(currentAssignedTo, assignmentStrategy)


  return {
    shouldReopen: true,
    reason: 'All checks passed',
    assignToAgentId,
  }
}
