/**
 * Conversation Router — tRPC procedures for chat persistence.
 *
 * Provides CRUD operations for conversations and messages,
 * enabling the frontend to save/restore agent chat history.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  getMessages,
  insertMessage,
  insertMessages,
} from "../db";

const toolEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.string().optional(),
  result: z.string().optional(),
  round: z.number(),
  status: z.enum(["success", "error", "timeout", "executing"]).optional(),
  latencyMs: z.number().optional(),
});

const chainSummarySchema = z.object({
  totalRounds: z.number(),
  totalToolCalls: z.number(),
  successCount: z.number(),
  errorCount: z.number(),
  totalLatencyMs: z.number(),
  limitReached: z.boolean().optional(),
  chain: z.array(
    z.object({
      round: z.number(),
      tool: z.string(),
      status: z.enum(["success", "error", "timeout"]),
      latencyMs: z.number(),
    })
  ),
});

const messageInputSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  agentSlug: z.string().optional(),
  agentName: z.string().optional(),
  toolEvents: z.array(toolEventSchema).optional(),
  chainSummary: chainSummarySchema.optional(),
  messageTimestamp: z.number(),
});

export const conversationRouter = router({
  /**
   * List all conversations for the current user.
   */
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      return listConversations(ctx.user.id, input?.limit ?? 50);
    }),

  /**
   * Get a single conversation with its messages.
   */
  get: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const conversation = await getConversation(input.conversationId, ctx.user.id);
      if (!conversation) return null;

      const msgs = await getMessages(input.conversationId);
      return { conversation, messages: msgs };
    }),

  /**
   * Create a new conversation (called when user sends first message to an agent).
   */
  create: protectedProcedure
    .input(
      z.object({
        agentSlug: z.string(),
        title: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createConversation({
        userId: ctx.user.id,
        agentSlug: input.agentSlug,
        title: input.title ?? null,
        pinned: 0,
        deleted: 0,
      });
      return { id };
    }),

  /**
   * Update conversation metadata (title, pinned status).
   */
  update: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        title: z.string().max(255).optional(),
        pinned: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateConversation(input.conversationId, ctx.user.id, {
        title: input.title,
        pinned: input.pinned !== undefined ? (input.pinned ? 1 : 0) : undefined,
      });
      return { success: true };
    }),

  /**
   * Soft-delete a conversation.
   */
  delete: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteConversation(input.conversationId, ctx.user.id);
      return { success: true };
    }),

  /**
   * Save a single message to a conversation.
   * Used for persisting each message as it's sent/received.
   */
  saveMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        message: messageInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const conv = await getConversation(input.conversationId, ctx.user.id);
      if (!conv) throw new Error("Conversation not found");

      const id = await insertMessage({
        conversationId: input.conversationId,
        role: input.message.role,
        content: input.message.content,
        agentSlug: input.message.agentSlug ?? null,
        agentName: input.message.agentName ?? null,
        toolEvents: input.message.toolEvents ?? null,
        chainSummary: input.message.chainSummary ?? null,
        messageTimestamp: input.message.messageTimestamp,
      });
      return { id };
    }),

  /**
   * Batch-save multiple messages to a conversation.
   * Used for saving the full conversation when the sidebar closes.
   */
  saveMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        messages: z.array(messageInputSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const conv = await getConversation(input.conversationId, ctx.user.id);
      if (!conv) throw new Error("Conversation not found");

      await insertMessages(
        input.messages.map((m) => ({
          conversationId: input.conversationId,
          role: m.role,
          content: m.content,
          agentSlug: m.agentSlug ?? null,
          agentName: m.agentName ?? null,
          toolEvents: m.toolEvents ?? null,
          chainSummary: m.chainSummary ?? null,
          messageTimestamp: m.messageTimestamp,
        }))
      );
      return { success: true };
    }),
});
