/**
 * Phase 3: Data Masking Utilities
 * 
 * Client-side utilities for masking sensitive data before display.
 * Matches server-side Postgres functions for consistency.
 */

/**
 * Mask email address
 * @example maskEmail('john.doe@example.com') => 'jo***@example.com'
 */
export function maskEmail(email: string): string {
  if (!email) return email;
  return email.replace(/(.{2}).*(@.+)/, '$1***$2');
}

/**
 * Mask phone number
 * @example maskPhone('555-123-4567') => '(555) ***-4567'
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;
  
  // Extract digits only
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length >= 10) {
    const area = digits.substring(0, 3);
    const last4 = digits.substring(digits.length - 4);
    return `(${area}) ***-${last4}`;
  }
  
  return `***-${digits.substring(digits.length - 4)}`;
}

/**
 * Mask credit card number
 * @example maskCreditCard('1234567890123456') => '****-****-****-3456'
 */
export function maskCreditCard(cc: string): string {
  if (!cc) return cc;
  
  const digits = cc.replace(/\D/g, '');
  
  if (digits.length >= 13) {
    return `****-****-****-${digits.substring(digits.length - 4)}`;
  }
  
  return `****-****-${digits}`;
}

/**
 * Mask SSN
 * @example maskSSN('123-45-6789') => '***-**-6789'
 */
export function maskSSN(ssn: string): string {
  if (!ssn) return ssn;
  
  const digits = ssn.replace(/\D/g, '');
  
  if (digits.length === 9) {
    return `***-**-${digits.substring(5)}`;
  }
  
  return `***-**-${digits}`;
}

/**
 * Generic field redaction
 * @example redactField('sensitive-data', 4) => 'sens**********'
 */
export function redactField(value: string, visibleChars: number = 4): string {
  if (!value) return value;
  
  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }
  
  return value.substring(0, visibleChars) + '*'.repeat(value.length - visibleChars);
}

/**
 * Automatically mask common PII fields in an object
 */
export function autoMaskObject(data: Record<string, any>): Record<string, any> {
  const masked = { ...data };
  
  for (const [key, value] of Object.entries(masked)) {
    if (typeof value !== 'string') continue;
    
    const lowerKey = key.toLowerCase();
    
    if (lowerKey.includes('email')) {
      masked[key] = maskEmail(value);
    } else if (lowerKey.includes('phone')) {
      masked[key] = maskPhone(value);
    } else if (lowerKey.includes('ssn') || lowerKey.includes('social')) {
      masked[key] = maskSSN(value);
    } else if (lowerKey.includes('credit') || lowerKey.includes('card')) {
      masked[key] = maskCreditCard(value);
    } else if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token')) {
      masked[key] = '*'.repeat(Math.min(value.length, 12));
    }
  }
  
  return masked;
}

/**
 * Detect if text contains PII
 */
export function containsPII(text: string): boolean {
  if (!text) return false;
  
  // Email pattern
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    return true;
  }
  
  // Phone pattern
  if (/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text)) {
    return true;
  }
  
  // SSN pattern
  if (/\d{3}-?\d{2}-?\d{4}/.test(text)) {
    return true;
  }
  
  // Credit card pattern
  if (/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/.test(text)) {
    return true;
  }
  
  return false;
}

/**
 * Data sensitivity levels
 */
export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

/**
 * Classify data sensitivity
 */
export function classifyDataSensitivity(
  fieldName: string,
  fieldValue: string
): SensitivityLevel {
  const lowerName = fieldName.toLowerCase();
  
  // Restricted: Known sensitive fields or contains PII
  const restrictedFields = ['ssn', 'social_security', 'credit_card', 'password', 'api_key', 'secret'];
  if (restrictedFields.some(field => lowerName.includes(field))) {
    return 'restricted';
  }
  
  if (containsPII(fieldValue)) {
    return 'restricted';
  }
  
  // Confidential: Personal info
  const confidentialFields = ['email', 'phone', 'address', 'dob', 'salary', 'medical'];
  if (confidentialFields.some(field => lowerName.includes(field))) {
    return 'confidential';
  }
  
  // Internal: Business data
  const internalFields = ['revenue', 'profit', 'cost', 'internal_notes'];
  if (internalFields.some(field => lowerName.includes(field))) {
    return 'internal';
  }
  
  // Default to internal for safety
  return 'internal';
}
