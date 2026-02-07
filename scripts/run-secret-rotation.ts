import { rotationService } from '../src/services/RotationService';
import { defaultProvider } from '../src/config/secrets/ProviderFactory';
import type { DatabaseRotationTarget } from '../src/services/RotationService';
import { logger } from '../src/lib/logger';

class WebhookRotationTarget implements DatabaseRotationTarget {
  constructor(private readonly baseUrl: string) {}

  private async post(path: string, payload: Record<string, string>): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Webhook ${path} failed: ${response.status} ${body}`);
    }
  }

  async provisionUser(username: string, password: string): Promise<void> {
    await this.post('/provision', { username, password });
  }

  async promoteUser(username: string): Promise<void> {
    await this.post('/promote', { username });
  }

  async revokeUser(username: string): Promise<void> {
    await this.post('/revoke', { username });
  }

  async reloadApplications(): Promise<void> {
    await this.post('/reload', {});
  }
}

async function main(): Promise<void> {
  const tenantId = process.env.ROTATION_TENANT_ID || 'default';
  const secretKey = process.env.ROTATION_SECRET_KEY || 'database/password';
  const webhookUrl = process.env.ROTATION_TARGET_WEBHOOK;

  if (!webhookUrl) {
    throw new Error('ROTATION_TARGET_WEBHOOK is required for rotation CronJob');
  }

  const target = new WebhookRotationTarget(webhookUrl);

  await rotationService.rotateDatabaseCredential({
    tenantId,
    secretKey,
    provider: defaultProvider,
    target,
    metadata: {
      tags: { rotation_source: 'k8s-cronjob' },
    },
  });
}

main().catch((error) => {
  logger.error('Secret rotation job failed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
