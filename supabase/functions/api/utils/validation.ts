import { ValidationError } from '../middleware/error-handler.ts'

/**
 * Validation schema types
 */
export interface ValidationSchema {
  [key: string]: {
    required?: boolean
    type?: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'url' | 'phone'
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: RegExp
    enum?: string[]
    custom?: (value: any) => boolean | string
  }
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{
    field: string
    message: string
  }>
}

/**
 * Validate data against a schema
 */
export function validateRequest(schema: ValidationSchema, data: any): ValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field]

    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required` })
      continue
    }

    // Skip validation for optional empty fields
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue
    }

    // Type validation
    if (rules.type) {
      const typeError = validateType(field, value, rules.type)
      if (typeError) {
        errors.push(typeError)
        continue
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` })
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({ field, message: `${field} must be no more than ${rules.maxLength} characters` })
      }
    }

    // Numeric range validation
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field, message: `${field} must be at least ${rules.min}` })
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field, message: `${field} must be no more than ${rules.max}` })
      }
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      errors.push({ field, message: `${field} format is invalid` })
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` })
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(value)
      if (customResult !== true) {
        const message = typeof customResult === 'string' ? customResult : `${field} is invalid`
        errors.push({ field, message })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate specific data types
 */
function validateType(field: string, value: any, type: string): { field: string; message: string } | null {
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return { field, message: `${field} must be a string` }
      }
      break

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return { field, message: `${field} must be a number` }
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        return { field, message: `${field} must be a boolean` }
      }
      break

    case 'email':
      if (typeof value !== 'string' || !isValidEmail(value)) {
        return { field, message: `${field} must be a valid email address` }
      }
      break

    case 'uuid':
      if (typeof value !== 'string' || !isValidUUID(value)) {
        return { field, message: `${field} must be a valid UUID` }
      }
      break

    case 'url':
      if (typeof value !== 'string' || !isValidURL(value)) {
        return { field, message: `${field} must be a valid URL` }
      }
      break

    case 'phone':
      if (typeof value !== 'string' || !isValidPhone(value)) {
        return { field, message: `${field} must be a valid phone number` }
      }
      break
  }

  return null
}

/**
 * Email validation regex
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * UUID validation regex
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * URL validation
 */
function isValidURL(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Phone number validation (basic E.164 format)
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+[1-9]\d{1,14}$/
  return phoneRegex.test(phone)
}

/**
 * Validate and throw ValidationError if invalid
 */
export function validateAndThrow(schema: ValidationSchema, data: any): void {
  const result = validateRequest(schema, data)
  if (!result.valid) {
    const firstError = result.errors[0]
    throw new ValidationError(firstError.message, firstError.field)
  }
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  monitor: {
    name: { required: true, type: 'string' as const, minLength: 1, maxLength: 100 },
    url: { required: true, type: 'url' as const },
    pattern: { required: false, type: 'string' as const, maxLength: 500 },
    interval: { required: true, type: 'number' as const, min: 60, max: 86400 }, // 1 minute to 24 hours
    enabled: { required: false, type: 'boolean' as const }
  },
  
  notification: {
    type: { required: true, type: 'string' as const, enum: ['email', 'sms'] },
    recipient: { required: true, type: 'string' as const },
    message: { required: true, type: 'string' as const, minLength: 1, maxLength: 1000 }
  },

  smsStatus: {
    MessageSid: { required: true, type: 'string' as const },
    MessageStatus: { required: true, type: 'string' as const, enum: ['queued', 'sent', 'received', 'delivered', 'undelivered', 'failed'] },
    To: { required: false, type: 'phone' as const },
    From: { required: false, type: 'phone' as const }
  }
}

/**
 * Sanitize input data by removing potentially dangerous characters
 */
export function sanitizeInput(data: any): any {
  if (typeof data === 'string') {
    return data.trim().replace(/[<>]/g, '')
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput)
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value)
    }
    return sanitized
  }
  
  return data
}