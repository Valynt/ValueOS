import { ReactNode, useMemo } from "react";
import {
  HumanCheckpointDependenciesProvider,
  HumanCheckpointEventPayload,
} from "@valueos/sdui";

import { useAuth } from "@/contexts/AuthContext";
import { humanCheckpointBroker } from "@/lib/humanCheckpointBroker";

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
