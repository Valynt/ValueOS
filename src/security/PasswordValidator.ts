/**
 * Password Validator
 * 
 * Implements OWASP password validation guidelines.
 * Validates password strength, prevents common passwords, and enforces policy.
 */

import { getSecurityConfig } from './SecurityConfig';

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  score: number; // 0-100
}

/**
 * Common passwords list (top 100 most common)
 */
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', '12345678', '12345', '1234567', 'password1',
  'qwerty', 'abc123', '111111', '123123', 'admin', 'letmein', 'welcome', 'monkey',
  'dragon', 'master', 'sunshine', 'princess', 'football', 'shadow', 'michael',
  'jennifer', 'computer', 'baseball', 'jordan', 'superman', 'iloveyou', 'trustno1',
  'starwars', 'whatever', 'batman', 'passw0rd', 'zaq1zaq1', 'qwertyuiop', 'login',
  'access', 'solo', 'killer', 'charlie', 'freedom', 'ranger', 'buster', 'thomas',
  'robert', 'soccer', 'hockey', 'maverick', 'cookie', 'summer', 'pepper', 'maggie',
  'ginger', 'hunter', 'secret', 'harley', 'phoenix', 'bailey', 'jessica', 'ashley',
  'nicole', 'amanda', 'melissa', 'michelle', 'daniel', 'matthew', 'joshua', 'andrew',
  'anthony', 'william', 'joseph', 'david', 'richard', 'charles', 'thomas', 'donald',
  'george', 'kenneth', 'steven', 'edward', 'brian', 'ronald', 'kevin', 'jason',
  'jeff', 'gary', 'timothy', 'jose', 'larry', 'frank', 'scott', 'eric', 'stephen',
  'raymond', 'gregory', 'joshua', 'jerry', 'dennis', 'walter', 'patrick', 'peter',
]);

/**
 * Keyboard patterns to detect
 */
const KEYBOARD_PATTERNS = [
  'qwerty', 'asdfgh', 'zxcvbn', '1qaz2wsx', 'qazwsx', 'qwertyuiop',
  'asdfghjkl', 'zxcvbnm', '1234567890', '0987654321',
];

/**
 * Sequential patterns
 */
const SEQUENTIAL_PATTERNS = [
  'abcdefgh', 'bcdefghi', 'cdefghij', 'defghijk',
  '12345678', '23456789', '34567890',
];

/**
 * Validate password against policy
 */
export function validatePassword(
  password: string,
  userInfo?: {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  }
): PasswordValidationResult {
  const config = getSecurityConfig().passwordPolicy;
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // Check minimum length
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  } else {
    score += 10;
  }

  // Check maximum length
  if (password.length > config.maxLength) {
    errors.push(`Password must not exceed ${config.maxLength} characters`);
  }

  // Check for uppercase letters
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    score += 10;
  }

  // Check for lowercase letters
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    score += 10;
  }

  // Check for numbers
  if (config.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/\d/.test(password)) {
    score += 10;
  }

  // Check for special characters
  if (config.requireSpecialChars) {
    const specialCharsRegex = new RegExp(`[${config.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialCharsRegex.test(password)) {
      errors.push(`Password must contain at least one special character (${config.specialChars})`);
    } else {
      score += 15;
    }
  }

  // Check for common passwords
  if (config.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      errors.push('Password is too common. Please choose a more unique password');
    } else {
      score += 10;
    }
  }

  // Check for keyboard patterns
  const lowerPassword = password.toLowerCase();
  for (const pattern of KEYBOARD_PATTERNS) {
    if (lowerPassword.includes(pattern)) {
      warnings.push('Password contains a keyboard pattern. Consider using a more random password');
      score -= 5;
      break;
    }
  }

  // Check for sequential patterns
  for (const pattern of SEQUENTIAL_PATTERNS) {
    if (lowerPassword.includes(pattern)) {
      warnings.push('Password contains a sequential pattern. Consider using a more random password');
      score -= 5;
      break;
    }
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    warnings.push('Password contains repeated characters. Consider using more variety');
    score -= 5;
  }

  // Check for user information
  if (config.preventUserInfo && userInfo) {
    const userInfoValues = [
      userInfo.email?.split('@')[0],
      userInfo.username,
      userInfo.firstName,
      userInfo.lastName,
    ].filter(Boolean);

    for (const value of userInfoValues) {
      if (value && lowerPassword.includes(value.toLowerCase())) {
        errors.push('Password must not contain your personal information');
        break;
      }
    }
  }

  // Bonus points for length
  if (password.length >= 16) {
    score += 15;
  } else if (password.length >= 14) {
    score += 10;
  } else if (password.length >= 12) {
    score += 5;
  }

  // Bonus points for character variety
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.8) {
    score += 10;
  } else if (uniqueChars >= password.length * 0.6) {
    score += 5;
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  // Determine strength
  let strength: PasswordValidationResult['strength'];
  if (score >= 80) {
    strength = 'very-strong';
  } else if (score >= 60) {
    strength = 'strong';
  } else if (score >= 40) {
    strength = 'good';
  } else if (score >= 20) {
    strength = 'fair';
  } else {
    strength = 'weak';
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    strength,
    score,
  };
}

/**
 * Check if password has been compromised (using Have I Been Pwned API)
 * This is an async check that should be done separately
 */
export async function checkPasswordBreach(password: string): Promise<boolean> {
  try {
    // Hash the password using SHA-1
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // Use k-anonymity: send only first 5 characters of hash
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    // Query HIBP API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) {
      console.warn('Failed to check password breach status');
      return false;
    }

    const text = await response.text();
    const hashes = text.split('\n');

    // Check if our hash suffix appears in the results
    for (const line of hashes) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix === suffix) {
        return true; // Password has been breached
      }
    }

    return false; // Password not found in breaches
  } catch (error) {
    console.error('Error checking password breach:', error);
    return false; // Fail open - don't block if service is unavailable
  }
}

/**
 * Generate a strong random password
 */
export function generateStrongPassword(length: number = 16): string {
  const config = getSecurityConfig().passwordPolicy;
  
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = config.specialChars;

  let charset = '';
  let password = '';

  // Ensure at least one of each required type
  if (config.requireUppercase) {
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    charset += uppercase;
  }
  if (config.requireLowercase) {
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    charset += lowercase;
  }
  if (config.requireNumbers) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
    charset += numbers;
  }
  if (config.requireSpecialChars) {
    password += special[Math.floor(Math.random() * special.length)];
    charset += special;
  }

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Hash password using bcrypt-compatible algorithm
 * Note: In production, use a proper bcrypt library on the server side
 */
export async function hashPassword(password: string): Promise<string> {
  const config = getSecurityConfig().encryption;
  
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key material
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password + (config.pepper || ''));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive key using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: Math.pow(2, config.saltRounds),
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  // Combine salt and hash
  const hashArray = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const config = getSecurityConfig().encryption;
    
    // Decode hash
    const combined = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);

    // Hash the provided password with the same salt
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password + (config.pepper || ''));
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: Math.pow(2, config.saltRounds),
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const computedHash = new Uint8Array(derivedBits);

    // Compare hashes
    if (computedHash.length !== storedHash.length) {
      return false;
    }

    let match = true;
    for (let i = 0; i < computedHash.length; i++) {
      if (computedHash[i] !== storedHash[i]) {
        match = false;
      }
    }

    return match;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Calculate password entropy (bits)
 */
export function calculatePasswordEntropy(password: string): number {
  let charsetSize = 0;

  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/\d/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; // Approximate special chars

  return Math.log2(Math.pow(charsetSize, password.length));
}

/**
 * Estimate time to crack password
 */
export function estimateCrackTime(password: string): string {
  const entropy = calculatePasswordEntropy(password);
  const guessesPerSecond = 1e10; // 10 billion guesses per second (modern GPU)
  const possibleCombinations = Math.pow(2, entropy);
  const secondsToCrack = possibleCombinations / (2 * guessesPerSecond); // Average case

  if (secondsToCrack < 1) return 'Instant';
  if (secondsToCrack < 60) return `${Math.round(secondsToCrack)} seconds`;
  if (secondsToCrack < 3600) return `${Math.round(secondsToCrack / 60)} minutes`;
  if (secondsToCrack < 86400) return `${Math.round(secondsToCrack / 3600)} hours`;
  if (secondsToCrack < 31536000) return `${Math.round(secondsToCrack / 86400)} days`;
  if (secondsToCrack < 3153600000) return `${Math.round(secondsToCrack / 31536000)} years`;
  return 'Centuries';
}
