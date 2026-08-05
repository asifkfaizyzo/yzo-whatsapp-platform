// src/modules/automation/flowEngineService.js

import prisma from '../../config/prisma.js'
import flowService from './flowService.js'
import { emitToTenant } from '../../lib/socket.js'  // ✅ CORRECT IMPORT

const flowEngine = {

  // ─────────────────────────────────────────
  // MAIN ENTRY POINT
  // Called from webhookController.js
  // ─────────────────────────────────────────

  processIncomingMessage: async (conversation, contact, userMessage, isNewContact = false) => {
    try {

      console.log(`\n📩 New message: "${userMessage}"`)
      console.log(`   Conversation ID : ${conversation.id}`)
      console.log(`   Mode            : ${conversation.mode}`)
      console.log(`   CurrentNodeId   : ${conversation.currentNodeId}`)
      console.log(`   BotPaused       : ${conversation.botPaused}`)
      console.log(`   IsNewContact    : ${isNewContact}`)  // ✅ Log it

      // ── CASE 1: Agent is handling → notify agent only ──
      if (conversation.mode === 'AGENT' || conversation.botPaused) {
        console.log('👤 Agent is handling - skipping bot')
        await flowEngine.notifyAgents(conversation, contact, userMessage)
        return
      }

       // 🆕 CASE 1.5: Existing contact already has assigned agent → skip bot
    if (!isNewContact && contact.assignedTo) {
      console.log(`👤 Contact ${contact.name} already assigned to ${contact.assignedTo} - skipping bot`)
      
      // Update conversation to AGENT mode permanently for this contact
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { 
          mode: 'AGENT',
          assignedTo: contact.assignedTo,
          botPaused: true 
        }
      })
      
      await flowEngine.notifyAgents(conversation, contact, userMessage)
      return
    }

      // ── CASE 2: Bot active + waiting on a node → continue flow ──
      if (
        conversation.mode === 'BOT' &&
        conversation.currentFlowId &&
        conversation.currentNodeId
      ) {
        console.log('🤖 Continuing existing flow...')
        await flowEngine.continueFlow(conversation, contact, userMessage, isNewContact)
        return
      }

      // ── CASE 3: No active flow → find by keyword ──
      console.log('🔍 Looking for flow by keyword...')
      await flowEngine.startNewFlow(conversation, contact, userMessage, isNewContact)

    } catch (error) {
      console.error('❌ Flow Engine Error:', error)
    }
  },

  // ─────────────────────────────────────────
  // Start new flow by keyword
  // ─────────────────────────────────────────

  startNewFlow: async (conversation, contact, userMessage, isNewContact = false) => {
    const tenantId = conversation.tenantId

    // Try keyword match
    let flow = await flowService.findFlowByKeyword(tenantId, userMessage)

    // Try default flow
    if (!flow) {
      console.log('No keyword match. Trying default flow...')
      flow = await flowService.findDefaultFlow(tenantId)
    }

    // No flow found at all
    if (!flow) {
      console.log('⚠️ No flow found. Ignoring message.')
      return
    }

    // Flow has no nodes
    if (!flow.nodes || flow.nodes.length === 0) {
      console.log('⚠️ Flow has no nodes:', flow.id)
      return
    }

    console.log(`✅ Flow found: "${flow.name}" | Nodes: ${flow.nodes.length}`)

    // Get first node
    const firstNode = flow.nodes[0]

    // Update conversation state
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        currentFlowId: flow.id,
        currentNodeId: firstNode.id,
        mode: 'BOT',
        botPaused: false,
        status: 'OPEN',
        flowData: {}
      }
    })

    // Build updated conversation object
    const updatedConversation = {
      ...conversation,
      currentFlowId: flow.id,
      currentNodeId: firstNode.id,
      mode: 'BOT',
      botPaused: false,
      status: 'OPEN',
      flowData: {}
    }

    // Execute first node
    await flowEngine.executeNode(
      firstNode,
      updatedConversation,
      contact,
      userMessage,
      isNewContact  // ✅ Pass down
    )
  },

  // ─────────────────────────────────────────
  // Continue from current node
  // ─────────────────────────────────────────

  continueFlow: async (conversation, contact, userMessage, isNewContact = false) => {

    const currentNode = await flowService.getNodeById(conversation.currentNodeId)

    if (!currentNode) {
      console.log('⚠️ Node not found. Ending flow.')
      await flowEngine.endFlow(conversation)
      return
    }

    await flowEngine.executeNode(currentNode, conversation, contact, userMessage, isNewContact)
  },

  // ─────────────────────────────────────────
  // Execute a single node
  // ─────────────────────────────────────────

  executeNode: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`\n⚙️  Node: ${node.id} | Type: ${node.type}`)

    switch (node.type) {
      case 'SEND_MESSAGE':
        await flowEngine.handleSendMessage(node, conversation, contact, userMessage, isNewContact)
        break

      case 'ASK_QUESTION':
        await flowEngine.handleAskQuestion(node, conversation, contact, userMessage, isNewContact)
        break

      case 'CONDITION':
        await flowEngine.handleCondition(node, conversation, contact, userMessage, isNewContact)
        break

      case 'ASSIGN_AGENT':
        await flowEngine.handleAssignAgent(node, conversation, contact)
        break

      case 'END_FLOW':
        await flowEngine.endFlow(conversation)
        break

      default:
        console.log('⚠️ Unknown node type:', node.type)
    }
  },

  // ─────────────────────────────────────────
  // SEND_MESSAGE Node
  // Send message → move to next node auto
  // ─────────────────────────────────────────

  handleSendMessage: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`📨 Sending message: "${node.content}"`)

    await flowEngine.sendWhatsAppMessage(
      conversation.tenantId,
      contact.phone,
      node.content
    )

    await flowEngine.saveBotMessage(conversation.id, node.content)

    if (node.nextNodeId) {
      const nextNode = await flowService.getNodeById(node.nextNodeId)

      if (nextNode) {
        // Update DB to point at next node (for persistence/recovery)
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { currentNodeId: nextNode.id }
        })

        // ✅ Pass null so the next node knows we're ARRIVING (not replying)
        // If we passed nextNode.id, ASK_QUESTION would think the user is already replying
        const updatedConversation = {
          ...conversation,
          currentNodeId: null
        }

        await flowEngine.executeNode(
          nextNode,
          updatedConversation,
          contact,
          userMessage,
          isNewContact
        )
      } else {
        // nextNodeId set but node not found
        await flowEngine.endFlow(conversation)
      }

    } else {
      // No next node → end
      await flowEngine.endFlow(conversation)
    }
  },

  // ─────────────────────────────────────────
  // ASK_QUESTION Node
  //
  // isArriving = we just reached this node
  //   → send the question, stop, wait
  //
  // isReplying = user replied to this node
  //   → save answer, move to next
  // ─────────────────────────────────────────

  handleAskQuestion: async (node, conversation, contact, userMessage, isNewContact = false) => {

    // ⭐ Simple check:
    // If conversation.currentNodeId === node.id
    // means user is REPLYING to this question
    // (because we saved node.id when we asked)

    // If conversation.currentNodeId !== node.id
    // means we just ARRIVED here from previous node

    const isReplying = conversation.currentNodeId === node.id

    if (!isReplying) {
      // ── ARRIVING: Send question and STOP ──
      console.log(`❓ Asking: "${node.content}"`)

      await flowEngine.sendWhatsAppMessage(
        conversation.tenantId,
        contact.phone,
        node.content
      )

      await flowEngine.saveBotMessage(conversation.id, node.content)

      // ⭐ Save THIS node as current → so next message = reply
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentNodeId: node.id,
          mode: 'BOT'
        }
      })

      console.log(`⏸️  Waiting for reply on node: ${node.id}`)
      // STOP HERE ✅

    } else {
      // ── REPLYING: User answered ──
      console.log(`💬 User answered: "${userMessage}"`)

      const options = node.options || {}

      if (options.saveAs) {
        const currentFlowData = conversation.flowData || {}
        currentFlowData[options.saveAs] = userMessage

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { flowData: currentFlowData }
        })

        conversation.flowData = currentFlowData
        console.log(`💾 Saved "${options.saveAs}": "${userMessage}"`)
      }

      // Move to next node
      if (node.nextNodeId) {
        const nextNode = await flowService.getNodeById(node.nextNodeId)

        if (nextNode) {
          // Update DB to point at next node (for persistence/recovery)
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { currentNodeId: nextNode.id }
          })

          // ✅ Pass null so the next node knows we're ARRIVING (not replying)
          const updatedConversation = {
            ...conversation,
            currentNodeId: null
          }

          await flowEngine.executeNode(
            nextNode,
            updatedConversation,
            contact,
            userMessage,
            isNewContact
          )
        }
      } else {
        await flowEngine.endFlow(conversation)
      }
    }
  },



  // ─────────────────────────────────────────
  // CONDITION Node
  // Supports both text matching AND real DB checks
  // ─────────────────────────────────────────
  handleCondition: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`🔀 Evaluating condition...`)

    const options = node.options || []
    const answer = (userMessage || '').toLowerCase().trim()

    console.log(`   Contact  : ${contact.name} (${contact.phone})`)
    console.log(`   Answer   : "${answer}"`)
    console.log(`   IsNew    : ${isNewContact}`)
    console.log(`   Branches : ${options.length}`)
    console.log(`   Raw options from DB:`, JSON.stringify(options, null, 2))  // ✅ Show exact DB data

    let matched = null

    for (const opt of options) {
      if (opt.default) continue

      const rule = (opt.value || '').toLowerCase().trim()
      if (!rule) continue

      console.log(`   🔍 Checking rule: "${rule}"`)

      let isMatch = false

      // ─── 🗄️ DB-BASED RULES ───

      // ✅ Check if contact is NEW (first message ever - set by webhookWorker)
      if (rule === 'new_contact') {
        isMatch = isNewContact  // ✅ Use the definitive flag, NOT a time window
        console.log(`   🆕 New contact (flag): ${isMatch}`)
      }

      // ✅ Check if contact exists (registered) in DB
      // NOTE: This is always true since webhook creates contact before flow runs.
      // Only useful if you distinguish "registered" from a separate form signup flow.
      else if (rule === 'registered' || rule === 'contact_exists') {
        isMatch = !isNewContact  // ✅ Existing contact = NOT new
        console.log(`   🗄️ Existing contact check: ${isMatch}`)
      }

      // ✅ Check if contact has assigned agent
      else if (rule === 'has_agent' || rule === 'assigned') {
        const c = await prisma.contact.findUnique({
          where: { id: contact.id },
          select: { assignedTo: true }
        })
        isMatch = !!c?.assignedTo
        console.log(`   👤 Has agent: ${isMatch}`)
      }

      // ✅ Check if contact is existing AND has NO assigned agent
      else if (rule === 'no_agent' || rule === 'unassigned') {
        const c = await prisma.contact.findUnique({
          where: { id: contact.id },
          select: { assignedTo: true }
        })
        isMatch = !isNewContact && !c?.assignedTo
        console.log(`   👤 Existing without agent: ${isMatch}`)
      }

      // ✅ Check if contact has a specific tag
      else if (rule.startsWith('has_tag:')) {
        const tagName = rule.replace('has_tag:', '').trim()
        const tagExists = await prisma.contactTagMapping.findFirst({
          where: {
            contactId: contact.id,
            tag: {
              name: { equals: tagName, mode: 'insensitive' }
            }
          }
        })
        isMatch = !!tagExists
        console.log(`   🏷️  Tag "${tagName}": ${isMatch}`)
      }

      // ─── 📝 TEXT-BASED RULES ───

      // Exact match
      else if (rule === answer) {
        isMatch = true
        console.log(`   📝 Exact match: true`)
      }

      // Wildcard (ORD*)
      else if (rule.endsWith('*')) {
        const prefix = rule.slice(0, -1)
        if (answer.startsWith(prefix)) isMatch = true
        console.log(`   ⭐ Wildcard match: ${isMatch}`)
      }

      // Contains
      else if (answer.includes(rule)) {
        isMatch = true
        console.log(`   📝 Contains match: true`)
      }

      // Smart "valid_order" pattern
      else if (rule === 'valid_order' || rule === 'valid') {
        const orderPattern = /^[a-z]{2,}\d+$/i
        if (orderPattern.test(answer)) isMatch = true
        console.log(`   📦 Valid order pattern: ${isMatch}`)
      }

      if (isMatch) {
        matched = opt
        console.log(`   ✅ Matched: "${opt.value}"`)
        break
      }
    }

    // Default/else branch
    const defaultOption = options.find(opt => opt.default === true)
    const chosen = matched || defaultOption

    if (chosen && chosen.nextNodeId) {
      console.log(
        `➡️  Going to: ${chosen.default ? 'Else branch' : chosen.value}`
      )

      const nextNode = await flowService.getNodeById(chosen.nextNodeId)

      if (nextNode) {
        // Reset currentNodeId so next node knows it's arriving
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { currentNodeId: null }
        })

        const freshConversation = {
          ...conversation,
          currentNodeId: null
        }

        await flowEngine.executeNode(
          nextNode,
          freshConversation,
          contact,
          userMessage,
          isNewContact  // ✅ Pass down
        )
      } else {
        console.log('⚠️ Next node not found')
        await flowEngine.endFlow(conversation)
      }

    } else {
      console.log('⚠️ No matching branch. Ending flow.')
      await flowEngine.endFlow(conversation)
    }
  },


  // ─────────────────────────────────────────
  // ASSIGN_AGENT Node
  // Stop bot → assign to human agent
  // ─────────────────────────────────────────
  handleAssignAgent: async (node, conversation, contact) => {
  console.log('\n👤 Assigning to agent...')

  // Import here to avoid circular deps at module load time
  const { isUserOnline, emitToUser, emitToTenant } = await import('../../lib/socket.js')

  let agent = null

  // ═══════════════════════════════════════════════════════════
  // Step 1: If contact already has an assigned agent AND online → sticky
  // ═══════════════════════════════════════════════════════════
  const freshContact = await prisma.contact.findUnique({
    where: { id: contact.id },
    select: {
      assignedTo: true,
      assignedUser: {
        select: {
          id: true,
          name: true,
          isActive: true
        }
      }
    }
  })

  if (
    freshContact?.assignedTo &&
    freshContact?.assignedUser?.isActive &&
    isUserOnline(conversation.tenantId, freshContact.assignedTo)
  ) {
    agent = freshContact.assignedUser
    console.log(`✅ Sticky assignment → ${agent.name} (already assigned & online)`)
  } else {

    // ═══════════════════════════════════════════════════════════
    // Step 2: Get contact's tags
    // ═══════════════════════════════════════════════════════════
    const contactTags = await prisma.contactTagMapping.findMany({
      where: { contactId: contact.id },
      select: { tagId: true }
    })
    const contactTagIds = contactTags.map(ct => ct.tagId)
    console.log(`🏷️  Contact tags: ${contactTagIds.length}`)

    // ═══════════════════════════════════════════════════════════
    // Step 3: If tags exist → find tag-matched ONLINE agent
    // ═══════════════════════════════════════════════════════════
    if (contactTagIds.length > 0) {
      const matchingAgents = await prisma.userTagMapping.findMany({
        where: {
          tenantId: conversation.tenantId,
          tagId: { in: contactTagIds }
        },
        include: { user: true }
      })

      // Filter: active + online + unique
      const onlineTagAgents = matchingAgents
        .filter(m => m.user.isActive && isUserOnline(conversation.tenantId, m.user.id))
        .map(m => m.user)
        .filter((user, index, self) =>
          index === self.findIndex(u => u.id === user.id)
        )

      console.log(`👥 Online tag-matched agents: ${onlineTagAgents.length}`)

      if (onlineTagAgents.length > 0) {
        // Pick least busy
        const agentCounts = await Promise.all(
          onlineTagAgents.map(async (a) => {
            const count = await prisma.contact.count({
              where: {
                tenantId: conversation.tenantId,
                assignedTo: a.id
              }
            })
            return { agent: a, count }
          })
        )
        agentCounts.sort((a, b) => a.count - b.count)
        agent = agentCounts[0].agent
        console.log(`✅ Tag match → ${agent.name} (load: ${agentCounts[0].count})`)
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Step 4: Fallback → any ONLINE agent (even without matching tag)
    // ═══════════════════════════════════════════════════════════
    if (!agent) {
      console.log('⚠️  No tag-matched online agent. Falling back to any online agent...')

      const allAgents = await prisma.user.findMany({
        where: {
          tenantId: conversation.tenantId,
          isActive: true
        }
      })

      const onlineAgents = allAgents.filter(a =>
        isUserOnline(conversation.tenantId, a.id)
      )

      console.log(`👥 Total online agents: ${onlineAgents.length}`)

      if (onlineAgents.length > 0) {
        const agentCounts = await Promise.all(
          onlineAgents.map(async (a) => {
            const count = await prisma.contact.count({
              where: {
                tenantId: conversation.tenantId,
                assignedTo: a.id
              }
            })
            return { agent: a, count }
          })
        )
        agentCounts.sort((a, b) => a.count - b.count)
        agent = agentCounts[0].agent
        console.log(`✅ Fallback → ${agent.name} (load: ${agentCounts[0].count})`)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Step 5: Agent found → ASSIGN + NOTIFY
  // ═══════════════════════════════════════════════════════════
  if (agent) {
    // Update conversation
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        mode: 'AGENT',
        botPaused: true,
        assignedTo: agent.id,
        currentFlowId: null,
        currentNodeId: null
      }
    })

    // Update contact assignment (only if changed)
    if (!freshContact?.assignedTo || freshContact.assignedTo !== agent.id) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          assignedTo: agent.id,
          assignedAt: new Date()
        }
      })
    }

    // 🔔 Notify the SPECIFIC agent (for badge/toast on their screen)
    emitToUser(agent.id, 'new_assignment', {
      conversationId: conversation.id,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone
      },
      fromQueue: false
    })

    // 🆕 Also emit notification event (for bell icon in TopNavBar)
emitToUser(agent.id, 'new_notification', {
  notification: {
    id: `assign_${conversation.id}_${Date.now()}`,
    type: 'contact_assigned',
    title: '🎯 New chat assigned',
    message: `${contact.name} has been assigned to you`,
    isRead: false,
    createdAt: new Date(),
    metadata: {
      contactId: contact.id,
      conversationId: conversation.id,
    }
  }
})

    // 📢 Also broadcast to tenant (for admin dashboard)
    emitToTenant(conversation.tenantId, 'conversation_assigned', {
      conversationId: conversation.id,
      agentId: agent.id,
      contact: {
        name: contact.name,
        phone: contact.phone
      },
      fromQueue: false
    })
console.log(`✅ Final assignment: ${agent.name} (${agent.id})\n`)

// Send WhatsApp confirmation to customer with agent name
const assignmentText = `✅ You're connected with *${agent.name}*! They will assist you shortly. 💬`

await flowEngine.sendWhatsAppMessage(
  conversation.tenantId,
  contact.phone,
  assignmentText
)

await flowEngine.saveBotMessage(
  conversation.id,
  assignmentText
)

  } else {
    // ═══════════════════════════════════════════════════════════
    // Step 6: NO agent available → QUEUE the conversation
    // ═══════════════════════════════════════════════════════════
    console.log('⚠️  No online agent available. Adding to queue...\n')

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        mode: 'QUEUED',
        currentFlowId: null,
        currentNodeId: null
      }
    })

    const queueText = '⏳ All our agents are currently busy. You are in the waiting queue. We will respond as soon as an agent is available.'

await flowEngine.sendWhatsAppMessage(
  conversation.tenantId,
  contact.phone,
  queueText
)

await flowEngine.saveBotMessage(
  conversation.id,
  queueText
)
  }
},

 


  // ─────────────────────────────────────────
  // End the flow
  // ─────────────────────────────────────────

  endFlow: async (conversation) => {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        currentFlowId: null,
        currentNodeId: null,
        flowData: {},
        mode: 'BOT'
        // Stay BOT so next keyword triggers new flow
      }
    })
    console.log(`✅ Flow ended: ${conversation.id}`)
  },

  // ─────────────────────────────────────────
  // Notify agents (when mode = AGENT)
  // ─────────────────────────────────────────

  notifyAgents: async (conversation, contact, message) => {
    console.log(`👤 Agent is handling conversation ${conversation.id} - skipping bot flow execution`);
  },

  // ─────────────────────────────────────────
  // Send WhatsApp Message via Meta API
  // ─────────────────────────────────────────

  // sendWhatsAppMessage: async (tenantId, phone, text) => {
  //   try {
  //     // Get tenant WhatsApp credentials
  //     const tenant = await prisma.tenant.findUnique({
  //       where: { id: tenantId },
  //       select: {
  //         whatsappPhoneId: true,
  //         whatsappAccessToken: true
  //       }
  //     })

  //     if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
  //       console.error('❌ Tenant WhatsApp credentials not configured')
  //       return
  //     }

  //     const response = await fetch(
  //       `https://graph.facebook.com/v18.0/${tenant.whatsappPhoneId}/messages`,
  //       {
  //         method: 'POST',
  //         headers: {
  //           'Authorization': `Bearer ${tenant.whatsappAccessToken}`,
  //           'Content-Type': 'application/json'
  //         },
  //         body: JSON.stringify({
  //           messaging_product: 'whatsapp',
  //           to: phone,
  //           type: 'text',
  //           text: { body: text }
  //         })
  //       }
  //     )

  //     const result = await response.json()

  //     if (result.messages?.[0]?.id) {
  //       console.log(`📤 WhatsApp sent: ${result.messages[0].id}`)
  //     } else {
  //       console.error('❌ WhatsApp send failed:', result)
  //     }

  //     return result

  //   } catch (error) {
  //     console.error('❌ sendWhatsAppMessage error:', error)
  //   }
  // },



  // ─────────────────────────────────────────
  //test code
  // ─────────────────────────────────────────
  // ─────────────────────────────────────────
  // Send WhatsApp Message via Meta API
  // ─────────────────────────────────────────

  sendWhatsAppMessage: async (tenantId, phone, text) => {
    try {

      // ✅ DEV MODE — skip Meta API, just log
      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log('║  📱 MOCK WHATSAPP (Dev Mode)        ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To   : ${phone}`)
        console.log(`║  Text : ${text}`)
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_' + Date.now() }] }
      }

      // ✅ Real Meta API (production)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          whatsappPhoneId: true,
          whatsappAccessToken: true
        }
      })

      if (!tenant?.whatsappPhoneId || !tenant?.whatsappAccessToken) {
        console.error('❌ Tenant WhatsApp credentials not configured')
        return
      }

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${tenant.whatsappPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tenant.whatsappAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text }
          })
        }
      )

      const result = await response.json()

      if (result.messages?.[0]?.id) {
        console.log(`📤 WhatsApp sent: ${result.messages[0].id}`)
      } else {
        console.error('❌ WhatsApp send failed:', result)
      }

      return result

    } catch (error) {
      console.error('❌ sendWhatsAppMessage error:', error)
    }
  },



  // ─────────────────────────────────────────
  // Save bot message to DB
  // Using your existing Message model fields
  // ─────────────────────────────────────────

  saveBotMessage: async (conversationId, text) => {
    try {
      const message = await prisma.message.create({
        data: {
          conversationId,
          senderType: 'SYSTEM',   // ✅ matches your SenderType enum
          direction: 'OUTBOUND', // ✅ matches your MessageDirection enum
          text,
          type: 'TEXT'            // ✅ matches your MessageType enum
        },
        include: {
          conversation: true
        }
      })

      emitToTenant(message.conversation.tenantId, 'new_message', {
        conversationId: message.conversationId,
        message: {
          id: message.id,
          text: message.text,
          senderId: message.senderId,
          isFromCustomer: false,
          createdAt: message.createdAt
        }
      })
    } catch (error) {
      console.error('❌ saveBotMessage error:', error)
    }
  }

}

export default flowEngine