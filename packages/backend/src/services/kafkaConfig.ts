import fs from "node:fs";

import { KafkaConfig, SASLOptions } from "kafkajs";

function readOptionalFile(path?: string): Buffer | undefined {
  if (!path) return undefined;
  return fs.readFileSync(path);
}

export function isKafkaEnabled(): boolean {
  return process.env.KAFKA_ENABLED === "true" || process.env.EVENT_EXECUTOR_ENABLED === "true";
}

export function buildKafkaClientConfig(base: Pick<KafkaConfig, "clientId" | "brokers">): KafkaConfig {
  const sslEnabled =
    process.env.KAFKA_SSL_ENABLED === "true" ||
    process.env.KAFKA_SECURITY_PROTOCOL === "SSL" ||
    process.env.KAFKA_SECURITY_PROTOCOL === "SASL_SSL";

  const mechanism = process.env.KAFKA_SASL_MECHANISM as SASLOptions["mechanism"] | undefined;
  const username = process.env.KAFKA_SASL_USERNAME;
  const password = process.env.KAFKA_SASL_PASSWORD;

  const sasl = mechanism && username && password ? { mechanism, username, password } : undefined;

  const ca = readOptionalFile(process.env.KAFKA_SSL_CA_PATH);
  const cert = readOptionalFile(process.env.KAFKA_SSL_CERT_PATH);
  const key = readOptionalFile(process.env.KAFKA_SSL_KEY_PATH);

  return {
    ...base,
    ssl: sslEnabled
      ? {
          rejectUnauthorized: process.env.KAFKA_SSL_REJECT_UNAUTHORIZED !== "false",
          ca: ca ? [ca] : undefined,
          cert,
          key,
        }
      : undefined,
    sasl,
  };
}
