/**
 * Secrets Manager V2
 */

export class SecretsManagerV2 {
  async getSecret(key: string): Promise<string | null> {
    return process.env[key] || null;
  }
  
  async setSecret(key: string, value: string): Promise<void> {
    process.env[key] = value;
  }
}

export const secretsManagerV2 = new SecretsManagerV2();
