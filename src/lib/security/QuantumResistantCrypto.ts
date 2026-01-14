/**
 * Quantum-Resistant Cryptography Preparation
 *
 * Implements post-quantum cryptographic algorithms, migration strategies,
 * and hybrid encryption schemes for quantum-safe security.
 */

import { logger } from '../logger';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type QuantumAlgorithm =
  | 'kyber-1024'           // Key Encapsulation Mechanism
  | 'dilithium-5'         // Digital Signature
  | 'falcon-1024'         // Digital Signature
  | 'ntru-hps-2048-509'  // Encryption
  | 'hqc-256'            // Code-based cryptography
  | 'sphincs-shake-256'; // Hash-based signatures

export type ClassicalAlgorithm =
  | 'rsa-4096'
  | 'ecdsa-p384'
  | 'ed25519'
  | 'x25519'
  | 'aes-256-gcm';

export interface QuantumKeyPair {
  algorithm: QuantumAlgorithm;
  publicKey: string;
  privateKey: string;
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
  securityLevel: 128 | 192 | 256; // bits
}

export interface HybridKeyPair {
  classical: {
    algorithm: ClassicalAlgorithm;
    publicKey: string;
    privateKey: string;
  };
  quantum: {
    algorithm: QuantumAlgorithm;
    publicKey: string;
    privateKey: string;
  };
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface QuantumSignature {
  quantumSignature: string;
  classicalSignature: string;
  algorithm: QuantumAlgorithm;
  keyId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface HybridEncryption {
  encryptedData: {
    classical: string;
    quantum: string;
  };
  symmetricKey: {
    encryptedClassical: string;
    encryptedQuantum: string;
  };
  algorithm: {
    classical: ClassicalAlgorithm;
    quantum: QuantumAlgorithm;
    symmetric: string;
  };
  metadata: {
    iv: string;
    tag: string;
    nonce: string;
  };
}

export interface MigrationConfig {
  enabled: boolean;
  migrationMode: 'disabled' | 'hybrid' | 'quantum-only';
  targetQuantumAlgorithm: QuantumAlgorithm;
  fallbackClassicalAlgorithm: ClassicalAlgorithm;
  migrationDeadline: Date;
  keyRotationInterval: number; // days
  hybridModeDuration: number; // days
  enforceQuantumForNewKeys: boolean;
  allowClassicalFallback: boolean;
}

export interface QuantumSecurityMetrics {
  totalKeys: number;
  quantumKeys: number;
  hybridKeys: number;
  classicalKeys: number;
  migrationProgress: number; // percentage
  quantumOperations: number;
  failedQuantumOperations: number;
  averageQuantumOperationTime: number; // milliseconds
}

// ============================================================================
// Quantum-Resistant Cryptography Manager
// ============================================================================

export class QuantumResistantCryptoManager {
  private static instance: QuantumResistantCryptoManager;
  private config: MigrationConfig;
  private keyStore: Map<string, HybridKeyPair> = new Map();
  private quantumKeys: Map<string, QuantumKeyPair> = new Map();
  private metrics: QuantumSecurityMetrics;
  private migrationState: {
    phase: 'preparation' | 'hybrid' | 'transition' | 'quantum-only' | 'complete';
    startedAt: Date;
    currentPhaseStarted: Date;
    keysMigrated: number;
    totalKeysToMigrate: number;
  };

  private constructor(config: MigrationConfig) {
    this.config = config;
    this.metrics = {
      totalKeys: 0,
      quantumKeys: 0,
      hybridKeys: 0,
      classicalKeys: 0,
      migrationProgress: 0,
      quantumOperations: 0,
      failedQuantumOperations: 0,
      averageQuantumOperationTime: 0,
    };

    this.migrationState = {
      phase: 'preparation',
      startedAt: new Date(),
      currentPhaseStarted: new Date(),
      keysMigrated: 0,
      totalKeysToMigrate: 0,
    };

    this.initializeQuantumSupport();
    this.startMigrationProcess();
  }

  static getInstance(config?: MigrationConfig): QuantumResistantCryptoManager {
    if (!QuantumResistantCryptoManager.instance) {
      if (!config) {
        throw new Error('Migration config required for first initialization');
      }
      QuantumResistantCryptoManager.instance = new QuantumResistantCryptoManager(config);
    }
    return QuantumResistantCryptoManager.instance;
  }

  /**
   * Initialize quantum-resistant cryptographic support
   */
  private initializeQuantumSupport(): void {
    try {
      // Check if quantum crypto libraries are available
      // In production, would use libraries like:
      // - liboqs for Open Quantum Safe
      // - pqcrypto for post-quantum algorithms
      // - Bouncy Castle with quantum support

      logger.info('Quantum-resistant cryptography initialized', {
        migrationMode: this.config.migrationMode,
        targetAlgorithm: this.config.targetQuantumAlgorithm,
        fallbackAlgorithm: this.config.fallbackClassicalAlgorithm,
      });
    } catch (error) {
      logger.error('Failed to initialize quantum cryptography', error instanceof Error ? error : undefined);
      throw new Error(`Quantum crypto initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start migration process
   */
  private startMigrationProcess(): void {
    if (!this.config.enabled) {
      logger.info('Quantum migration disabled');
      return;
    }

    logger.info('Starting quantum-resistant migration process', {
      mode: this.config.migrationMode,
      deadline: this.config.migrationDeadline,
    });

    // Set initial migration phase
    this.updateMigrationPhase();

    // Start periodic migration tasks
    this.startMigrationTasks();
  }

  /**
   * Update migration phase based on configuration and timeline
   */
  private updateMigrationPhase(): void {
    const now = new Date();
    const timeToDeadline = this.config.migrationDeadline.getTime() - now.getTime();
    const totalMigrationTime = this.config.hybridModeDuration * 24 * 60 * 60 * 1000; // Convert days to ms

    if (this.config.migrationMode === 'disabled') {
      this.migrationState.phase = 'preparation';
    } else if (this.config.migrationMode === 'hybrid') {
      this.migrationState.phase = 'hybrid';
    } else if (this.config.migrationMode === 'quantum-only') {
      this.migrationState.phase = 'quantum-only';
    } else if (timeToDeadline > totalMigrationTime * 0.6) {
      this.migrationState.phase = 'preparation';
    } else if (timeToDeadline > totalMigrationTime * 0.3) {
      this.migrationState.phase = 'hybrid';
    } else if (timeToDeadline > 0) {
      this.migrationState.phase = 'transition';
    } else {
      this.migrationState.phase = 'quantum-only';
    }

    logger.info('Migration phase updated', {
      phase: this.migrationState.phase,
      timeToDeadline: Math.ceil(timeToDeadline / (24 * 60 * 60 * 1000)), // days
    });
  }

  /**
   * Start periodic migration tasks
   */
  private startMigrationTasks(): void {
    // Check migration phase every hour
    setInterval(() => {
      this.updateMigrationPhase();
    }, 60 * 60 * 1000);

    // Key rotation every 24 hours
    setInterval(() => {
      this.rotateKeys();
    }, 24 * 60 * 60 * 1000);

    // Migration progress update every 6 hours
    setInterval(() => {
      this.updateMigrationProgress();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Generate hybrid key pair (classical + quantum)
   */
  public async generateHybridKeyPair(): Promise<HybridKeyPair> {
    const startTime = Date.now();

    try {
      // Generate classical key pair
      const classicalKeyPair = await this.generateClassicalKeyPair(this.config.fallbackClassicalAlgorithm);

      // Generate quantum key pair
      const quantumKeyPair = await this.generateQuantumKeyPair(this.config.targetQuantumAlgorithm);

      const hybridKeyPair: HybridKeyPair = {
        classical: classicalKeyPair,
        quantum: quantumKeyPair,
        keyId: `hybrid-${Date.now()}-${randomBytes(8).toString('hex')}`,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.keyRotationInterval * 24 * 60 * 60 * 1000),
      };

      // Store the key pair
      this.keyStore.set(hybridKeyPair.keyId, hybridKeyPair);

      // Update metrics
      this.metrics.totalKeys++;
      this.metrics.hybridKeys++;
      this.metrics.quantumOperations++;
      this.updateAverageOperationTime(Date.now() - startTime);

      logger.info('Hybrid key pair generated', {
        keyId: hybridKeyPair.keyId,
        classicalAlgorithm: classicalKeyPair.algorithm,
        quantumAlgorithm: quantumKeyPair.algorithm,
      });

      return hybridKeyPair;
    } catch (error) {
      this.metrics.failedQuantumOperations++;
      logger.error('Failed to generate hybrid key pair', error instanceof Error ? error : undefined);
      throw new Error(`Hybrid key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate quantum-only key pair
   */
  public async generateQuantumKeyPair(algorithm?: QuantumAlgorithm): Promise<QuantumKeyPair> {
    const startTime = Date.now();
    const targetAlgorithm = algorithm || this.config.targetQuantumAlgorithm;

    try {
      const quantumKeyPair = await this.generateQuantumKeyPair(targetAlgorithm);

      // Store the key pair
      this.quantumKeys.set(quantumKeyPair.keyId, quantumKeyPair);

      // Update metrics
      this.metrics.totalKeys++;
      this.metrics.quantumKeys++;
      this.metrics.quantumOperations++;
      this.updateAverageOperationTime(Date.now() - startTime);

      logger.info('Quantum key pair generated', {
        keyId: quantumKeyPair.keyId,
        algorithm: quantumKeyPair.algorithm,
        securityLevel: quantumKeyPair.securityLevel,
      });

      return quantumKeyPair;
    } catch (error) {
      this.metrics.failedQuantumOperations++;
      logger.error('Failed to generate quantum key pair', error instanceof Error ? error : undefined);
      throw new Error(`Quantum key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate classical key pair (fallback)
   */
  private async generateClassicalKeyPair(algorithm: ClassicalAlgorithm): Promise<{
    algorithm: ClassicalAlgorithm;
    publicKey: string;
    privateKey: string;
  }> {
    // In production, use proper cryptographic libraries
    // For now, simulate with placeholder implementation

    switch (algorithm) {
      case 'ed25519':
        return this.generateEd25519KeyPair();
      case 'rsa-4096':
        return this.generateRSA4096KeyPair();
      case 'ecdsa-p384':
        return this.generateECDSAP384KeyPair();
      default:
        throw new Error(`Unsupported classical algorithm: ${algorithm}`);
    }
  }

  /**
   * Generate quantum key pair (actual implementation)
   */
  private async generateQuantumKeyPair(algorithm: QuantumAlgorithm): Promise<QuantumKeyPair> {
    // In production, use quantum-resistant cryptographic libraries
    // For now, simulate with placeholder implementation

    const securityLevel = this.getSecurityLevel(algorithm);

    // Simulate quantum key generation
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate computation time

    return {
      algorithm,
      publicKey: this.generateQuantumPublicKey(algorithm),
      privateKey: this.generateQuantumPrivateKey(algorithm),
      keyId: `quantum-${algorithm}-${Date.now()}-${randomBytes(8).toString('hex')}`,
      createdAt: new Date(),
      securityLevel,
    };
  }

  /**
   * Sign data with hybrid signature (quantum + classical)
   */
  public async signHybrid(
    data: string | object,
    keyId: string
  ): Promise<QuantumSignature> {
    const startTime = Date.now();

    try {
      const keyPair = this.keyStore.get(keyId);
      if (!keyPair) {
        throw new Error(`Hybrid key pair not found: ${keyId}`);
      }

      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const timestamp = Date.now();

      // Generate classical signature
      const classicalSignature = await this.signClassical(
        dataString,
        keyPair.classical.privateKey,
        keyPair.classical.algorithm
      );

      // Generate quantum signature
      const quantumSignature = await this.signQuantum(
        dataString,
        keyPair.quantum.privateKey,
        keyPair.quantum.algorithm
      );

      const signature: QuantumSignature = {
        quantumSignature,
        classicalSignature,
        algorithm: keyPair.quantum.algorithm,
        keyId,
        timestamp,
      };

      this.metrics.quantumOperations++;
      this.updateAverageOperationTime(Date.now() - startTime);

      return signature;
    } catch (error) {
      this.metrics.failedQuantumOperations++;
      logger.error('Failed to create hybrid signature', error instanceof Error ? error : undefined);
      throw new Error(`Hybrid signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify hybrid signature
   */
  public async verifyHybrid(
    data: string | object,
    signature: QuantumSignature,
    publicKeyId: string
  ): Promise<boolean> {
    try {
      const keyPair = this.keyStore.get(publicKeyId);
      if (!keyPair) {
        throw new Error(`Hybrid key pair not found: ${publicKeyId}`);
      }

      const dataString = typeof data === 'string' ? data : JSON.stringify(data);

      // Verify classical signature
      const classicalValid = await this.verifyClassical(
        dataString,
        signature.classicalSignature,
        keyPair.classical.publicKey,
        keyPair.classical.algorithm,
        signature.timestamp
      );

      // Verify quantum signature
      const quantumValid = await this.verifyQuantum(
        dataString,
        signature.quantumSignature,
        keyPair.quantum.publicKey,
        keyPair.quantum.algorithm,
        signature.timestamp
      );

      // Both signatures must be valid
      const isValid = classicalValid && quantumValid;

      logger.debug('Hybrid signature verification', {
        keyId: publicKeyId,
        classicalValid,
        quantumValid,
        overall: isValid,
      });

      return isValid;
    } catch (error) {
      logger.error('Failed to verify hybrid signature', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * Encrypt data with hybrid encryption
   */
  public async encryptHybrid(
    data: string | object,
    recipientKeyId: string
  ): Promise<HybridEncryption> {
    const startTime = Date.now();

    try {
      const recipientKey = this.keyStore.get(recipientKeyId);
      if (!recipientKey) {
        throw new Error(`Recipient key not found: ${recipientKeyId}`);
      }

      const dataString = typeof data === 'string' ? data : JSON.stringify(data);

      // Generate symmetric key for data encryption
      const symmetricKey = randomBytes(32); // 256-bit key
      const iv = randomBytes(16); // 128-bit IV

      // Encrypt data with symmetric key (AES-256-GCM)
      const cipher = createCipheriv('aes-256-gcm', symmetricKey, iv);
      let encrypted = cipher.update(dataString, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const tag = cipher.getAuthTag();

      // Encrypt symmetric key with classical public key
      const encryptedClassicalKey = await this.encryptAsymmetric(
        symmetricKey,
        recipientKey.classical.publicKey,
        recipientKey.classical.algorithm
      );

      // Encrypt symmetric key with quantum public key
      const encryptedQuantumKey = await this.encryptQuantum(
        symmetricKey,
        recipientKey.quantum.publicKey,
        recipientKey.quantum.algorithm
      );

      const encryption: HybridEncryption = {
        encryptedData: {
          classical: encrypted, // Same data, different protection levels
          quantum: encrypted,
        },
        symmetricKey: {
          encryptedClassical: encryptedClassicalKey,
          encryptedQuantum: encryptedQuantumKey,
        },
        algorithm: {
          classical: recipientKey.classical.algorithm,
          quantum: recipientKey.quantum.algorithm,
          symmetric: 'aes-256-gcm',
        },
        metadata: {
          iv: iv.toString('base64'),
          tag: tag.toString('base64'),
          nonce: randomBytes(16).toString('base64'),
        },
      };

      this.metrics.quantumOperations++;
      this.updateAverageOperationTime(Date.now() - startTime);

      return encryption;
    } catch (error) {
      this.metrics.failedQuantumOperations++;
      logger.error('Failed to encrypt with hybrid scheme', error instanceof Error ? error : undefined);
      throw new Error(`Hybrid encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt hybrid encrypted data
   */
  public async decryptHybrid(
    encryption: HybridEncryption,
    recipientKeyId: string
  ): Promise<string | object> {
    try {
      const recipientKey = this.keyStore.get(recipientKeyId);
      if (!recipientKey) {
        throw new Error(`Recipient key not found: ${recipientKeyId}`);
      }

      // Try quantum decryption first
      let symmetricKey: Buffer;
      try {
        symmetricKey = await this.decryptQuantum(
          encryption.symmetricKey.encryptedQuantum,
          recipientKey.quantum.privateKey,
          recipientKey.quantum.algorithm
        );
      } catch (quantumError) {
        logger.warn('Quantum decryption failed, trying classical fallback', {
          keyId: recipientKeyId,
          error: quantumError instanceof Error ? quantumError.message : 'Unknown error',
        });

        // Fallback to classical decryption
        symmetricKey = await this.decryptAsymmetric(
          encryption.symmetricKey.encryptedClassical,
          recipientKey.classical.privateKey,
          recipientKey.classical.algorithm
        );
      }

      // Decrypt data with symmetric key
      const iv = Buffer.from(encryption.metadata.iv, 'base64');
      const tag = Buffer.from(encryption.metadata.tag, 'base64');

      const decipher = createDecipheriv('aes-256-gcm', symmetricKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryption.encryptedData.quantum, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      logger.error('Failed to decrypt hybrid data', error instanceof Error ? error : undefined);
      throw new Error(`Hybrid decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get security level for quantum algorithm
   */
  private getSecurityLevel(algorithm: QuantumAlgorithm): 128 | 192 | 256 {
    switch (algorithm) {
      case 'kyber-1024':
      case 'dilithium-5':
      case 'falcon-1024':
        return 256;
      case 'ntru-hps-2048-509':
      case 'hqc-256':
        return 192;
      case 'sphincs-shake-256':
        return 256;
      default:
        return 128;
    }
  }

  /**
   * Placeholder implementations for quantum operations
   * In production, these would use actual quantum-resistant libraries
   */

  private generateQuantumPublicKey(algorithm: QuantumAlgorithm): string {
    // Simulate quantum public key generation
    return `quantum-pub-${algorithm}-${randomBytes(64).toString('hex')}`;
  }

  private generateQuantumPrivateKey(algorithm: QuantumAlgorithm): string {
    // Simulate quantum private key generation
    return `quantum-priv-${algorithm}-${randomBytes(128).toString('hex')}`;
  }

  private async signQuantum(
    data: string,
    privateKey: string,
    algorithm: QuantumAlgorithm
  ): Promise<string> {
    // Simulate quantum signing
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate computation
    return `quantum-sig-${algorithm}-${createHash('sha256').update(data + privateKey).digest('hex')}`;
  }

  private async verifyQuantum(
    data: string,
    signature: string,
    publicKey: string,
    algorithm: QuantumAlgorithm,
    timestamp: number
  ): Promise<boolean> {
    // Simulate quantum verification
    await new Promise(resolve => setTimeout(resolve, 25)); // Simulate computation
    const expectedSignature = `quantum-sig-${algorithm}-${createHash('sha256').update(data + publicKey).digest('hex')}`;
    return signature === expectedSignature;
  }

  private async encryptQuantum(
    data: Buffer,
    publicKey: string,
    algorithm: QuantumAlgorithm
  ): Promise<string> {
    // Simulate quantum encryption
    await new Promise(resolve => setTimeout(resolve, 75)); // Simulate computation
    return `quantum-enc-${algorithm}-${data.toString('base64')}-${publicKey}`;
  }

  private async decryptQuantum(
    encryptedData: string,
    privateKey: string,
    algorithm: QuantumAlgorithm
  ): Promise<Buffer> {
    // Simulate quantum decryption
    await new Promise(resolve => setTimeout(resolve, 75)); // Simulate computation

    // Extract data from simulated encryption
    const parts = encryptedData.split('-');
    if (parts.length < 4 || parts[0] !== 'quantum-enc' || parts[1] !== algorithm) {
      throw new Error('Invalid quantum encrypted data format');
    }

    return Buffer.from(parts[2], 'base64');
  }

  /**
   * Classical cryptographic operations (fallback)
   */

  private async generateEd25519KeyPair(): Promise<{
    algorithm: ClassicalAlgorithm;
    publicKey: string;
    privateKey: string;
  }> {
    // Use existing Ed25519 implementation
    const { generateEd25519KeyPair } = await import('../crypto/CryptoUtils');
    const keyPair = generateEd25519KeyPair();

    return {
      algorithm: 'ed25519',
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };
  }

  private async generateRSA4096KeyPair(): Promise<{
    algorithm: ClassicalAlgorithm;
    publicKey: string;
    privateKey: string;
  }> {
    // Simulate RSA-4096 key generation
    return {
      algorithm: 'rsa-4096',
      publicKey: `rsa-pub-${randomBytes(256).toString('hex')}`,
      privateKey: `rsa-priv-${randomBytes(256).toString('hex')}`,
    };
  }

  private async generateECDSAP384KeyPair(): Promise<{
    algorithm: ClassicalAlgorithm;
    publicKey: string;
    privateKey: string;
  }> {
    // Simulate ECDSA-P384 key generation
    return {
      algorithm: 'ecdsa-p384',
      publicKey: `ecdsa-pub-${randomBytes(96).toString('hex')}`,
      privateKey: `ecdsa-priv-${randomBytes(96).toString('hex')}`,
    };
  }

  private async signClassical(
    data: string,
    privateKey: string,
    algorithm: ClassicalAlgorithm
  ): Promise<string> {
    // Use existing signing implementation
    const { signMessageEd25519 } = await import('../crypto/CryptoUtils');

    if (algorithm === 'ed25519') {
      const result = signMessageEd25519(data, privateKey);
      return result.signature;
    }

    // Fallback for other algorithms
    return `classical-sig-${algorithm}-${createHash('sha256').update(data + privateKey).digest('hex')}`;
  }

  private async verifyClassical(
    data: string,
    signature: string,
    publicKey: string,
    algorithm: ClassicalAlgorithm,
    timestamp: number
  ): Promise<boolean> {
    // Use existing verification implementation
    const { verifySignatureEd25519 } = await import('../crypto/CryptoUtils');

    if (algorithm === 'ed25519') {
      return verifySignatureEd25519(data, signature, timestamp, publicKey);
    }

    // Fallback for other algorithms
    const expectedSignature = `classical-sig-${algorithm}-${createHash('sha256').update(data + publicKey).digest('hex')}`;
    return signature === expectedSignature;
  }

  private async encryptAsymmetric(
    data: Buffer,
    publicKey: string,
    algorithm: ClassicalAlgorithm
  ): Promise<string> {
    // Simulate asymmetric encryption
    return `classical-enc-${algorithm}-${data.toString('base64')}-${publicKey}`;
  }

  private async decryptAsymmetric(
    encryptedData: string,
    privateKey: string,
    algorithm: ClassicalAlgorithm
  ): Promise<Buffer> {
    // Extract data from simulated encryption
    const parts = encryptedData.split('-');
    if (parts.length < 4 || parts[0] !== 'classical-enc' || parts[1] !== algorithm) {
      throw new Error('Invalid classical encrypted data format');
    }

    return Buffer.from(parts[2], 'base64');
  }

  /**
   * Update average operation time
   */
  private updateAverageOperationTime(operationTime: number): void {
    const current = this.metrics.averageQuantumOperationTime;
    const count = this.metrics.quantumOperations;
    this.metrics.averageQuantumOperationTime = (current * (count - 1) + operationTime) / count;
  }

  /**
   * Rotate keys according to migration policy
   */
  private rotateKeys(): void {
    const now = new Date();
    let rotatedCount = 0;

    // Rotate hybrid keys
    for (const [keyId, keyPair] of this.keyStore) {
      if (keyPair.expiresAt && keyPair.expiresAt < now) {
        this.keyStore.delete(keyId);
        rotatedCount++;
      }
    }

    // Rotate quantum keys
    for (const [keyId, keyPair] of this.quantumKeys) {
      if (keyPair.expiresAt && keyPair.expiresAt < now) {
        this.quantumKeys.delete(keyId);
        rotatedCount++;
      }
    }

    if (rotatedCount > 0) {
      logger.info('Keys rotated', {
        rotatedCount,
        remainingHybridKeys: this.keyStore.size,
        remainingQuantumKeys: this.quantumKeys.size,
      });
    }
  }

  /**
   * Update migration progress
   */
  private updateMigrationProgress(): void {
    const totalKeys = this.metrics.totalKeys;
    const quantumKeys = this.metrics.quantumKeys + this.metrics.hybridKeys;

    this.metrics.migrationProgress = totalKeys > 0 ? (quantumKeys / totalKeys) * 100 : 0;

    logger.info('Migration progress updated', {
      phase: this.migrationState.phase,
      progress: this.metrics.migrationProgress.toFixed(2) + '%',
      totalKeys,
      quantumKeys,
      hybridKeys: this.metrics.hybridKeys,
      classicalKeys: this.metrics.classicalKeys,
    });
  }

  /**
   * Get quantum security metrics
   */
  public getMetrics(): QuantumSecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get migration status
   */
  public getMigrationStatus(): any {
    return {
      ...this.migrationState,
      config: this.config,
      timeToDeadline: Math.max(0, this.config.migrationDeadline.getTime() - Date.now()),
    };
  }

  /**
   * Check if quantum-safe operations are required
   */
  public requiresQuantumSafe(): boolean {
    return this.config.migrationMode !== 'disabled' &&
           (this.migrationState.phase === 'transition' || this.migrationState.phase === 'quantum-only');
  }

  /**
   * Get recommended algorithm for new operations
   */
  public getRecommendedAlgorithm(): 'classical' | 'hybrid' | 'quantum' {
    switch (this.migrationState.phase) {
      case 'preparation':
        return 'classical';
      case 'hybrid':
        return 'hybrid';
      case 'transition':
        return Math.random() < 0.7 ? 'hybrid' : 'quantum'; // 70% hybrid, 30% quantum
      case 'quantum-only':
      case 'complete':
        return 'quantum';
      default:
        return 'classical';
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getQuantumResistantCrypto(config: MigrationConfig): QuantumResistantCryptoManager {
  return QuantumResistantCryptoManager.getInstance(config);
}

export default {
  QuantumResistantCryptoManager,
  getQuantumResistantCrypto,
};
