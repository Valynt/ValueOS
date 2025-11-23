/**
 * AWS Secrets Manager Integration
 * 
 * Securely manages API keys and sensitive configuration using AWS Secrets Manager.
 * Provides automatic rotation, caching, and fallback to environment variables.
 */

import { 
  SecretsManagerClient, 
  GetSecretValueCommand,
  UpdateSecretCommand,
  RotateSecretCommand
} from '@aws-sdk/client-secrets-manager';

interface SecretCache {
  value: any;
  expiresAt: number;
}

interface SecretsConfig {
  TOGETHER_API_KEY: string;
  OPENAI_API_KEY?: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  JWT_SECRET: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  SLACK_WEBHOOK_URL?: string;
}

export class SecretsManager {
  private client: SecretsManagerClient;
  private cache: Map<string, SecretCache> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private secretName: string;
  
  constructor() {
    this.client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    const environment = process.env.NODE_ENV || 'development';
    this.secretName = `valuecanvas/${environment}`;
  }
  
  /**
   * Get all secrets from AWS Secrets Manager
   */
  async getSecrets(): Promise<SecretsConfig> {
    // Check cache first
    const cached = this.cache.get(this.secretName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    
    try {
      const command = new GetSecretValueCommand({
        SecretId: this.secretName
      });
      
      const response = await this.client.send(command);
      
      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }
      
      const secrets = JSON.parse(response.SecretString) as SecretsConfig;
      
      // Cache the secrets
      this.cache.set(this.secretName, {
        value: secrets,
        expiresAt: Date.now() + this.cacheTTL
      });
      
      return secrets;
    } catch (error) {
      console.error('Failed to fetch secrets from AWS Secrets Manager:', error);
      
      // Fallback to environment variables
      console.warn('Falling back to environment variables');
      return this.getSecretsFromEnv();
    }
  }
  
  /**
   * Get specific secret value
   */
  async getSecret(key: keyof SecretsConfig): Promise<string | undefined> {
    const secrets = await this.getSecrets();
    return secrets[key];
  }
  
  /**
   * Fallback to environment variables
   */
  private getSecretsFromEnv(): SecretsConfig {
    return {
      TOGETHER_API_KEY: process.env.TOGETHER_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
      JWT_SECRET: process.env.JWT_SECRET || '',
      DATABASE_URL: process.env.DATABASE_URL || '',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL
    };
  }
  
  /**
   * Update a secret value
   */
  async updateSecret(updates: Partial<SecretsConfig>): Promise<void> {
    try {
      const currentSecrets = await this.getSecrets();
      const updatedSecrets = { ...currentSecrets, ...updates };
      
      const command = new UpdateSecretCommand({
        SecretId: this.secretName,
        SecretString: JSON.stringify(updatedSecrets)
      });
      
      await this.client.send(command);
      
      // Invalidate cache
      this.cache.delete(this.secretName);
      
      console.log('Secret updated successfully');
    } catch (error) {
      console.error('Failed to update secret:', error);
      throw error;
    }
  }
  
  /**
   * Rotate a secret (trigger automatic rotation)
   */
  async rotateSecret(): Promise<void> {
    try {
      const command = new RotateSecretCommand({
        SecretId: this.secretName
      });
      
      await this.client.send(command);
      
      // Invalidate cache
      this.cache.delete(this.secretName);
      
      console.log('Secret rotation initiated');
    } catch (error) {
      console.error('Failed to rotate secret:', error);
      throw error;
    }
  }
  
  /**
   * Clear cache (force refresh on next access)
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Validate that all required secrets are present
   */
  async validateSecrets(): Promise<{ valid: boolean; missing: string[] }> {
    const secrets = await this.getSecrets();
    const required: (keyof SecretsConfig)[] = [
      'TOGETHER_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'JWT_SECRET',
      'DATABASE_URL',
      'REDIS_URL'
    ];
    
    const missing = required.filter(key => !secrets[key]);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();

/**
 * Initialize secrets on application startup
 */
export async function initializeSecrets(): Promise<void> {
  console.log('Initializing secrets from AWS Secrets Manager...');
  
  try {
    const validation = await secretsManager.validateSecrets();
    
    if (!validation.valid) {
      console.warn('Missing required secrets:', validation.missing);
      console.warn('Application may not function correctly');
    } else {
      console.log('✅ All required secrets loaded successfully');
    }
  } catch (error) {
    console.error('Failed to initialize secrets:', error);
    console.warn('Falling back to environment variables');
  }
}
