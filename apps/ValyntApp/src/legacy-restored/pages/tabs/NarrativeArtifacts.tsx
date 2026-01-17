// /workspaces/ValueOS/src/pages/tabs/NarrativeArtifacts.tsx
import React, { useState } from "react";
import { useData } from "../../data/store";
import ArtifactPreview from "../../components/ArtifactPreview";

interface NarrativeArtifactsProps {
  dealId: string;
}

const NarrativeArtifacts: React.FC<NarrativeArtifactsProps> = ({ dealId }) => {
  const { state, dispatch } = useData();
  const deal = state.deals.find((d) => d.id === dealId);
  const hypotheses = state.hypotheses.filter((h) => h.dealId === dealId);
  const roi = state.roiModels.find((r) => r.dealId === dealId);
  const artifacts = state.artifacts.filter((a) => a.dealId === dealId);
  const [previewArtifact, setPreviewArtifact] = useState<any | null>(null);

  const generateContent = () => {
    if (!deal) return "";
    const totalOutputs = hypotheses.reduce(
      (sum, h) => sum + Object.values(h.outputs).reduce((s, v) => s + v, 0),
      0
    );
    const payback = roi ? roi.paybackMonths : 0;
    return `Executive Summary for ${deal.name}\n\nValue Hypotheses: ${totalOutputs.toLocaleString()} in benefits.\nROI Payback: ${payback} months.\n\nDetailed analysis follows...`;
  };

  const handleGenerate = (type: "exec-summary" | "one-page" | "qbr-report") => {
    const content = generateContent();
    const artifact = {
      id: Date.now().toString(),
      dealId,
      type,
      content,
    };
    dispatch({ type: "ADD_ARTIFACT", payload: artifact });
    setPreviewArtifact(artifact);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Narrative & Artifacts</h2>
      <div className="space-y-4">
        <button
          onClick={() => handleGenerate("exec-summary")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Generate Executive Summary
        </button>
        <button
          onClick={() => handleGenerate("one-page")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Generate One-Page Brief
        </button>
        <button
          onClick={() => handleGenerate("qbr-report")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Generate QBR Report
        </button>
      </div>
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Existing Artifacts</h3>
        {artifacts.map((a) => (
          <div key={a.id} className="bg-white p-4 rounded shadow mb-4">
            <h4 className="font-semibold">{a.type}</h4>
            <button
              onClick={() => setPreviewArtifact(a)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Preview
            </button>
          </div>
        ))}
      </div>
      {previewArtifact && (
        <ArtifactPreview
          content={previewArtifact.content}
          title={previewArtifact.type}
          onClose={() => setPreviewArtifact(null)}
        />
      )}
    </div>
  );
};

export default NarrativeArtifacts;
