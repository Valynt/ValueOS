import { ExternalLink } from "lucide-react";
import React from "react";

interface ReasoningViewerProps {
  reasoning: string;
  onClose: () => void;
}

export const ReasoningViewer: React.FC<ReasoningViewerProps> = ({ reasoning, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-card rounded-lg shadow-lg p-6 max-w-lg w-full relative">
      <button
        className="absolute top-2 right-2 text-muted-foreground hover:text-muted-foreground"
        onClick={onClose}
        aria-label="Close"
      >
        <ExternalLink className="w-5 h-5" />
      </button>
      <h2 className="text-lg font-semibold mb-2">Reasoning Provenance</h2>
      <div className="text-sm text-muted-foreground whitespace-pre-line">
        {reasoning}
      </div>
    </div>
  </div>
);
