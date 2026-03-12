import { describe, expect, it } from "vitest";

import { messagingModeMatrix } from "./infra-mode.matrix";
import { allMessagingModes, runInMessagingMode } from "./runInInfraMode";

describe("messaging-mode matrix — pilot coverage", () => {
  it("exports exactly 4 combinations", () => {
    expect(messagingModeMatrix).toHaveLength(4);
  });

  it("covers all four kafka × streaming combinations", () => {
    const ids = messagingModeMatrix.map((m) => m.id);
    expect(ids).toContain("kafka-on-stream-on");
    expect(ids).toContain("kafka-on-stream-off");
    expect(ids).toContain("kafka-off-stream-on");
    expect(ids).toContain("kafka-off-stream-off");
  });

  it("each entry carries correct env vars", () => {
    for (const mode of messagingModeMatrix) {
      const expectedKafka = mode.kafkaEnabled ? "true" : "false";
      const expectedStreaming = mode.streamingEnabled ? "true" : "false";
      expect(mode.env["KAFKA_ENABLED"]).toBe(expectedKafka);
      expect(mode.env["STREAMING_ENABLED"]).toBe(expectedStreaming);
    }
  });

  it("allMessagingModes() returns all 4 entries", () => {
    expect(allMessagingModes()).toHaveLength(4);
  });

  it("runInMessagingMode sets env vars for the duration of the callback", async () => {
    const kafkaOffMode = messagingModeMatrix.find((m) => m.id === "kafka-off-stream-off")!;

    // Capture env state inside the callback.
    let kafkaInsideCallback: string | undefined;
    let streamingInsideCallback: string | undefined;

    await runInMessagingMode(kafkaOffMode, async (ctx) => {
      kafkaInsideCallback = process.env["KAFKA_ENABLED"];
      streamingInsideCallback = process.env["STREAMING_ENABLED"];
      expect(ctx.kafkaEnabled).toBe(false);
      expect(ctx.streamingEnabled).toBe(false);
    });

    expect(kafkaInsideCallback).toBe("false");
    expect(streamingInsideCallback).toBe("false");

    // Env must be restored after the callback.
    expect(process.env["KAFKA_ENABLED"]).not.toBe("false");
  });

  it("runInMessagingMode restores env after callback throws", async () => {
    const mode = messagingModeMatrix.find((m) => m.id === "kafka-on-stream-on")!;
    const before = process.env["KAFKA_ENABLED"];

    await expect(
      runInMessagingMode(mode, async () => {
        throw new Error("intentional failure");
      }),
    ).rejects.toThrow("intentional failure");

    expect(process.env["KAFKA_ENABLED"]).toBe(before);
  });
});
