import { randomBytes } from 'crypto';
import { logger } from '../lib/logger';
import { BaseService } from './BaseService';
import { auditLogService } from './AuditLogService';
import type { SecretMetadata, SecretValue, ISecretProvider } from '../config/secrets/ISecretProvider';

export interface DualUserSecret {
  activeUser: 'primary' | 'secondary';
  primaryUsername: string;
  primaryPassword: string;
  secondaryUsername: string;
  secondaryPassword: string;
  lastRotatedAt?: string;
}

export interface RotationContext {
  tenantId: string;
  secretKey: string;
  provider: ISecretProvider;
  target: DatabaseRotationTarget;
  metadata?: Partial<SecretMetadata>;
  actor?: {
    id: string;
    email?: string;
    name?: string;
  };
}

export interface DatabaseRotationTarget {
  provisionUser(username: string, password: string): Promise<void>;
  promoteUser(username: string): Promise<void>;
  revokeUser?(username: string): Promise<void>;
  reloadApplications?(): Promise<void>;
}

export interface RotationResult {
  rotatedUser: string;
  retiredUser: string;
  newPassword: string;
  timestamp: string;
}

/**
 * RotationService
 *
 * Implements dual-user credential rotation with audit logging and
 * zero-downtime semantics. Generates a new secret, updates the
 * target system, persists to the configured secret provider, and
 * triggers application reload hooks when provided.
 */
export class RotationService extends BaseService {
  constructor() {
    super('RotationService');
  }

  /**
   * Rotate a database credential using a dual-user strategy.
   */
  async rotateDatabaseCredential(context: RotationContext): Promise<RotationResult> {
    const { tenantId, secretKey, provider, target, actor } = context;
    const systemActor = this.getActor(actor);

    const secret = await provider.getSecret(tenantId, secretKey, undefined, systemActor.id);
    const normalized = this.normalizeSecret(secret, secretKey);

    const retiringUser = normalized.activeUser === 'primary' ? 'primary' : 'secondary';
    const candidateUser = retiringUser === 'primary' ? 'secondary' : 'primary';
    const candidateUsername =
      candidateUser === 'primary' ? normalized.primaryUsername : normalized.secondaryUsername;

    const newPassword = this.generateStrongSecret();

    await target.provisionUser(candidateUsername, newPassword);
    await this.persistSecret(
      provider,
      tenantId,
      secretKey,
      normalized,
      candidateUser,
      newPassword,
      systemActor.id,
      context.metadata
    );
    await target.promoteUser(candidateUsername);

    if (target.reloadApplications) {
      await target.reloadApplications();
    }

    const retiringUsername =
      retiringUser === 'primary' ? normalized.primaryUsername : normalized.secondaryUsername;
    if (target.revokeUser) {
      await target.revokeUser(retiringUsername);
    }

    const timestamp = new Date().toISOString();

    await this.writeAuditEntry({
      userId: systemActor.id,
      userEmail: systemActor.email,
      userName: systemActor.name,
      tenantId,
      secretKey,
      rotatedUser: candidateUsername,
      retiredUser: retiringUsername,
      timestamp,
    });

    logger.info('Database credential rotated', {
      tenantId,
      secretKey,
      rotatedUser: candidateUsername,
      retiredUser: retiringUsername,
    });

    return {
      rotatedUser: candidateUsername,
      retiredUser: retiringUsername,
      newPassword,
      timestamp,
    };
  }

  private async persistSecret(
    provider: ISecretProvider,
    tenantId: string,
    secretKey: string,
    current: DualUserSecret,
    newActiveUser: 'primary' | 'secondary',
    newPassword: string,
    actorId: string,
    metadata?: Partial<SecretMetadata>
  ): Promise<void> {
    const updatedSecret: DualUserSecret = {
      ...current,
      activeUser: newActiveUser,
      primaryPassword: newActiveUser === 'primary' ? newPassword : current.primaryPassword,
      secondaryPassword: newActiveUser === 'secondary' ? newPassword : current.secondaryPassword,
      lastRotatedAt: new Date().toISOString(),
    };

    const rotationPolicy = metadata?.rotationPolicy || {
      enabled: true,
      intervalDays: 1,
      gracePeriodHours: 2,
      autoRotate: true,
    };

    const secretValue: SecretValue = {
      active_user: updatedSecret.activeUser,
      primary_username: updatedSecret.primaryUsername,
      primary_password: updatedSecret.primaryPassword,
      secondary_username: updatedSecret.secondaryUsername,
      secondary_password: updatedSecret.secondaryPassword,
      last_rotated_at: updatedSecret.lastRotatedAt,
    };

    const secretMetadata: SecretMetadata = {
      tenantId,
      secretPath: secretKey,
      version: `v-${Date.now()}`,
      createdAt: updatedSecret.lastRotatedAt || new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      sensitivityLevel: metadata?.sensitivityLevel || 'critical',
      rotationPolicy,
      tags: metadata?.tags || { managed_by: 'rotation-service' },
    };

    await provider.setSecret(tenantId, secretKey, secretValue, secretMetadata, actorId);
  }

  private normalizeSecret(secretValue: SecretValue, secretKey: string): DualUserSecret {
    const defaultUsername = `${secretKey}-service`;
    return {
      activeUser: (secretValue.active_user as 'primary' | 'secondary') || 'primary',
      primaryUsername: (secretValue.primary_username as string) || `${defaultUsername}-a`,
      primaryPassword: (secretValue.primary_password as string) || this.generateStrongSecret(),
      secondaryUsername: (secretValue.secondary_username as string) || `${defaultUsername}-b`,
      secondaryPassword: (secretValue.secondary_password as string) || this.generateStrongSecret(),
      lastRotatedAt: (secretValue.last_rotated_at as string) || undefined,
    };
  }

  private generateStrongSecret(): string {
    const raw = randomBytes(48).toString('base64');
    return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 48);
  }

  private getActor(actor?: RotationContext['actor']): { id: string; email: string; name: string } {
    if (actor) {
      return {
        id: actor.id,
        email: actor.email || `${actor.id}@system`,
        name: actor.name || 'rotation-service',
      };
    }

    return {
      id: 'system-rotation',
      email: 'system-rotation@valuecanvas.io',
      name: 'Rotation Service',
    };
  }

  private async writeAuditEntry(input: {
    userId: string;
    userEmail: string;
    userName: string;
    tenantId: string;
    secretKey: string;
    rotatedUser: string;
    retiredUser: string;
    timestamp: string;
  }): Promise<void> {
    await auditLogService.createEntry({
      userId: input.userId,
      userEmail: input.userEmail,
      userName: input.userName,
      action: 'secret.rotate',
      resourceType: 'database-credential',
      resourceId: `${input.tenantId}:${input.secretKey}`,
      status: 'success',
      details: {
        rotated_user: input.rotatedUser,
        retired_user: input.retiredUser,
        rotated_at: input.timestamp,
      },
      ipAddress: '0.0.0.0',
      userAgent: 'rotation-service',
    });
  }
}

export const rotationService = new RotationService();
