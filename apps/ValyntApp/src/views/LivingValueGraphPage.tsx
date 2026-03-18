/**
 * LivingValueGraphPage - Main page component for the Living Value Graph feature
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  useGraphData,
  useWorkspaceStore,
  ApprovalDrawer,
  ValueTreeCanvas,
  GraphOutlinePanel,
  ScenarioLibraryPanel,
  ArtifactsPanel,
  NodeSummaryCard,
  FormulaPanel,
  EvidencePanel,
  ConfidencePanel,
  DefensibilityPanel,
  InputsPanel,
  HeadlineValueCard,
  InlineMutationBar,
  useWorkflowState,
  WorkflowTimeline,
  DefensibilityFeed,
  ActivityFeed,
  useActivities,
} from '../features/living-value-graph';

export default function LivingValueGraphPage() {
  const { opportunityId, caseId } = useParams<{ opportunityId: string; caseId: string }>();
  const [isApprovalDrawerOpen, setIsApprovalDrawerOpen] = useState(false);

  const { graph, isLoading } = useGraphData(caseId);
  const { selectedNodeId, leftRailTab, bottomTrayTab } = useWorkspaceStore();
  const { phase } = useWorkflowState();
  const { activities } = useActivities();

  const selectedNode = selectedNodeId && graph ? graph.nodes[selectedNodeId] : null;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-neutral-600">Loading value graph...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-neutral-200">
        <div>
          <h1 className="text-lg font-semibold">{graph ? 'Working Capital Optimization' : 'Living Value Graph'}</h1>
          <p className="text-sm text-neutral-500">{opportunityId ? `Opportunity #${opportunityId}` : 'Value Engineering Workspace'}</p>
        </div>
        <div className="flex items-center gap-4">
          {graph?.globalMetrics && (
            <HeadlineValueCard
              npv={graph.globalMetrics.npv}
              annualValue={graph.globalMetrics.npv / graph.globalMetrics.paybackMonths * 12}
              scenarioLabel="Base Case"
              lastRecalculated={graph.computedAt ?? new Date(0).toISOString()}
            />
          )}
          <button
            onClick={() => setIsApprovalDrawerOpen(true)}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
          >
            Request Approval
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r border-neutral-200 overflow-y-auto">
          {leftRailTab === 'outline' && graph && (
            <GraphOutlinePanel
              nodes={Object.values(graph.nodes)}
              selectedNodeId={selectedNodeId}
              onNodeSelect={(id) => useWorkspaceStore.getState().setSelectedNodeId(id)}
            />
          )}
          {leftRailTab === 'scenarios' && <ScenarioLibraryPanel scenarios={[]} activeScenarioId="scenario-001" />}
          {leftRailTab === 'artifacts' && <ArtifactsPanel artifacts={[]} />}
        </aside>

        <main className="flex-1 relative bg-neutral-50">
          {graph && <ValueTreeCanvas graph={graph} />}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 right-4">
              <InlineMutationBar
                nodeId={selectedNode.id}
                onEdit={() => console.log('Edit', selectedNode.id)}
                onScenario={() => console.log('Scenario', selectedNode.id)}
                onAskAgent={() => console.log('Ask Agent', selectedNode.id)}
                onLinkEvidence={() => console.log('Link Evidence', selectedNode.id)}
                onRedTeam={() => console.log('Red Team', selectedNode.id)}
                onRequestApproval={() => setIsApprovalDrawerOpen(true)}
              />
            </div>
          )}
        </main>

        <aside className="w-80 bg-white border-l border-neutral-200 overflow-y-auto">
          <NodeSummaryCard node={selectedNode} />
          <InputsPanel node={selectedNode} />
          <FormulaPanel node={selectedNode} />
          <EvidencePanel node={selectedNode} />
          <ConfidencePanel node={selectedNode} />
          <DefensibilityPanel node={selectedNode} />
        </aside>
      </div>

      <div className="h-48 bg-white border-t border-neutral-200 flex">
        {bottomTrayTab === 'workflow' && (
          <div className="flex-1 p-4">
            <WorkflowTimeline />
          </div>
        )}
        {bottomTrayTab === 'defensibility' && (
          <div className="flex-1 overflow-y-auto">
            <DefensibilityFeed />
          </div>
        )}
        {bottomTrayTab === 'activity' && <ActivityFeed activities={activities} />}
      </div>

      <ApprovalDrawer
        isOpen={isApprovalDrawerOpen}
        onClose={() => setIsApprovalDrawerOpen(false)}
        onSubmit={(reason: string) => {
          console.log('Approval requested:', reason);
          setIsApprovalDrawerOpen(false);
        }}
      />
    </div>
  );
}
