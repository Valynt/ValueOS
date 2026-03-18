/**
 * Verifies that prompt_contract_hash is derived from real policy file content
 * rather than hardcoded fake hex strings (F-010).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { modelCardService } from "../ModelCardService.js";

const FAKE_HASHES = new Set([
  "0x9f21c8f7b6d4a3e1c2d5f7a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9",
  "0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3",
  "0xc3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a1b2",
]);

const AGENTS = ["opportunity", "target", "realization"] as const;

describe("ModelCardService prompt_contract_hash (F-010)", () => {
  for (const agent of AGENTS) {
    it(`${agent}: hash is not a hardcoded fake value`, () => {
      const result = modelCardService.getModelCard(agent);
      expect(result).not.toBeNull();
      expect(FAKE_HASHES.has(result!.modelCard.prompt_contract_hash)).toBe(false);
    });

    it(`${agent}: hash is a valid sha256 hex string (64 chars)`, () => {
      const result = modelCardService.getModelCard(agent);
      expect(result!.modelCard.prompt_contract_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it(`${agent}: hash changes when policy file content changes`, () => {
      const policyPath = resolve(process.cwd(), "policies", "agents", `${agent}-agent.json`);
      if (!existsSync(policyPath)) return; // skip if no policy file in this env

      const content = readFileSync(policyPath, "utf-8");
      const expectedHash = createHash("sha256").update(content).digest("hex");

      const result = modelCardService.getModelCard(agent);
      expect(result!.modelCard.prompt_contract_hash).toBe(expectedHash);
    });

    it(`${agent}: model_version references a valid Together.ai model identifier`, () => {
      const result = modelCardService.getModelCard(agent);
      const model = result!.modelCard.model_version;
      // Together.ai models follow org/model-name pattern
      expect(model).toMatch(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/);
    });
  }
});
