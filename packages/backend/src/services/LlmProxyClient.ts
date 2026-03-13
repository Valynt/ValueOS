// Re-export shim — ValueFabricService imports "./LlmProxyClient.js" which resolves here.
// The canonical implementation is at ./llm/LlmProxyClient.ts.
export { llmProxyClient } from "./llm/LlmProxyClient.js";
