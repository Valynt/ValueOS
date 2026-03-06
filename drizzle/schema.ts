import { bigint, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * User preferences stored as JSON in the users table.
 */
export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  emailNotifications?: boolean;
  agentNotifications?: boolean;
  weeklyDigest?: boolean;
}

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** User's chosen display name (defaults to OAuth name) */
  displayName: varchar("displayName", { length: 255 }),
  /** URL to user's avatar image stored in S3 */
  avatarUrl: text("avatarUrl"),
  /** Short bio or job title */
  bio: varchar("bio", { length: 500 }),
  /** User's company or organization name */
  company: varchar("company", { length: 255 }),
  /** User's job title */
  jobTitle: varchar("jobTitle", { length: 255 }),
  /** IANA timezone identifier (e.g. America/New_York) */
  timezone: varchar("timezone", { length: 64 }).default("UTC"),
  /** User preferences stored as JSON (theme, notifications, etc.) */
  preferences: json("preferences").$type<UserPreferences>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Enrichment Cache ────────────────────────────────────────────────────────

/**
 * Caches enrichment API results to reduce redundant external API calls.
 * Each row stores the full enrichment response for a normalized company name.
 * TTL is enforced at query time — rows older than the configured TTL are treated as stale.
 */
export const enrichmentCache = mysqlTable("enrichment_cache", {
  id: int("id").autoincrement().primaryKey(),
  /** Normalized company name (lowercase, trimmed) used as the cache key */
  companyKey: varchar("companyKey", { length: 255 }).notNull().unique(),
  /** Original company name as entered by the user */
  companyName: varchar("companyName", { length: 255 }).notNull(),
  /** Full enrichment response stored as JSON */
  data: json("data").notNull(),
  /** Number of successful sources in this cached result */
  sourcesSucceeded: int("sourcesSucceeded").notNull().default(0),
  /** Confidence score (0-100) of the cached result */
  confidence: int("confidence").notNull().default(0),
  /** Total latency of the original enrichment call in milliseconds */
  totalLatencyMs: int("totalLatencyMs").notNull().default(0),
  /** How many times this cache entry has been served */
  hitCount: int("hitCount").notNull().default(0),
  /** When this cache entry was created */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** When this cache entry was last refreshed */
  refreshedAt: timestamp("refreshedAt").defaultNow().notNull(),
  /** When this cache entry was last served (hit) */
  lastHitAt: timestamp("lastHitAt"),
});

export type EnrichmentCacheRow = typeof enrichmentCache.$inferSelect;
export type InsertEnrichmentCache = typeof enrichmentCache.$inferInsert;

// ── Conversations ──────────────────────────────────────────────────────────

/**
 * Stores agent chat conversations. Each conversation belongs to a user
 * and is associated with a specific agent.
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  /** Owner of this conversation */
  userId: int("userId").notNull(),
  /** Agent slug (e.g. 'architect', 'research', 'integrity') */
  agentSlug: varchar("agentSlug", { length: 64 }).notNull(),
  /** Human-readable title (auto-generated from first message) */
  title: varchar("title", { length: 255 }),
  /** Whether this conversation is pinned/starred */
  pinned: int("pinned").notNull().default(0),
  /** Soft delete flag */
  deleted: int("deleted").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Individual messages within a conversation.
 * Stores both user and assistant messages with optional tool metadata.
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  /** Parent conversation */
  conversationId: int("conversationId").notNull(),
  /** 'user' or 'assistant' */
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  /** Message text content */
  content: text("content").notNull(),
  /** Agent slug for assistant messages */
  agentSlug: varchar("agentSlug", { length: 64 }),
  /** Agent display name for assistant messages */
  agentName: varchar("agentName", { length: 128 }),
  /** Tool events JSON array (tool calls, results, statuses) */
  toolEvents: json("toolEvents"),
  /** Chain summary JSON (total rounds, latency, etc.) */
  chainSummary: json("chainSummary"),
  /** Message timestamp (UTC ms since epoch) */
  messageTimestamp: bigint("messageTimestamp", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;