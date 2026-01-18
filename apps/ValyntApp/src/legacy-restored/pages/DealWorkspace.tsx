// /workspaces/ValueOS/src/pages/DealWorkspace.tsx
import React from "react";
import { Routes, Route, useParams, NavLink, Outlet } from "react-router-dom";
import { useData } from "../data/store";
import DetailHeader from "../components/DetailHeader";

const DealWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { state } = useData();
  const deal = state.deals.find((d) => d.id === id);

  if (!deal) {
    return <div>Deal not found</div>;
  }

  const tabs = [
    { to: "overview", label: "Overview" },
    { to: "discovery-notes", label: "Discovery Notes" },
    { to: "value-hypothesis", label: "Value Hypothesis" },
    { to: "roi-model", label: "ROI Model" },
    { to: "narrative-artifacts", label: "Narrative & Artifacts" },
    { to: "stakeholders", label: "Stakeholders" },
    { to: "assumptions-benchmarks", label: "Assumptions & Benchmarks" },
    { to: "reasoning-trace", label: "Reasoning Trace" },
    { to: "value-realization", label: "Value Realization" },
  ];

  return (
    <div>
      <DetailHeader
        title={deal.name}
        subtitle={`Stage: ${deal.stage} | Amount: $${deal.amount.toLocaleString()}`}
      />
      <div className="mb-6">
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded ${isActive ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Routes>
        <Route path="overview" element={<Overview deal={deal} />} />
        <Route path="discovery-notes" element={<DiscoveryNotes dealId={deal.id} />} />
        <Route path="value-hypothesis" element={<ValueHypothesis dealId={deal.id} />} />
        <Route path="roi-model" element={<ROIModel dealId={deal.id} />} />
        <Route path="narrative-artifacts" element={<NarrativeArtifacts dealId={deal.id} />} />
        <Route path="stakeholders" element={<Stakeholders dealId={deal.id} />} />
        <Route path="assumptions-benchmarks" element={<AssumptionsBenchmarks dealId={deal.id} />} />
        <Route path="reasoning-trace" element={<ReasoningTrace dealId={deal.id} />} />
        <Route path="value-realization" element={<ValueRealization dealId={deal.id} />} />
        <Route path="/" element={<Overview deal={deal} />} />
      </Routes>
    </div>
  );
};

// Placeholder components for each tab
const Overview = ({ deal }: { deal: any }) => <div>Overview for {deal.name}</div>;
const DiscoveryNotes = ({ dealId }: { dealId: string }) => <div>Discovery Notes for {dealId}</div>;
const ValueHypothesis = ({ dealId }: { dealId: string }) => (
  <div>Value Hypothesis for {dealId}</div>
);
const ROIModel = ({ dealId }: { dealId: string }) => <div>ROI Model for {dealId}</div>;
const NarrativeArtifacts = ({ dealId }: { dealId: string }) => (
  <div>Narrative & Artifacts for {dealId}</div>
);
const Stakeholders = ({ dealId }: { dealId: string }) => <div>Stakeholders for {dealId}</div>;
const AssumptionsBenchmarks = ({ dealId }: { dealId: string }) => (
  <div>Assumptions & Benchmarks for {dealId}</div>
);
const ReasoningTrace = ({ dealId }: { dealId: string }) => <div>Reasoning Trace for {dealId}</div>;
const ValueRealization = ({ dealId }: { dealId: string }) => (
  <div>Value Realization for {dealId}</div>
);

export default DealWorkspace;
