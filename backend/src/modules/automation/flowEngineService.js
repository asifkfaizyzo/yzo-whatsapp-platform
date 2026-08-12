// src/modules/automation/flowEngineService.js

import prisma from '../../config/prisma.js'
import flowService from './flowService.js'
import { emitToTenant, emitToUser, isUserOnline } from '../../lib/socket.js'

const flowEngine = {

  // ─────────────────────────────────────────
  // MAIN ENTRY POINT
  // ─────────────────────────────────────────
  processIncomingMessage: async (conversation, contact, userMessage, isNewContact = false) => {
    try {

      console.log(`\n📩 New message: "${userMessage}"`)
      console.log(`   Conversation ID : ${conversation.id}`)
      console.log(`   Mode            : ${conversation.mode}`)
      console.log(`   CurrentNodeId   : ${conversation.currentNodeId}`)
      console.log(`   BotPaused       : ${conversation.botPaused}`)
      console.log(`   IsNewContact    : ${isNewContact}`)

      // ── CASE 1: Agent is handling → notify agent only ──
      if (conversation.mode === 'AGENT' || conversation.botPaused) {
        console.log('👤 Agent is handling - skipping bot')
        await flowEngine.notifyAgents(conversation, contact, userMessage)
        return
      }

console.log(`🔍 DEBUG BEFORE CASE 1.5:`)
console.log(`   isNewContact: ${isNewContact}`)
console.log(`   contact.assignedTo: ${contact.assignedTo}`)
console.log(`   contact.name: ${contact.name}`)
console.log(`   contact.id: ${contact.id}`) 

   // ── CASE 1.5: Existing contact with assigned agent → skip bot ──
if (!isNewContact && contact.assignedTo) {
  console.log(`👤 Contact ${contact.name} already assigned - skipping bot`)

  // ✅ Only update conversation assignedTo
  // Do NOT force botPaused or mode change here
  // The conversation mode was already set correctly before
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      assignedTo: contact.assignedTo,  // sync assignment
    }
  })

  // ✅ Notify the assigned agent directly
  emitToUser(contact.assignedTo, 'new_message', {
    conversationId: conversation.id,
    message: {
      text:           userMessage,
      senderType:     'CONTACT',
      direction:      'INBOUND',
      isFromCustomer: true,
      createdAt:      new Date(),
    },
    contactName:  contact.name,
    contactPhone: contact.phone,
  })

  emitToUser(contact.assignedTo, 'new_notification', {
    notification: {
      id:        `msg_agent_${Date.now()}`,
      type:      'new_message',
      title:     `New message from ${contact.name}`,
      message:   userMessage.substring(0, 100),
      isRead:    false,
      createdAt: new Date(),
      metadata: {
        contactId:      contact.id,
        conversationId: conversation.id,
      }
    }
  })

  // ✅ Also notify tenant room for dashboard update
  emitToTenant(conversation.tenantId, 'new_message', {
    conversationId: conversation.id,
    message: {
      text:           userMessage,
      senderType:     'CONTACT',
      direction:      'INBOUND',
      isFromCustomer: true,
      createdAt:      new Date(),
    },
    contactName:  contact.name,
    contactPhone: contact.phone,
    assignedTo:   contact.assignedTo,
  })

  console.log(`📤 Notified assigned agent: ${contact.assignedTo}`)
  return
}

  // ── CASE 1.6: Contact in queue → don't restart bot ──
if (conversation.mode === 'QUEUED') {
  console.log(`⏳ Contact ${contact.name} in queue - no bot restart`)
  
  // Just deliver to tenant inbox
  emitToTenant(conversation.tenantId, 'new_message', {
    conversationId: conversation.id,
    message: {
      text: userMessage,
      senderType: 'CONTACT',
      direction: 'INBOUND',
      isFromCustomer: true,
      createdAt: new Date(),
    },
    contactName: contact.name,
    contactPhone: contact.phone,
  })
  return
}

      // ── CASE 2: Bot active + waiting on a node → continue flow ──
       // ✅ ADD DEBUG BEFORE THE CHECK
      console.log(`🐛 CASE 2 CHECK:`)
      console.log(`   mode: ${conversation.mode}`)
      console.log(`   currentFlowId: ${conversation.currentFlowId}`)
      console.log(`   currentNodeId: ${conversation.currentNodeId}`)
      
      if (
        conversation.mode === 'BOT' &&
        conversation.currentFlowId &&
        conversation.currentNodeId
      ) {

        console.log(`✅ CASE 2 entered - checking timeout`)

        // Check if session has timed out
        const timedOut = await flowEngine.checkSessionTimeout(
          conversation,
          24  // hours
        )
          console.log(`⏰ timedOut result: ${timedOut}`)
        if (timedOut) {
          console.log('⏰ Session timed out. Restarting flow...')

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              currentFlowId: null,
              currentNodeId: null,
              flowData: {},
              mode: 'BOT'
            }
          })

          const timeoutMsg =
            '⏰ Your previous session has ended.\n\n' +
            'Let me start fresh for you!'

          await flowEngine.sendWhatsAppMessage(
            conversation.tenantId,
            contact.phone,
            timeoutMsg
          )

          await flowEngine.saveBotMessage(
            conversation.id,
            timeoutMsg
          )

          const freshConversation = {
            ...conversation,
            currentFlowId: null,
            currentNodeId: null,
            flowData: {}
          }

          await flowEngine.startNewFlow(
            freshConversation,
            contact,
            userMessage,
            isNewContact
          )
          return
        }

        // Session active: resume
        console.log('🤖 Resuming flow from last node...')
        await flowEngine.continueFlow(
          conversation,
          contact,
          userMessage,
          isNewContact
        )
        return
      }

      // ── CASE 3: No active flow → find by keyword ──
      console.log('🔍 Looking for flow by keyword...')
      await flowEngine.startNewFlow(
        conversation,
        contact,
        userMessage,
        isNewContact
      )

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
      isNewContact
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

    await flowEngine.executeNode(
      currentNode,
      conversation,
      contact,
      userMessage,
      isNewContact
    )
  },

  // ─────────────────────────────────────────
  // Execute a single node
  // ─────────────────────────────────────────
  executeNode: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`\n⚙️  Node: ${node.id} | Type: ${node.type}`)

    switch (node.type) {

      case 'SEND_MESSAGE':
        await flowEngine.handleSendMessage(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'ASK_QUESTION':
        await flowEngine.handleAskQuestion(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'CONDITION':
        await flowEngine.handleCondition(
          node, conversation, contact, userMessage, isNewContact
        )
        break

      case 'ASSIGN_AGENT':
        await flowEngine.handleAssignAgent(
          node, conversation, contact
        )
        break

      case 'INTERACTIVE_BUTTONS':
        await flowEngine.handleInteractiveButtons(
          node, conversation, contact, userMessage, isNewContact
        )
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
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { currentNodeId: nextNode.id }
        })

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
        await flowEngine.endFlow(conversation)
      }

    } else {
      await flowEngine.endFlow(conversation)
    }
  },

  // ─────────────────────────────────────────
  // ASK_QUESTION Node
  // ─────────────────────────────────────────
  handleAskQuestion: async (node, conversation, contact, userMessage, isNewContact = false) => {

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

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentNodeId: node.id,
          mode: 'BOT'
        }
      })

      console.log(`⏸️  Waiting for reply on node: ${node.id}`)

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

      if (node.nextNodeId) {
        const nextNode = await flowService.getNodeById(node.nextNodeId)

        if (nextNode) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { currentNodeId: nextNode.id }
          })

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
  // ─────────────────────────────────────────
  handleCondition: async (node, conversation, contact, userMessage, isNewContact = false) => {
    console.log(`🔀 Evaluating condition...`)

    const options = node.options || []
    const answer = (userMessage || '').toLowerCase().trim()

    console.log(`   Contact  : ${contact.name} (${contact.phone})`)
    console.log(`   Answer   : "${answer}"`)
    console.log(`   IsNew    : ${isNewContact}`)
    console.log(`   Branches : ${options.length}`)
    console.log(`   Raw options from DB:`, JSON.stringify(options, null, 2))

    let matched = null

    for (const opt of options) {
      if (opt.default) continue

      const rule = (opt.value || '').toLowerCase().trim()
      if (!rule) continue

      console.log(`   🔍 Checking rule: "${rule}"`)

      let isMatch = false

      // ─── DB-BASED RULES ───
      if (rule === 'new_contact') {
        isMatch = isNewContact
        console.log(`   🆕 New contact (flag): ${isMatch}`)

      } else if (rule === 'registered' || rule === 'contact_exists') {
        isMatch = !isNewContact
        console.log(`   🗄️ Existing contact check: ${isMatch}`)

      } else if (rule === 'has_agent' || rule === 'assigned') {
        const c = await prisma.contact.findUnique({
          where: { id: contact.id },
          select: { assignedTo: true }
        })
        isMatch = !!c?.assignedTo
        console.log(`   👤 Has agent: ${isMatch}`)

      } else if (rule === 'no_agent' || rule === 'unassigned') {
        const c = await prisma.contact.findUnique({
          where: { id: contact.id },
          select: { assignedTo: true }
        })
        isMatch = !isNewContact && !c?.assignedTo
        console.log(`   👤 Existing without agent: ${isMatch}`)

      } else if (rule.startsWith('has_tag:')) {
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

      // ─── TEXT-BASED RULES ───
      } else if (rule === answer) {
        isMatch = true
        console.log(`   📝 Exact match: true`)

      } else if (rule.endsWith('*')) {
        const prefix = rule.slice(0, -1)
        if (answer.startsWith(prefix)) isMatch = true
        console.log(`   ⭐ Wildcard match: ${isMatch}`)

      } else if (answer.includes(rule)) {
        isMatch = true
        console.log(`   📝 Contains match: true`)

      } else if (rule === 'valid_order' || rule === 'valid') {
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
          isNewContact
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
  // INTERACTIVE_BUTTONS Node
  // ─────────────────────────────────────────
  handleInteractiveButtons: async (node, conversation, contact, userMessage, isNewContact = false) => {

    const isReplying = conversation.currentNodeId === node.id

    if (!isReplying) {
      // ── ARRIVING: Send buttons and STOP ──
      console.log(`🔘 Sending buttons: "${node.content}"`)

      const buttons = node.options || []

      await flowEngine.sendWhatsAppInteractiveButtons(
  conversation.tenantId,
  contact.phone,
  node.content,
  buttons
)

// ⭐ Save with button metadata for Inbox UI
await flowEngine.saveBotMessage(
  conversation.id,
  node.content,
  {
    type: 'INTERACTIVE_BUTTONS',
    buttons: buttons.map(b => ({
      id: b.id,
      title: b.title
    }))
  }
)

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          currentNodeId: node.id,
          mode: 'BOT'
        }
      })

      console.log(`⏸️  Waiting for button click: ${node.id}`)

    } else {
  // ── REPLYING: User clicked a button ──
  console.log(`🖱️  Button clicked: "${userMessage}"`)

  const buttons = node.options || []
  
  // ✅ ADD DEBUG
  console.log(`🔍 DEBUG BUTTONS:`)
  console.log(`   Available buttons:`, JSON.stringify(buttons, null, 2))
  console.log(`   User message: "${userMessage}"`)

  const clickedButton = buttons.find(
    btn =>
      btn.title.toLowerCase().trim() ===
      userMessage.toLowerCase().trim()
  )

  if (!clickedButton) {
    console.log('⚠️ No button matched. Re-sending buttons...')
    
    // ✅ Send + save so it appears in inbox
    await flowEngine.sendWhatsAppInteractiveButtons(
      conversation.tenantId,
      contact.phone,
      node.content,
      buttons
    )
    
    // ✅ ADD: Also save to DB so it shows in tenant inbox
    await flowEngine.saveBotMessage(
      conversation.id,
      node.content,
      {
        type: 'INTERACTIVE_BUTTONS',
        buttons: buttons.map(b => ({
          id: b.id,
          title: b.title
        }))
      }
    )
    
    console.log('✅ Buttons re-sent and saved')
    return
  }

      console.log(
        `✅ Button matched: "${clickedButton.title}"` +
        ` → Node: ${clickedButton.nextNodeId}`
      )

      if (clickedButton.nextNodeId) {
        const nextNode = await flowService.getNodeById(
          clickedButton.nextNodeId
        )

        if (nextNode) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { currentNodeId: null }
          })

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
          console.log('⚠️ Target node not found')
          await flowEngine.endFlow(conversation)
        }

      } else {
        console.log('⚠️ Button has no nextNodeId')
        await flowEngine.endFlow(conversation)
      }
    }
  },



  // ─────────────────────────────────────────
// ASSIGN_AGENT Node
// Stop bot → assign to human agent
// ─────────────────────────────────────────
handleAssignAgent: async (node, conversation, contact) => {
  console.log('\n👤 Assigning to agent...')

  let agent = null
  let freshContact = null

  // ═══════════════════════════════════════════════════
  // Step 1: Check if contact has a previous agent
  // ═══════════════════════════════════════════════════
  freshContact = await prisma.contact.findUnique({
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
    freshContact?.assignedUser?.isActive
  ) {
    const isOnline = isUserOnline(
      conversation.tenantId,
      freshContact.assignedTo
    )

    if (isOnline) {
      // ✅ Previous agent is ONLINE → sticky assign
      agent = freshContact.assignedUser
      console.log(`✅ Sticky → ${agent.name} (online)`)

    } else {
      // ⚠️ Previous agent is OFFLINE
      console.log(
        `⚠️ Previous agent ${freshContact.assignedUser.name} is OFFLINE`
      )

      // Notify the offline agent
      emitToUser(freshContact.assignedTo, 'new_notification', {
        notification: {
          id: `offline_${conversation.id}_${Date.now()}`,
          type: 'contact_waiting',
          title: '💬 Contact is waiting for you',
          message: `${contact.name} is waiting. Please come online.`,
          isRead: false,
          createdAt: new Date(),
          metadata: {
            contactId: contact.id,
            conversationId: conversation.id
          }
        }
      })

      // Tell customer their agent is offline
      await flowEngine.sendWhatsAppMessage(
        conversation.tenantId,
        contact.phone,
        `⚠️ Your previous agent *${freshContact.assignedUser.name}* ` +
        `is currently offline.\n\n` +
        `We are finding the next available agent for you... ⏳`
      )

      await flowEngine.saveBotMessage(
        conversation.id,
        `⚠️ Your previous agent ${freshContact.assignedUser.name} ` +
        `is offline. Finding next available agent...`
      )

      // agent stays null → falls through to Round Robin
    }
  }

  // ═══════════════════════════════════════════════════
  // Step 2: No agent yet → Try tag-matched agent
  // ═══════════════════════════════════════════════════
  if (!agent) {

    const contactTags = await prisma.contactTagMapping.findMany({
      where: { contactId: contact.id },
      select: { tagId: true }
    })

    const contactTagIds = contactTags.map(ct => ct.tagId)
    console.log(`🏷️  Contact tags: ${contactTagIds.length}`)

    // ── Step 3: Tag matched online agents ──
    if (contactTagIds.length > 0) {

      const matchingAgents = await prisma.userTagMapping.findMany({
        where: {
          tenantId: conversation.tenantId,
          tagId: { in: contactTagIds }
        },
        include: { user: true }
      })

      const onlineTagAgents = matchingAgents
        .filter(m =>
          m.user.isActive &&
          isUserOnline(conversation.tenantId, m.user.id)
        )
        .map(m => m.user)
        .filter((user, index, self) =>
          index === self.findIndex(u => u.id === user.id)
        )

      console.log(`👥 Online tag-matched agents: ${onlineTagAgents.length}`)

      if (onlineTagAgents.length > 0) {
        // Pick least busy (Round Robin)
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
        console.log(
          `✅ Tag match → ${agent.name} ` +
          `(load: ${agentCounts[0].count})`
        )
      }
    }

    // ── Step 4: No tag match → any online agent (Round Robin) ──
    if (!agent) {
      console.log(
        '⚠️ No tag-matched agent. ' +
        'Falling back to any online agent...'
      )

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
        // Pick least busy (Round Robin)
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
        console.log(
          `✅ Fallback → ${agent.name} ` +
          `(load: ${agentCounts[0].count})`
        )
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // Step 5: Agent found → ASSIGN + NOTIFY
  // ═══════════════════════════════════════════════════
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

    // Update contact assignment only if changed
    const previousAgentId = freshContact?.assignedTo || null

    if (previousAgentId !== agent.id) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          assignedTo: agent.id,
          assignedAt: new Date()
        }
      })
      console.log(`📝 Contact updated → assigned to ${agent.name}`)
    } else {
      console.log(`📝 Contact already assigned to ${agent.name} - no update needed`)
    }

    // Notify the assigned agent
    emitToUser(agent.id, 'new_assignment', {
      conversationId: conversation.id,
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone
      },
      fromQueue: false
    })

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
          conversationId: conversation.id
        }
      }
    })

       // Notify tenant dashboard
    emitToTenant(conversation.tenantId, 'conversation_assigned', {
      conversationId: conversation.id,
      agentId: agent.id,
      contact: {
        name: contact.name,
        phone: contact.phone
      },
      fromQueue: false
    })

    // ✅ ADD: Emit to USER so their Inbox refreshes
    emitToUser(agent.id, 'conversation_assigned', {
      conversationId: conversation.id,
      contactId:      contact.id,
      contactName:    contact.name,
      contactPhone:   contact.phone,
    })

    // ✅ ADD: Emit unread count to user
    const currentConv = await prisma.conversation.findUnique({
      where: { id: conversation.id }
    })

    if (currentConv && currentConv.unreadCount > 0) {
      emitToUser(agent.id, 'unread_count_update', {
        conversationId: currentConv.id,
        unreadCount:    currentConv.unreadCount,
        contactId:      contact.id,
        contactName:    contact.name,
      })
    }

    // ✅ ADD: Update tenant unassigned count (decrease)
    const unassignedCount = await prisma.contact.count({
      where: {
        tenantId:   conversation.tenantId,
        assignedTo: null,
        isActive:   true,
      }
    })

    emitToTenant(conversation.tenantId, 'unassigned_contact_update', {
      unassignedCount,
      isNew: false,
      contact: { id: contact.id, name: contact.name, phone: contact.phone },
      conversationId: conversation.id,
    })

    console.log(`✅ Final assignment: ${agent.name} (${agent.id})`)
    console.log(`📤 Emitted to user_${agent.id}: conversation_assigned, unread_count_update`)

    // Tell customer they are connected
    const assignmentText =
      `✅ You're connected with *${agent.name}*! ` +
      `They will assist you shortly. 💬`

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

    // ═══════════════════════════════════════════════════
    // Step 6: No agent online at all → QUEUE
    // ═══════════════════════════════════════════════════
    console.log('⚠️ No online agent available. Adding to queue...\n')

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        mode: 'QUEUED',
        currentFlowId: null,
        currentNodeId: null
      }
    })

    const queueText =
      '⏳ All our agents are currently busy.\n\n' +
      'You are in the waiting queue.\n' +
      'We will respond as soon as an agent is available.'

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
  // Check Session Timeout
  // ─────────────────────────────────────────
  checkSessionTimeout: async (conversation, timeoutHours = 24) => {
    try {

     const lastMessage = await prisma.message.findFirst({
  where: { 
    conversationId: conversation.id,
    direction: 'OUTBOUND'   // ✅ Only bot messages
  },
  orderBy: { createdAt: 'desc' }
})

        // ✅ ADD DEBUG LOG
    console.log(`\n🕐 TIMEOUT DEBUG:`)
    console.log(`   ConvID: ${conversation.id}`)
    console.log(`   Last msg ID: ${lastMessage?.id}`)
    console.log(`   Last msg text: "${lastMessage?.text}"`)
    console.log(`   Last msg createdAt: ${lastMessage?.createdAt}`)
    console.log(`   Current time: ${new Date()}`)

      if (!lastMessage) {
        console.log('⏰ No messages found. Fresh session.')
        return false
      }

      const diffHours =
        (new Date() - new Date(lastMessage.createdAt))
        / (1000 * 60 * 60)

      const currentNode = await flowService.getNodeById(
        conversation.currentNodeId
      )

      let timeout = timeoutHours

      if (currentNode?.type === 'INTERACTIVE_BUTTONS') {
        timeout = 1
      }

      if (currentNode?.type === 'ASK_QUESTION') {
        timeout = 24
      }

      console.log(
        `⏰ Node type     : ${currentNode?.type}\n` +
        `⏰ Elapsed       : ${diffHours.toFixed(2)} hours\n` +
        `⏰ Timeout limit : ${timeout} hours`
      )

      return diffHours > timeout

    } catch (error) {
      console.error('❌ checkSessionTimeout error:', error)
      return false
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
        // flowData: {},
        mode: 'BOT'
      }
    })
    console.log(`✅ Flow ended: ${conversation.id}`)
  },

  // ─────────────────────────────────────────
  // Notify agents (when mode = AGENT)
  // ─────────────────────────────────────────
  notifyAgents: async (conversation, contact, message) => {
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
  sendWhatsAppMessage: async (tenantId, phone, text) => {
    try {

      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log('║  📱 MOCK WHATSAPP (Dev Mode)        ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To   : ${phone}`)
        console.log(`║  Text : ${text}`)
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_' + Date.now() }] }
      }

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
  // Send Interactive Buttons via Meta API
  // ─────────────────────────────────────────
  sendWhatsAppInteractiveButtons: async (tenantId, phone, bodyText, buttons) => {
    try {

      if (process.env.MOCK_WHATSAPP === 'true') {
        console.log('\n╔══════════════════════════════════════╗')
        console.log('║  📱 MOCK WHATSAPP - BUTTONS         ║')
        console.log('╠══════════════════════════════════════╣')
        console.log(`║  To   : ${phone}`)
        console.log(`║  Body : ${bodyText}`)
        buttons.forEach((b, i) => {
          console.log(`║  Btn${i + 1} : [${b.title}]`)
        })
        console.log('╚══════════════════════════════════════╝\n')
        return { messages: [{ id: 'mock_btn_' + Date.now() }] }
      }

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

      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.slice(0, 3).map(btn => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            }))
          }
        }
      }

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${tenant.whatsappPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tenant.whatsappAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      )

      const result = await response.json()

      if (result.messages?.[0]?.id) {
        console.log(`📤 Buttons sent: ${result.messages[0].id}`)
      } else {
        console.error('❌ Button send failed:', result)
      }

      return result

    } catch (error) {
      console.error('❌ sendWhatsAppInteractiveButtons error:', error)
    }
  },

  // ─────────────────────────────────────────
  // Save bot message to DB
  // ─────────────────────────────────────────
  saveBotMessage: async (conversationId, text, extra = {}) => {
  try {
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        direction:  'OUTBOUND',
        text,
        type:       extra.type    || 'TEXT',
        buttons:    extra.buttons || null
      },
      include: {
        conversation: {
          include: {
            contact: true
          }
        }
      }
    })

    const messagePayload = {
      conversationId: message.conversationId,
      message: {
        id:             message.id,
        text:           message.text,
        type:           message.type,
        buttons:        message.buttons,
        senderId:       message.senderId,
        isFromCustomer: false,
        createdAt:      message.createdAt
      }
    }

    // ✅ Emit to tenant (dashboard)
    emitToTenant(message.conversation.tenantId, 'new_message', messagePayload)

    // ✅ ADD: Also emit to assigned user (agent's inbox)
    const assignedTo = message.conversation.assignedTo || 
                       message.conversation.contact?.assignedTo

    if (assignedTo) {
      emitToUser(assignedTo, 'new_message', messagePayload)
      console.log(`📤 Bot message emitted to user_${assignedTo}`)
    }

  } catch (error) {
    console.error('❌ saveBotMessage error:', error)
  }
}

}

export default flowEngine