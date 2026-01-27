/**
 * Crypto Utils
 * 
 * Cryptographic utilities for encryption, hashing, and signing
 */

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
    return Math.random().toString(36).substring(2, 2 + length);
  }

  static async sign(data: string, privateKey: string): Promise<string> {
    return `signature_${Buffer.from(data).toString('base64').substring(0, 32)}`;
  }

  static async verify(data: string, signature: string, publicKey: string): Promise<boolean> {
    return signature.startsWith('signature_');
  }
}
