import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { nonceStore } from '../../middleware/nonceStore.js';

export type ApprovalAction = 'approve' | 'reject';

export interface SignedApprovalActionPayload {
  checkpointId: string;
  approvalRequestId: string;
  tenantId: string;
  action: ApprovalAction;
  actorId?: string;
  nonce: string;
  exp: number;
}

export interface ApprovalSignerConfig {
  secret: string;
  ttlSeconds?: number;
  issuer?: string;
}

export class NotificationActionSigner {
  private readonly secret: string;
  private readonly ttlSeconds: number;
  private readonly issuer: string;

  constructor(config: ApprovalSignerConfig) {
    this.secret = config.secret;
    this.ttlSeconds = config.ttlSeconds ?? 60 * 30;
    this.issuer = config.issuer ?? 'valueos-approvals';
  }

  signAction(input: Omit<SignedApprovalActionPayload, 'nonce' | 'exp'>): string {
    const payload: SignedApprovalActionPayload = {
      ...input,
      nonce: randomUUID(),
      exp: Math.floor(Date.now() / 1000) + this.ttlSeconds,
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.secret).update(encodedPayload).digest('hex');
    return `${encodedPayload}.${signature}`;
  }

  async verifyAndConsume(token: string): Promise<SignedApprovalActionPayload> {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
      throw new Error('Malformed approval action token');
    }

    const expectedSignature = createHmac('sha256', this.secret).update(encodedPayload).digest('hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new Error('Invalid approval action signature');
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SignedApprovalActionPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Approval action token expired');
    }

    const firstSeen = await nonceStore.consumeOnce(this.issuer, payload.nonce);
    if (!firstSeen) {
      throw new Error('Approval action replay detected');
    }

    return payload;
  }
}
