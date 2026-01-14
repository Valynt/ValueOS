import { createProviderFromEnv } from '../config/secrets/ProviderFactory';
import type { ISecretProvider, SecretMetadata, SecretValue } from '../config/secrets/ISecretProvider';
import { logger } from '../lib/logger';
import { AuthorizationError } from './errors';
import { RbacService, RbacUser, SecretPermission } from './RbacService';

export class SecretsService {
