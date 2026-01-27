/**
 * Backend type barrel.
 *
 * Policy:
 * - This file must ONLY re-export from real implementations that exist.
 * - Do NOT define placeholder types here.
 * - If a symbol doesn't exist yet, fix the source module—not this barrel.
 */

// --- SDUI / Canvas ---
export type { UIComponent as CanvasComponent } from "./sdui-integration";

// Add more exports below if/when those types exist and are needed.
