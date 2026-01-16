// /workspaces/ValueOS/apps/ValyntApp/src/components/ArtifactPreview.tsx
import React, { useEffect, useRef } from "react";
import { Download, FileText } from "lucide-react";

interface ArtifactPreviewProps {
  content: string;
  title: string;
  onClose: () => void;
}

const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({ content, title, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTimeout(() => closeRef.current?.focus(), 100);
  }, []);

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-4xl w-full max-h-full overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleDownload}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </button>
            <button
              ref={closeRef}
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 rounded"
              aria-label="Close"
            >
              Close
            </button>
          </div>
        </div>
        <div className="prose">
          <pre className="whitespace-pre-wrap">{content}</pre>
        </div>
      </div>
    </div>
  );
};

export default ArtifactPreview;
