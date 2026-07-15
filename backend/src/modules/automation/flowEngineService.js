// src/modules/automation/flowEngineService.js

import prisma from '../../config/prisma.js'
import flowService from './flowService.js'
import { emitToTenant } from '../../lib/socket.js'  // ✅ CORRECT IMPORT

const flowEngine = {

  // ─────────────────────────────────────────
  // MAIN ENTRY POINT
  // Called from webhookController.js
  // ─────────────────────────────────────────

  processIncomingMessage: async (conversation, contact, userMessage) => {
    try {

      console.log(`\n📩 New message: "${userMessage}"`)
      console.log(`   Conversation ID : ${conversation.id}`)
      console.log(`   Mode            : ${conversation.mode}`)
      console.log(`   CurrentNodeId   : ${conversation.currentNodeId}`)
      console.log(`   BotPaused       : ${conversation.botPaused}`)

      // ── CASE 1: Agent is handling → notify agent only ──
      if (conversation.mode === 'AGENT' || conversation.botPaused) {
        console.log('👤 Agent is handling - skipping bot')
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
        await flowEngine.continueFlow(conversation, contact, userMessage)
        return
      }

      // ── CASE 3: No active flow → find by keyword ──
      console.log('🔍 Looking for flow by keyword...')
      await flowEngine.startNewFlow(conversation, contact, userMessage)

    } catch (error) {
      console.error('❌ Flow Engine Error:', error)
    }
  },

  // ─────────────────────────────────────────
  // Start new flow by keyword
  // ─────────────────────────────────────────

  startNewFlow: async (conversation, contact, userMessage) => {
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
      userMessage
    )
  },

  // ─────────────────────────────────────────
  // Continue from current node
  // ─────────────────────────────────────────

  continueFlow: async (conversation, contact, userMessage) => {

    const currentNode = await flowService.getNodeById(conversation.currentNodeId)

    if (!currentNode) {
      console.log('⚠️ Node not found. Ending flow.')
      await flowEngine.endFlow(conversation)
      return
    }

    await flowEngine.executeNode(currentNode, conversation, contact, userMessage)
  },

  // ─────────────────────────────────────────
  // Execute a single node
  // ─────────────────────────────────────────

  executeNode: async (node, conversation, contact, userMessage) => {
    console.log(`\n⚙️  Node: ${node.id} | Type: ${node.type}`)

    switch (node.type) {
      case 'SEND_MESSAGE':
        await flowEngine.handleSendMessage(node, conversation, contact, userMessage)
        break

      case 'ASK_QUESTION':
        await flowEngine.handleAskQuestion(node, conversation, contact, userMessage)
        break

      case 'CONDITION':
        await flowEngine.handleCondition(node, conversation, contact, userMessage)
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

handleSendMessage: async (node, conversation, contact, userMessage) => {
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
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { currentNodeId: nextNode.id }
    })

     const updatedConversation = {
          ...conversation,
          currentNodeId: nextNode.id  // ✅ FIX — correct node id
        }

        await flowEngine.executeNode(
          nextNode,
          updatedConversation,
          contact,
          userMessage
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

handleAskQuestion: async (node, conversation, contact, userMessage) => {

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
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { currentNodeId: nextNode.id }
        })

        const updatedConversation = {
          ...conversation,
          currentNodeId: nextNode.id
        }

        await flowEngine.executeNode(
          nextNode,
          updatedConversation,
          contact,
          userMessage
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
  handleCondition: async (node, conversation, contact, userMessage) => {
    console.log(`🔀 Evaluating condition...`)

    const options = node.options || []
    const answer  = (userMessage || '').toLowerCase().trim()

    console.log(`   Contact  : ${contact.name} (${contact.phone})`)
    console.log(`   Answer   : "${answer}"`)
    console.log(`   Branches : ${options.length}`)

    let matched = null

    for (const opt of options) {
      if (opt.default) continue

      const rule = (opt.value || '').toLowerCase().trim()
      if (!rule) continue

      console.log(`   🔍 Checking rule: "${rule}"`)

      let isMatch = false

      // ─── 🗄️ DB-BASED RULES ───

      // ✅ Check if contact exists (registered) in DB
      if (rule === 'registered' || rule === 'contact_exists') {
        const dbContact = await prisma.contact.findFirst({
          where: {
            phone:    contact.phone,
            tenantId: conversation.tenantId
          }
        })
        isMatch = !!dbContact
        console.log(`   🗄️  Registered check: ${isMatch}`)
      }

      // ✅ Check if contact has assigned agent
      else if (rule === 'has_agent' || rule === 'assigned') {
        const c = await prisma.contact.findUnique({
          where:  { id: contact.id },
          select: { assignedTo: true }
        })
        isMatch = !!c?.assignedTo
        console.log(`   👤 Has agent: ${isMatch}`)
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

      // ✅ Check if contact is NEW (created in last 24h)
      else if (rule === 'new_contact') {
        const c = await prisma.contact.findUnique({
          where:  { id: contact.id },
          select: { createdAt: true }
        })
        const isRecent = c?.createdAt >
          new Date(Date.now() - 24 * 60 * 60 * 1000)
        isMatch = isRecent
        console.log(`   🆕 New contact: ${isMatch}`)
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
          data:  { currentNodeId: null }
        })

        const freshConversation = {
          ...conversation,
          currentNodeId: null
        }

        await flowEngine.executeNode(
          nextNode,
          freshConversation,
          contact,
          userMessage
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
// In flowEngineService.js
// Replace handleAssignAgent with this:

handleAssignAgent: async (node, conversation, contact) => {
  console.log('👤 Assigning to agent...')

  let agent = null

  // ── Step 1: Check if contact already assigned ──
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

  if (freshContact?.assignedTo && freshContact?.assignedUser?.isActive) {
    // Already assigned to an active agent → route to them
    agent = freshContact.assignedUser
    console.log(`✅ Already assigned to: ${agent.name} (${agent.id})`)
    console.log('   Routing to existing agent...')

  } else {

    // ── Step 2: Get contact's tags ──
    const contactTags = await prisma.contactTagMapping.findMany({
      where: { contactId: contact.id },
      select: { tagId: true }
    })

    const contactTagIds = contactTags.map(ct => ct.tagId)
    console.log('🏷️ Contact tags:', contactTagIds.length)

    // ── Step 3: If contact has tags → find matching agent ──
    if (contactTagIds.length > 0) {

      const matchingAgents = await prisma.userTagMapping.findMany({
        where: {
          tenantId: conversation.tenantId,
          tagId: { in: contactTagIds }
        },
        include: {
          user: true
        }
      })

      // Get unique active agents
      const activeAgents = matchingAgents
        .filter(m => m.user.isActive)
        .map(m => m.user)
        .filter((user, index, self) =>
          index === self.findIndex(u => u.id === user.id)
        )

      console.log('👥 Matching agents:', activeAgents.length)

      if (activeAgents.length > 0) {
        // Round Robin: find least loaded agent
        const agentCounts = await Promise.all(
          activeAgents.map(async (a) => {
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

        console.log(`✅ Tag match → Agent: ${agent.name}`)
        console.log(`   Load: ${agentCounts[0].count} contacts`)
      }
    }

    // ── Step 4: No tag match → any available agent ──
    if (!agent) {
      console.log('⚠️ No tag match. Finding any available agent...')

      // Find agent with least contacts (round robin)
      const allAgents = await prisma.user.findMany({
        where: {
          tenantId: conversation.tenantId,
          isActive: true
        }
      })

      if (allAgents.length > 0) {
        const agentCounts = await Promise.all(
          allAgents.map(async (a) => {
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

        console.log(`✅ Fallback → Agent: ${agent.name}`)
        console.log(`   Load: ${agentCounts[0].count} contacts`)
      }
    }
  }

  // ── Step 5: Assign agent ──
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

    // Update contact assignment (only if not already assigned)
    if (!freshContact?.assignedTo || freshContact.assignedTo !== agent.id) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          assignedTo: agent.id,
          assignedAt: new Date()
        }
      })
    }

    // Notify agent
    emitToTenant(
      conversation.tenantId,
      'conversation_assigned',
      {
        conversationId: conversation.id,
        agentId: agent.id,
        contact: {
          name: contact.name,
          phone: contact.phone
        }
      }
    )

    console.log(`✅ Final assignment: ${agent.name} (${agent.id})`)

    await flowEngine.sendWhatsAppMessage(
      conversation.tenantId,
      contact.phone,
      '✅ Connecting you to an agent. Please wait...'
    )

  } else {
    // ── Step 6: No agent available → queue ──
    console.log('⚠️ No agent available. Queuing...')

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        mode: 'QUEUED',
        currentFlowId: null,
        currentNodeId: null
      }
    })

    await flowEngine.sendWhatsAppMessage(
      conversation.tenantId,
      contact.phone,
      '⏳ All agents are busy. You are in queue. We will respond shortly.'
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
    // ✅ Using your existing emitToTenant
    emitToTenant(
      conversation.tenantId,
      'new_message',
      {
        conversationId: conversation.id,
        message,
        contactName: contact.name,
        contactPhone: contact.phone,
        assignedTo: conversation.assignedTo
      }
    )
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
      await prisma.message.create({
        data: {
          conversationId,
          senderType: 'SYSTEM',   // ✅ matches your SenderType enum
          direction:  'OUTBOUND', // ✅ matches your MessageDirection enum
          text,
          type: 'TEXT'            // ✅ matches your MessageType enum
        }
      })
    } catch (error) {
      console.error('❌ saveBotMessage error:', error)
    }
  }

}

export default flowEngine