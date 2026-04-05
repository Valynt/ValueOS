import { loadAgentFabricConfig } from "../../config/agentFabric.js";
import { validateLLMConfig } from "../../config/validateEnv.js";
import type { LLMGatewayConfig } from "../../lib/agent-fabric/LLMGateway.js";

export function getBackHalfLLMGatewayConfig(): Pick<
  LLMGatewayConfig,
  "provider" | "model"
> {
  const llmValidation = validateLLMConfig();
  if (!llmValidation.valid) {
    throw new Error(
      `Invalid LLM configuration for back-half routes: ${llmValidation.errors.join(
        ", "
      )}`
    );
  }

  const provider = llmValidation.provider;
  if (provider !== "together") {
    throw new Error(
      `Unsupported LLM provider for back-half routes: ${provider}`
    );
  }

  const agentFabricConfig = loadAgentFabricConfig();
  const model = agentFabricConfig.llmGateway.defaultModel;
  if (!model) {
    throw new Error(
      "Missing llmGateway.defaultModel in agent fabric configuration"
    );
  }

  return { provider, model };
}
