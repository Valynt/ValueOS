import { Kafka, CompressionTypes, logLevel } from "kafkajs";

describe("Simple Kafka Test", () => {
  it("should import kafka classes", () => {
    expect(Kafka).toBeDefined();
    expect(CompressionTypes).toBeDefined();
    expect(logLevel).toBeDefined();
  });
});
