import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildFailurePacket } from "./build-failure-packet";

describe("buildFailurePacket", () => {
  it("builds a packet with hashed outputs", () => {
    const root = mkdtempSync(join(tmpdir(), "failure-packet-"));
    const outputPath = join(root, "stderr.log");
    writeFileSync(outputPath, "error: tenant isolation failed\n");

    const packet = buildFailurePacket({
      suite: "wf-1",
      command: "pnpm vitest run tests/wf-1.test.ts",
      outputPaths: [outputPath],
    });

    expect(packet.suite).toBe("wf-1");
    expect(packet.outputs).toHaveLength(1);
    expect(packet.outputs[0]?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.packet_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.namespace).toContain("infra-wf-1-failure-packet");
  });
});
