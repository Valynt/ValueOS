import React, { useState } from "react";
import { X, Share2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { crmIntegrationService } from "../../services/CRMIntegrationService";
import { useToast } from "../Common/Toast";

interface CRMSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  analysisData: any;
}

export const CRMSyncModal: React.FC<CRMSyncModalProps> = ({
  isOpen,
  onClose,
  dealId,
  analysisData,
}) => {
  const { showSuccess, showError } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedHypotheses, setSelectedHypotheses] = useState<number[]>(
    analysisData.valueHypotheses.map((_: any, i: number) => i) // All selected by default
  );

  const toggleSelection = (index: number) => {
    if (selectedHypotheses.includes(index)) {
      setSelectedHypotheses((prev) => prev.filter((i) => i !== index));
    } else {
      setSelectedHypotheses((prev) => [...prev, index]);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);

    // Filter data based on selection
    const filteredData = {
      ...analysisData,
      valueHypotheses: analysisData.valueHypotheses.filter(
        (_: any, i: number) => selectedHypotheses.includes(i)
      ),
    };

    const result = await crmIntegrationService.syncAnalysisToDeal(
      dealId,
      filteredData
    );

    setIsSyncing(false);

    if (result.success) {
      showSuccess(result.message);
      onClose();
    } else {
      showError(result.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg" aria-hidden="true">
              <Share2 className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Sync to CRM
              </h2>
              <p className="text-sm text-gray-500">
                Select insights to write back to Deal #{dealId}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close modal">
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
              Select Value Hypotheses to Sync:
            </p>
            {analysisData.valueHypotheses.map((hypo: any, idx: number) => (
              <div
                key={idx}
                onClick={() => toggleSelection(idx)}
                className={`
                            border rounded-lg p-4 cursor-pointer transition-all
                            ${
                              selectedHypotheses.includes(idx)
                                ? "border-orange-200 bg-orange-50/50 ring-1 ring-orange-200"
                                : "border-gray-200 hover:border-gray-300"
                            }
                        `}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`
                                mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0
                                ${selectedHypotheses.includes(idx) ? "bg-orange-600 border-orange-600 text-white" : "border-gray-300"}
                            `}
                  >
                    {selectedHypotheses.includes(idx) && (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {hypo.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {hypo.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing || selectedHypotheses.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Confirm Sync"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
