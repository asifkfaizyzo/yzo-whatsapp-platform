// src/auto-reopen/smartFilter.js

const JUNK_PATTERNS = [
  /^(ok|okay|k|kk)$/i,
  /^thanks?(\s+you)?[.!]*$/i,
  /^(great|awesome|perfect|cool)[.!]*$/i,
  /^(got it|noted|understood)[.!]*$/i,
  /^(yes|no|yeah|nope|yep)[.!]*$/i,
  /^[👍👌🙏✅😊]+$/,
]

export const isJunkMessage = (text) => {
  const trimmed = text?.trim() || ''
  const wordCount = trimmed.split(/\s+/).length

  // Only filter short messages (4 words or less)
  if (wordCount > 4) return false

  return JUNK_PATTERNS.some((pattern) => pattern.test(trimmed))
}