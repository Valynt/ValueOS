import React from "react";
import { OpportunityAgentPanel } from "./components/OpportunityAgentPanel";
import { GroundTruthExplorer } from "./components/GroundTruthExplorer";

export const OpportunityDiscovery: React.FC = () => {
  // For now, hardcode the agentId for OpportunityAgent
  const agentId = "opportunity-agent";

  return (
    <section className="max-w-4xl mx-auto mt-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Discovery: Identify Pain Points</h1>
      <p className="mb-6 text-gray-600 dark:text-gray-300">
        Use the Opportunity Agent to analyze prospect data, uncover pain points, and quantify
        business opportunities. Enter a pain point or opportunity below to get started.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <OpportunityAgentPanel agentId={agentId} />
        </div>
        <div>
          <GroundTruthExplorer />
        </div>
      </div>
    </section>
  );
};
