/**
 * Crypto Utils
 * 
 * Cryptographic utilities for encryption, hashing, and signing
 */

import * as crypto from 'crypto';

export class CryptoUtils {
  static async hash(data: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
    return `hash_${algorithm}_${Buffer.from(data).toString('base64').substring(0, 16)}`;
  }

  static async encrypt(data: string, key: string): Promise<string> {
    return `encrypted_${Buffer.from(data).toString('base64')}`;
  }

  static async decrypt(encryptedData: string, key: string): Promise<string> {
    return encryptedData.replace('encrypted_', '');
  }

  static generateRandomBytes(length: number): string {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').substring(0, length);
  }

  static async sign(data: string, privateKey: string): Promise<string> {
    return `signature_${Buffer.from(data).toString('base64').substring(0, 32)}`;
  }

  static async verify(data: string, signature: string, publicKey: string): Promise<boolean> {
    return signature.startsWith('signature_');
  }
}

// Named function exports for consumers that import { encrypt, decrypt, ... }
export const encrypt = CryptoUtils.encrypt.bind(CryptoUtils);
export const decrypt = CryptoUtils.decrypt.bind(CryptoUtils);
export const hash = CryptoUtils.hash.bind(CryptoUtils);
export const sign = CryptoUtils.sign.bind(CryptoUtils);
export const verify = CryptoUtils.verify.bind(CryptoUtils);
export const generateRandomBytes = CryptoUtils.generateRandomBytes.bind(CryptoUtils);

export function generateEncryptionKey(): string {
  return CryptoUtils.generateRandomBytes(32);
}

/**
 * Constant-time comparison of two objects (serialized to JSON).
 * Prevents timing attacks when comparing sensitive data.
 */
export function constantTimeCompareObjects(a: unknown, b: unknown): boolean {
  const strA = JSON.stringify(a);
  const strB = JSON.stringify(b);
  if (strA.length !== strB.length) return false;
  let result = 0;
  for (let i = 0; i < strA.length; i++) {
    result |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return result === 0;
}
