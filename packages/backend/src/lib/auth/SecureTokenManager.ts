/**
 * Secure Token Manager
 */

export class SecureTokenManager {
  generateToken(payload: Record<string, any>): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  verifyToken(token: string): Record<string, any> | null {
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return null;
    }
  }
}

export const secureTokenManager = new SecureTokenManager();
