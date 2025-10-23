import validator from 'validator'

/**
 * Detects and extracts email addresses from text
 */
export function detectEmail(text: string): string | null {
  // Common email patterns in chat messages
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  const matches = text.match(emailRegex)

  if (!matches || matches.length === 0) {
    return null
  }

  // Get the first valid email
  for (const match of matches) {
    if (validator.isEmail(match)) {
      return match.toLowerCase().trim()
    }
  }

  return null
}

/**
 * Check if text contains phrases indicating email sharing
 */
export function isLikelyEmailMessage(text: string): boolean {
  const emailIndicators = [
    'email',
    'e-mail',
    'contact',
    'reach me',
    'send',
    '@',
    'mail',
  ]

  const lowerText = text.toLowerCase()
  return emailIndicators.some(indicator => lowerText.includes(indicator))
}

/**
 * Validate and sanitize email
 */
export function validateEmail(email: string): boolean {
  return validator.isEmail(email)
}
