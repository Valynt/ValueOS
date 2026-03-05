import React, { useMemo } from "react";

import { useAuth } from "../../app/providers";
import {
  HumanCheckpoint,
  HumanCheckpointDependencies,
} from "@valueos/sdui";

import { SDUIHumanCheckpointBrokerAdapter } from "../../services/messaging/SDUIHumanCheckpointBrokerAdapter";

type ConnectedHumanCheckpointProps = React.ComponentProps<typeof HumanCheckpoint>;

export function ConnectedHumanCheckpoint(props: ConnectedHumanCheckpointProps) {
  const { user } = useAuth();
  const broker = useMemo(() => new SDUIHumanCheckpointBrokerAdapter(), []);

  const dependencies: HumanCheckpointDependencies = useMemo(
    () => ({
      auth: {
        user: user?.id ? { id: user.id } : null,
      },
      broker,
    }),
    [broker, user?.id]
  );

  return <HumanCheckpoint {...props} dependencies={dependencies} />;
}
