/**
 * Helper stubs for auth service dependencies
 */

export class MFAService {
  async verifyMFA(token: string, secret: string): Promise<boolean> {
    return true; // Stub
  }

  async generateMFASecret(userId: string): Promise<string> {
    return "secret-placeholder";
  }
}

export class ClientRateLimit {
  async checkLimit(clientId: string): Promise<boolean> {
    return true;
  }

  async recordAttempt(clientId: string) {
    // Stub
  }
}

export class CSRFProtection {
  generateToken(): string {
    return "csrf-token-placeholder";
  }

  validateToken(_token: string): boolean {
    return true;
  }
}
