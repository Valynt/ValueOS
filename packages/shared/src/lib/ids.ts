/**
 * ID Generation Utilities
 *
 * Centralized ID generation with type-safe prefixes.
 * Provides consistent, collision-resistant identifiers across all packages.
 *
 * @example
 * const userId = ids.user();        // "usr_V1StGXR8_Z5jdHi6B-myT"
 * const taskId = ids.task();        // "tsk_1HGVzYLjR9cM2sKlEqPn4"
 * const customId = ids.prefixed('custom'); // "custom_abc123..."
 */

/**
 * Alphabet for nanoid-style generation (URL-safe)
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
const DEFAULT_LENGTH = 21;

/**
 * Generate a random string of specified length
 * Uses crypto.getRandomValues for secure randomness
 */
function nanoid(length: number = DEFAULT_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[bytes[i]! & 63];
  }
  return id;
}

/**
 * ID prefix types for type-safe IDs
 */
export type IdPrefix =
  | 'usr'   // User
  | 'ten'   // Tenant
  | 'agt'   // Agent
  | 'tsk'   // Task
  | 'mem'   // Memory
  | 'ses'   // Session
  | 'msg'   // Message
  | 'evt'   // Event
  | 'tok'   // Token
  | 'key'   // API Key
  | 'wf'    // Workflow
  | 'job'   // Job
  | 'req';  // Request

/**
 * Branded type for prefixed IDs
 */
export type PrefixedId<P extends string> = `${P}_${string}`;

/**
 * Specific ID types for domain entities
 */
export type UserId = PrefixedId<'usr'>;
export type TenantId = PrefixedId<'ten'>;
export type AgentId = PrefixedId<'agt'>;
export type TaskId = PrefixedId<'tsk'>;
export type MemoryId = PrefixedId<'mem'>;
export type SessionId = PrefixedId<'ses'>;
export type MessageId = PrefixedId<'msg'>;
export type EventId = PrefixedId<'evt'>;
export type TokenId = PrefixedId<'tok'>;
export type ApiKeyId = PrefixedId<'key'>;
export type WorkflowId = PrefixedId<'wf'>;
export type JobId = PrefixedId<'job'>;
export type RequestId = PrefixedId<'req'>;

/**
 * ID generation utilities
 */
export const ids = {
  /**
   * Generate a UUID v4
   */
  uuid(): string {
    return crypto.randomUUID();
  },

  /**
   * Generate a nanoid (URL-safe, collision-resistant)
   */
  nanoid(length: number = DEFAULT_LENGTH): string {
    return nanoid(length);
  },

  /**
   * Generate a prefixed ID
   */
  prefixed<P extends string>(prefix: P, length: number = DEFAULT_LENGTH): PrefixedId<P> {
    return `${prefix}_${nanoid(length)}` as PrefixedId<P>;
  },

  /**
   * Domain-specific ID generators
   */
  user(): UserId {
    return ids.prefixed('usr');
  },

  tenant(): TenantId {
    return ids.prefixed('ten');
  },

  agent(): AgentId {
    return ids.prefixed('agt');
  },

  task(): TaskId {
    return ids.prefixed('tsk');
  },

  memory(): MemoryId {
    return ids.prefixed('mem');
  },

  session(): SessionId {
    return ids.prefixed('ses');
  },

  message(): MessageId {
    return ids.prefixed('msg');
  },

  event(): EventId {
    return ids.prefixed('evt');
  },

  token(): TokenId {
    return ids.prefixed('tok');
  },

  apiKey(): ApiKeyId {
    return ids.prefixed('key');
  },

  workflow(): WorkflowId {
    return ids.prefixed('wf');
  },

  job(): JobId {
    return ids.prefixed('job');
  },

  request(): RequestId {
    return ids.prefixed('req');
  },
};

/**
 * Parse a prefixed ID to extract prefix and value
 */
export function parseId<P extends string>(
  id: PrefixedId<P>
): { prefix: P; value: string } | null {
  const match = id.match(/^([a-z]+)_(.+)$/) as [string, P, string] | null;
  if (!match) return null;
  return { prefix: match[1] as P, value: match[2] };
}

/**
 * Validate that a string is a valid prefixed ID with expected prefix
 */
export function isValidId<P extends string>(
  id: string,
  expectedPrefix: P
): id is PrefixedId<P> {
  return id.startsWith(`${expectedPrefix}_`) && id.length > expectedPrefix.length + 1;
}

/**
 * Type guards for specific ID types
 */
export const isUserId = (id: string): id is UserId => isValidId(id, 'usr');
export const isTenantId = (id: string): id is TenantId => isValidId(id, 'ten');
export const isAgentId = (id: string): id is AgentId => isValidId(id, 'agt');
export const isTaskId = (id: string): id is TaskId => isValidId(id, 'tsk');
export const isMemoryId = (id: string): id is MemoryId => isValidId(id, 'mem');
export const isSessionId = (id: string): id is SessionId => isValidId(id, 'ses');
