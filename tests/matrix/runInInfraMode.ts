import {
  type InfraMode,
  type InfraModeCase,
  infraModeMatrix,
  type MessagingModeCase,
  messagingModeMatrix,
} from "./infra-mode.matrix";

export interface InfraModeContext {
  mode: InfraMode;
  namespace: string;
}

const withTempEnv = async <T>(
  envValues: Record<string, string>,
  fn: () => Promise<T> | T,
): Promise<T> => {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(envValues)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

export const runInInfraMode = async <T>(
  infraMode: InfraModeCase,
  namespace: string,
  fn: (context: InfraModeContext) => Promise<T> | T,
): Promise<T> =>
  withTempEnv(infraMode.env, () =>
    fn({
      mode: infraMode.mode,
      namespace,
    }),
  );

export const enabledInfraModes = (): InfraModeCase[] =>
  infraModeMatrix.filter((mode) => mode.enabled);

// ---------------------------------------------------------------------------
// Messaging mode runner
// ---------------------------------------------------------------------------

export interface MessagingModeContext {
  id: MessagingModeCase["id"];
  kafkaEnabled: boolean;
  streamingEnabled: boolean;
}

export const runInMessagingMode = async <T>(
  messagingMode: MessagingModeCase,
  fn: (context: MessagingModeContext) => Promise<T> | T,
): Promise<T> =>
  withTempEnv(messagingMode.env, () =>
    fn({
      id: messagingMode.id,
      kafkaEnabled: messagingMode.kafkaEnabled,
      streamingEnabled: messagingMode.streamingEnabled,
    }),
  );

export const allMessagingModes = (): MessagingModeCase[] => messagingModeMatrix;
