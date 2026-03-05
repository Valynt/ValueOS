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