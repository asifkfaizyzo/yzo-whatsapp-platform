// src/modules/automation/flowService.js

import prisma from '../../config/prisma.js'

const flowService = {

  // ── Get all flows ──
  getAllFlows: async (tenantId) => {
    return await prisma.flow.findMany({
      where: { tenantId },
      include: {
        keywords: true,       // ← include keywords
        _count: {
          select: { nodes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  },

  // ── Get flow by id ──
  getFlowById: async (flowId, tenantId) => {
    return await prisma.flow.findFirst({
      where: { id: flowId, tenantId },
      include: {
        keywords: true,        // ← include keywords
        nodes: { orderBy: { order: 'asc' } }
      }
    })
  },

  // ── Create flow ──
  createFlow: async (tenantId, data) => {
    return await prisma.flow.create({
      data: {
        tenantId,
        name: data.name || 'New Flow',
        triggerType: data.triggerType || 'KEYWORD',
        isActive: false
      }
    })
  },

  // ── Save flow with nodes and keywords ──
  saveFlow: async (flowId, tenantId, data) => {
    const { name, triggerType, keywords, nodes, edges } = data

    // 1. Update flow name & triggerType
    await prisma.flow.update({
      where: { id: flowId },
      data: { 
        name,
        triggerType: triggerType || undefined
      }
    })

    // 2. Update keywords
     if (keywords && Array.isArray(keywords) && keywords.length > 0) {

    // Delete old keywords of this flow
    await prisma.keywordTrigger.deleteMany({
      where: { flowId }
    })

      // Add new keywords
      await prisma.keywordTrigger.createMany({
        data: keywords.map(k => ({
          tenantId,
          flowId,
          keyword: k.keyword.toLowerCase().trim(),
          category: k.category || null
        })),
        skipDuplicates: true
        // skip if keyword already used in another flow
      })
    }

        // 3. Delete old nodes ONLY if nodes provided
  // ⭐ Add this check
  if (nodes && Array.isArray(nodes) && nodes.length > 0) {

    // Delete old nodes
    await prisma.flowNode.deleteMany({
      where: { flowId }
    })

    // ── Build next node map (normal nodes) ──
const nextNodeMap = {}

// ── Build button edge map (button nodes) ──
const buttonEdgeMap = {}

if (edges && Array.isArray(edges)) {
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source)

    if (sourceNode?.type === 'INTERACTIVE_BUTTONS') {
      // Button node: map by button ID
      if (!buttonEdgeMap[edge.source]) {
        buttonEdgeMap[edge.source] = {}
      }
      buttonEdgeMap[edge.source][edge.sourceHandle] = edge.target

    } else {
      // Normal node: single next node
      nextNodeMap[edge.source] = edge.target
    }
  })
}

// Save new nodes
await prisma.flowNode.createMany({
  data: nodes.map((node, index) => {

    let options = node.data?.options || null

        // ⭐ INTERACTIVE_BUTTONS: inject nextNodeId + preserve media
    if (node.type === 'INTERACTIVE_BUTTONS') {
      const btnMap = buttonEdgeMap[node.id] || {}

      // Support both:
      // 1) old format: options = [buttons...]
      // 2) new format: options = { buttons: [...], media: {...} }
      const rawButtons = Array.isArray(node.data?.options)
        ? node.data.options
        : (node.data?.options?.buttons || [])

      const buttons = rawButtons.map(btn => ({
        ...btn,
        nextNodeId: btnMap[btn.id] || null
      }))

      options = {
        buttons,
        media: node.data?.media || node.data?.options?.media || null
      }
    }

    return {
      id: node.id,
      flowId,
      type: node.type,
      content: node.data?.content || '',
      options: options,
      nextNodeId: nextNodeMap[node.id] || null,
      position: node.position || null,
      order: index
    }
  })
})

  }

    return await prisma.flow.findFirst({
      where: { id: flowId },
      include: {
        keywords: true,
        nodes: { orderBy: { order: 'asc' } }
      }
    })
  },

  // ── Add keywords to flow ──
  addKeywords: async (flowId, tenantId, keywords) => {

      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    throw new Error('keywords must be a non-empty array')
  }

    return await prisma.keywordTrigger.createMany({
      data: keywords.map(k => ({
        tenantId,
        flowId,
        keyword: k.keyword.toLowerCase().trim(),
        category: k.category || null
      })),
      skipDuplicates: true
    })
  },

  // ── Remove keyword ──
  removeKeyword: async (keywordId, tenantId) => {
    return await prisma.keywordTrigger.delete({
      where: { id: keywordId }
    })
  },

  // ── Get all keywords of tenant ──
  getAllKeywords: async (tenantId) => {
    return await prisma.keywordTrigger.findMany({
      where: { tenantId },
      include: {
        flow: {
          select: { id: true, name: true }
        }
      },
      orderBy: { category: 'asc' }
    })
  },

  // ── FIND FLOW BY KEYWORD (used by engine) ──
// ── FIND FLOW BY KEYWORD (used by engine) ──
findFlowByKeyword: async (tenantId, userMessage) => {
  const cleanMessage = userMessage.toLowerCase().trim()

  console.log(`🔍 Searching keyword in message: "${cleanMessage}"`)

  // Get all active flows with keywords
  const triggers = await prisma.keywordTrigger.findMany({
    where: { tenantId },
    include: {
      flow: {
        include: {
          nodes: { orderBy: { order: 'asc' } }
        }
      }
    }
  })

  console.log(`📚 Total keywords in DB: ${triggers.length}`)

  // ✅ Case-insensitive match — check if message contains any keyword
  const matched = triggers.find(trigger => {
    const keyword = trigger.keyword.toLowerCase().trim()

    // Exact match
    if (cleanMessage === keyword) return true

    // Contains match — "Hello there" matches keyword "hello"
    if (cleanMessage.includes(keyword)) return true

    return false
  })

  // Return flow only if active
  if (matched && matched.flow.isActive) {
    console.log(`🎯 Keyword matched: "${matched.keyword}"`)
    return matched.flow
  }

  console.log('❌ No keyword matched')
  return null
},

  // ── Find default flow ──
  findDefaultFlow: async (tenantId) => {
    return await prisma.flow.findFirst({
      where: {
        tenantId,
        isDefault: true,
        isActive: true
      },
      include: {
        nodes: { orderBy: { order: 'asc' } }
      }
    })
  },

  // ── Find order flow (event-based trigger for WhatsApp cart orders) ──
  findOrderFlow: async (tenantId) => {
    return await prisma.flow.findFirst({
      where: {
        tenantId,
        triggerType: 'ORDER_RECEIVED',
        isActive: true
      },
      include: {
        nodes: { orderBy: { order: 'asc' } }
      }
    })
  },

  // ── Delete flow ──
  deleteFlow: async (flowId, tenantId) => {
    // keywords auto delete (onDelete: Cascade)
    // nodes auto delete (onDelete: Cascade)
    return await prisma.flow.delete({
      where: { id: flowId }
    })
  },

  // ── Toggle flow active ──
  toggleFlow: async (flowId, tenantId, isActive) => {
    return await prisma.flow.update({
      where: { id: flowId },
      data: { isActive }
    })
  },

  // ── Set default flow ──
    // ── Set default flow ──
  setDefaultFlow: async (flowId, tenantId) => {
    await prisma.flow.updateMany({
      where: { tenantId },
      data: { isDefault: false }
    })
    return await prisma.flow.update({
      where: { id: flowId },
      data: { isDefault: true, isActive: true }
    })
  },

  // ── Unset default flow ──
  unsetDefaultFlow: async (flowId, tenantId) => {
    return await prisma.flow.update({
      where: { id: flowId },
      data: { isDefault: false }
    })
  },

  // ── Get node by id ──
  getNodeById: async (nodeId) => {
    return await prisma.flowNode.findUnique({
      where: { id: nodeId }
    })
  }
}

export default flowService