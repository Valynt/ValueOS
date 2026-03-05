import { ReactNode, useMemo } from "react";
import {
  HumanCheckpointDependenciesProvider,
  HumanCheckpointEventPayload,
} from "@valueos/sdui";

import { useAuth } from "@/contexts/AuthContext";
import { HumanCheckpointBrokerAdapter } from "@/services/messaging/HumanCheckpointBrokerAdapter";
import { RedisStreamBroker } from "@/services/messaging/RedisStreamBroker";

const humanCheckpointBroker = new HumanCheckpointBrokerAdapter(
  new RedisStreamBroker({
    streamName: "agent.checkpoints",
    consumerName: "human-checkpoint-ui",
  }),
);

interface SDUIHumanCheckpointProviderProps {
  children: ReactNode;
}

export function SDUIHumanCheckpointProvider({ children }: SDUIHumanCheckpointProviderProps) {
  const { user } = useAuth();

  const value = useMemo(() => {
    return {
      auth: { userId: user?.id ?? null },
      broker: humanCheckpointBroker,
    };
  }, [user?.id]);

  return (
    <HumanCheckpointDependenciesProvider value={value}>
      {children}
    </HumanCheckpointDependenciesProvider>
  );
}

export type { HumanCheckpointEventPayload };
