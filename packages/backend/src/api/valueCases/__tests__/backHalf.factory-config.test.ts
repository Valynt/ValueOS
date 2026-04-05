import { describe, expect, it } from "vitest";

import { validateLLMConfig } from "../../../config/validateEnv.js";
import { getBackHalfLLMGatewayConfig } from "../backHalfFactoryConfig.js";

describe("backHalf route factory LLM config", () => {
  it("uses the configured LLM provider for route factories", () => {
    const configuredProvider = validateLLMConfig().provider;
    const routeFactoryConfig = getBackHalfLLMGatewayConfig();

    expect(routeFactoryConfig.provider).toBe(configuredProvider);
  });
});
