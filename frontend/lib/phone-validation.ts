import { parsePhoneNumber, isValidPhoneNumber, AsYouType } from 'libphonenumber-js'

export interface PhoneValidationResult {
  isValid: boolean
  normalizedNumber?: string
  formattedNumber?: string
  error?: string
}

/**
 * Validates and normalizes a phone number
 * @param phoneNumber - The phone number to validate (can be in various formats)
 * @param defaultCountry - Default country code to use if not specified (defaults to 'US')
 * @returns PhoneValidationResult with validation status and normalized/formatted numbers
 */
export function validatePhoneNumber(
  phoneNumber: string, 
  defaultCountry: 'US' | 'CA' | 'GB' | 'AU' = 'US'
): PhoneValidationResult {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      isValid: false,
      error: 'Phone number is required'
    }
  }

  // Clean the input - remove extra spaces and common separators
  const cleanedNumber = phoneNumber.trim().replace(/\s+/g, ' ')

  try {
    // First try to parse without country code
    let parsedNumber
    try {
      parsedNumber = parsePhoneNumber(cleanedNumber)
    } catch {
      // If that fails, try with default country
      parsedNumber = parsePhoneNumber(cleanedNumber, defaultCountry)
    }

    if (!parsedNumber) {
      return {
        isValid: false,
        error: 'Invalid phone number format'
      }
    }

    // Validate the parsed number
    if (!parsedNumber.isValid()) {
      return {
        isValid: false,
        error: 'Phone number is not valid for the detected country'
      }
    }

    // Return normalized (E.164) and formatted versions
    return {
      isValid: true,
      normalizedNumber: parsedNumber.format('E.164'), // +12345678900
      formattedNumber: parsedNumber.formatInternational() // +1 234 567 8900
    }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid phone number format'
    }
  }
}

/**
 * Formats a phone number for display purposes
 * @param phoneNumber - The phone number to format (preferably in E.164 format)
 * @param defaultCountry - Default country code to use if not specified
 * @returns Formatted phone number string or original if formatting fails
 */
export function formatPhoneNumber(phoneNumber: string, defaultCountry: 'US' | 'CA' | 'GB' | 'AU' = 'US'): string {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return phoneNumber
  }

  try {
    // First try to parse without country code
    let parsedNumber
    try {
      parsedNumber = parsePhoneNumber(phoneNumber)
    } catch {
      // If that fails, try with default country
      parsedNumber = parsePhoneNumber(phoneNumber, defaultCountry)
    }
    
    if (parsedNumber && parsedNumber.isValid()) {
      return parsedNumber.formatInternational()
    }
  } catch {
    // If parsing fails, return original
  }

  return phoneNumber
}

/**
 * Formats phone number as user types (for real-time formatting in input fields)
 * @param phoneNumber - The partial phone number being typed
 * @param defaultCountry - Default country code to use
 * @returns Formatted phone number string
 */
export function formatPhoneNumberAsYouType(
  phoneNumber: string,
  defaultCountry: 'US' | 'CA' | 'GB' | 'AU' = 'US'
): string {
  if (!phoneNumber) {
    return ''
  }

  try {
    const formatter = new AsYouType(defaultCountry)
    return formatter.input(phoneNumber)
  } catch {
    return phoneNumber
  }
}

/**
 * Checks if a phone number is valid without full parsing
 * @param phoneNumber - The phone number to check
 * @param defaultCountry - Default country code to use
 * @returns boolean indicating if the number is valid
 */
export function isPhoneNumberValid(
  phoneNumber: string,
  defaultCountry: 'US' | 'CA' | 'GB' | 'AU' = 'US'
): boolean {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false
  }

  try {
    return isValidPhoneNumber(phoneNumber, defaultCountry)
  } catch {
    return false
  }
}

/**
 * Normalizes a phone number to E.164 format
 * @param phoneNumber - The phone number to normalize
 * @param defaultCountry - Default country code to use
 * @returns Normalized phone number in E.164 format or null if invalid
 */
export function normalizePhoneNumber(
  phoneNumber: string,
  defaultCountry: 'US' | 'CA' | 'GB' | 'AU' = 'US'
): string | null {
  const result = validatePhoneNumber(phoneNumber, defaultCountry)
  return result.isValid ? result.normalizedNumber! : null
}