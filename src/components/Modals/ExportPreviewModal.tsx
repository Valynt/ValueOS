import React, { useRef } from "react";
import { Download, FileText, Printer, X } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { PrintReportLayout } from "../Report/PrintReportLayout";
import { ValueCase } from "../../services/ValueCaseService";

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: ValueCase;
  analysisData: any; // The lastAnalysis context
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  isOpen,
  onClose,
  caseData,
  analysisData,
}) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // Use window.print() or specialized hook.
    // For this implementation, we rely on the global print styles
    // but scoped to the modal content if possible, or just print the whole page
    // where the specific print layout takes over.
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Executive Brief Preview
              </h2>
              <p className="text-sm text-gray-500">Ready for export</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
          <div className="bg-white shadow-lg mx-auto max-w-4xl min-h-[1000px] origin-top scale-95 transition-transform">
            {/* We render the layout here visibly for preview */}
            <div className="pointer-events-none select-none print:pointer-events-auto print:select-auto">
              <PrintReportLayout
                caseData={caseData}
                summary={analysisData.analysisSummary}
                metrics={analysisData.keyMetrics}
                hypotheses={analysisData.valueHypotheses}
                isPreview={true} // Add this prop to force visible style
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
