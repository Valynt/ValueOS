export type InfraMode = "local" | "docker" | "supabase";

// ---------------------------------------------------------------------------
// Messaging topology matrix
// ---------------------------------------------------------------------------

export type MessagingModeId =
  | "kafka-on-stream-on"
  | "kafka-on-stream-off"
  | "kafka-off-stream-on"
  | "kafka-off-stream-off";

export interface MessagingModeCase {
  id: MessagingModeId;
  label: string;
  kafkaEnabled: boolean;
  streamingEnabled: boolean;
  env: Record<string, string>;
}

export const messagingModeMatrix: MessagingModeCase[] = [
  {
    id: "kafka-on-stream-on",
    label: "Kafka enabled, streaming enabled",
    kafkaEnabled: true,
    streamingEnabled: true,
    env: { KAFKA_ENABLED: "true", STREAMING_ENABLED: "true" },
  },
  {
    id: "kafka-on-stream-off",
    label: "Kafka enabled, streaming disabled",
    kafkaEnabled: true,
    streamingEnabled: false,
    env: { KAFKA_ENABLED: "true", STREAMING_ENABLED: "false" },
  },
  {
    id: "kafka-off-stream-on",
    label: "Kafka disabled, streaming enabled",
    kafkaEnabled: false,
    streamingEnabled: true,
    env: { KAFKA_ENABLED: "false", STREAMING_ENABLED: "true" },
  },
  {
    id: "kafka-off-stream-off",
    label: "Kafka disabled, streaming disabled",
    kafkaEnabled: false,
    streamingEnabled: false,
    env: { KAFKA_ENABLED: "false", STREAMING_ENABLED: "false" },
  },
];

export interface InfraModeCase {
  enabled: boolean;
  env: Record<string, string>;
  id: string;
  label: string;
  mode: InfraMode;
}

const isEnabled = (envFlag: string | undefined): boolean => envFlag !== "0";

export const infraModeMatrix: InfraModeCase[] = [
  {
    id: "local",
    mode: "local",
    label: "Local in-process infrastructure",
    env: {
      TEST_INFRA_MODE: "local",
    },
    enabled: true,
  },
  {
    id: "docker",
    mode: "docker",
    label: "Container-backed infrastructure",
    env: {
      TEST_INFRA_MODE: "docker",
    },
    enabled: isEnabled(process.env.ENABLE_DOCKER_INFRA_TESTS),
  },
  {
    id: "supabase",
    mode: "supabase",
    label: "Supabase-backed infrastructure",
    env: {
      TEST_INFRA_MODE: "supabase",
    },
    enabled: isEnabled(process.env.ENABLE_SUPABASE_INFRA_TESTS),
  },
];
