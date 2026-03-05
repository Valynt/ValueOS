/**
 * Together.ai Client
 *
 * Thin wrapper around the OpenAI SDK configured for Together.ai's
 * OpenAI-compatible API. All ValueOS agents use this single client
 * instance for LLM inference.
 *
 * Together.ai docs: https://docs.together.ai/docs/openai-api-compatibility
 */

import OpenAI from "openai";

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY ?? "";

if (!TOGETHER_API_KEY && process.env.NODE_ENV !== "test") {
  console.warn(
    "[Together.ai] TOGETHER_API_KEY is not set. Agent chat will not function."
  );
}

/**
 * Shared OpenAI-compatible client pointing at Together.ai.
 * Reuse this across all server-side agent code.
 */
export const together = new OpenAI({
  apiKey: TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

/**
 * Model registry — maps logical agent roles to Together.ai model IDs.
 * Change models here without touching any agent code.
 */
export const MODELS = {
  /** Fast general-purpose chat — Value Architect sidebar */
  chat: "meta-llama/Llama-3.3-70B-Instruct-Turbo",

  /** Tool-calling agent — Opportunity Agent, Target Agent, Orchestrator */
  toolCalling: "Qwen/Qwen2.5-72B-Instruct-Turbo",

  /** Deep reasoning — Integrity Agent, Research Agent */
  reasoning: "deepseek-ai/DeepSeek-R1",

  /** Multimodal (vision + text) — Research Agent for document analysis */
  vision: "meta-llama/Llama-4-Scout-17B-16E-Instruct",

  /** Fast lightweight — suggestions, autocomplete, classification */
  fast: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
} as const;

export type ModelRole = keyof typeof MODELS;
