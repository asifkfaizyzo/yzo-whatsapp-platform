// src/modules/automation/faqService.js

/**
 * Automation (Shopify) — Tenant FAQ search for the FAQ_LOOKUP flow node.
 * Auto-answers customer WhatsApp queries (shipping, returns, payments) via keyword matching.
 */

import prisma from '../../config/prisma.js'

const faqService = {

  // ─────────────────────────────────────────
  // Create a new FAQ entry
  // ─────────────────────────────────────────
  createFaq: async (tenantId, data) => {
    return prisma.botFaq.create({
      data: {
        tenantId,
        question: data.question,
        answer: data.answer,
        keywords: data.keywords || [],
        category: data.category || null,
        isActive: data.isActive !== false,
        priority: data.priority || 0,
      }
    })
  },

  // ─────────────────────────────────────────
  // Update an existing FAQ
  // ─────────────────────────────────────────
  updateFaq: async (faqId, data) => {
    return prisma.botFaq.update({
      where: { id: faqId },
      data: {
        ...(data.question !== undefined && { question: data.question }),
        ...(data.answer !== undefined && { answer: data.answer }),
        ...(data.keywords !== undefined && { keywords: data.keywords }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.priority !== undefined && { priority: data.priority }),
      }
    })
  },

  // ─────────────────────────────────────────
  // Delete an FAQ
  // ─────────────────────────────────────────
  deleteFaq: async (faqId) => {
    return prisma.botFaq.delete({
      where: { id: faqId }
    })
  },

  // ─────────────────────────────────────────
  // List all active FAQs for a tenant
  // ─────────────────────────────────────────
  getFaqsByTenant: async (tenantId, category = null) => {
    return prisma.botFaq.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(category && { category }),
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })
  },

  // ─────────────────────────────────────────
  // Search FAQ by query (keyword + fuzzy match)
  // ─────────────────────────────────────────
  searchFaq: async (tenantId, query) => {
    if (!query || !query.trim()) return null

    const normalizedQuery = query.toLowerCase().trim()
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2)

    // Fetch all active FAQs for this tenant
    const faqs = await prisma.botFaq.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    if (faqs.length === 0) return null

    let bestMatch = null
    let bestScore = 0

    for (const faq of faqs) {
      let score = 0
      const faqKeywords = (faq.keywords || []).map(k => k.toLowerCase())
      const faqQuestion = faq.question.toLowerCase()

      // 1. Exact keyword match (highest weight)
      for (const keyword of faqKeywords) {
        if (normalizedQuery === keyword) {
          score += 100
        } else if (normalizedQuery.includes(keyword) || keyword.includes(normalizedQuery)) {
          score += 60
        }
      }

      // 2. Word-level keyword overlap
      for (const word of queryWords) {
        for (const keyword of faqKeywords) {
          if (keyword.includes(word) || word.includes(keyword)) {
            score += 30
          }
        }
      }

      // 3. Question contains full query
      if (faqQuestion.includes(normalizedQuery)) {
        score += 50
      }

      // 4. Query words found in question
      const questionWords = faqQuestion.split(/\s+/).filter(w => w.length > 3)
      let questionWordMatches = 0
      for (const qWord of questionWords) {
        if (normalizedQuery.includes(qWord)) {
          questionWordMatches++
        }
      }
      if (questionWords.length > 0) {
        score += Math.round((questionWordMatches / questionWords.length) * 40)
      }

      // 5. Priority bonus
      score += (faq.priority || 0) * 5

      if (score > bestScore) {
        bestScore = score
        bestMatch = faq
      }
    }

    // Minimum threshold to avoid irrelevant matches
    if (bestScore < 20) return null

    return bestMatch
  }
}

export default faqService