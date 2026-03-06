import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  InsertUser,
  users,
  conversations,
  messages,
  type InsertConversation,
  type InsertMessage,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Profile Queries ──────────────────────────────────────────────────────────

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      company: users.company,
      jobTitle: users.jobTitle,
      timezone: users.timezone,
      preferences: users.preferences,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateProfile(
  userId: number,
  data: {
    displayName?: string | null;
    bio?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    timezone?: string;
    avatarUrl?: string | null;
    preferences?: import("../drizzle/schema").UserPreferences;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {};

  if (data.displayName !== undefined) updateSet.displayName = data.displayName;
  if (data.bio !== undefined) updateSet.bio = data.bio;
  if (data.company !== undefined) updateSet.company = data.company;
  if (data.jobTitle !== undefined) updateSet.jobTitle = data.jobTitle;
  if (data.timezone !== undefined) updateSet.timezone = data.timezone;
  if (data.avatarUrl !== undefined) updateSet.avatarUrl = data.avatarUrl;
  if (data.preferences !== undefined) updateSet.preferences = data.preferences;

  if (Object.keys(updateSet).length === 0) return;

  await db.update(users).set(updateSet).where(eq(users.id, userId));
}

// ── Conversation Queries ────────────────────────────────────────────────────

/**
 * List conversations for a user, ordered by most recently updated.
 * Excludes soft-deleted conversations.
 */
export async function listConversations(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.deleted, 0)
      )
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

/**
 * Get a single conversation by ID, verifying ownership.
 */
export async function getConversation(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
        eq(conversations.deleted, 0)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create a new conversation and return its ID.
 */
export async function createConversation(
  data: Omit<InsertConversation, "id" | "createdAt" | "updatedAt">
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(conversations).values(data).$returningId();
  return result.id;
}

/**
 * Update conversation metadata (title, pinned).
 */
export async function updateConversation(
  conversationId: number,
  userId: number,
  data: { title?: string; pinned?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {};
  if (data.title !== undefined) updateSet.title = data.title;
  if (data.pinned !== undefined) updateSet.pinned = data.pinned;
  if (Object.keys(updateSet).length === 0) return;

  await db
    .update(conversations)
    .set(updateSet)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    );
}

/**
 * Soft-delete a conversation.
 */
export async function deleteConversation(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(conversations)
    .set({ deleted: 1 })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    );
}

// ── Message Queries ─────────────────────────────────────────────────────────

/**
 * Get all messages for a conversation, ordered chronologically.
 */
export async function getMessages(conversationId: number, limit = 200) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.messageTimestamp)
    .limit(limit);
}

/**
 * Insert a single message into a conversation.
 * Also touches the conversation's updatedAt.
 */
export async function insertMessage(
  data: Omit<InsertMessage, "id" | "createdAt">
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(messages).values(data).$returningId();

  // Touch conversation updatedAt
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, data.conversationId));

  return result.id;
}

/**
 * Insert multiple messages in a batch (used for saving full conversation).
 */
export async function insertMessages(
  msgs: Omit<InsertMessage, "id" | "createdAt">[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (msgs.length === 0) return;

  await db.insert(messages).values(msgs);

  // Touch conversation updatedAt
  const convId = msgs[0].conversationId;
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, convId));
}
