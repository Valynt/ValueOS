import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ShieldCheck, X } from 'lucide-react';
import { getConfig } from '../../config/environment';
import type { ModelCard } from '../../types/modelCard';

interface ModelInfoModalProps {
  isOpen: boolean;
  agentId: string;
  onClose: () => void;
  onAgentChange?: (agentId: string) => void;
}

interface ModelCardResponse {
  success: boolean;
  data?: {
    agent_id: string;
    model_card: ModelCard;
  };
  error?: string;
  message?: string;
}

const AGENT_OPTIONS = [
  { id: 'opportunity', label: 'Opportunity Agent' },
  { id: 'target', label: 'Target Agent' },
  { id: 'realization', label: 'Realization Agent' },
];

export const ModelInfoModal: React.FC<ModelInfoModalProps> = ({
  isOpen,
  agentId,
  onClose,
  onAgentChange,
}) => {
  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [schemaVersion, setSchemaVersion] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = useMemo(() => getConfig().app.apiBaseUrl?.replace(/\/$/, '') || '', []);

  useEffect(() => {
    if (!isOpen) return;

    const fetchModelCard = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${baseUrl}/api/agents/${agentId}/info`);
        const schemaHeader = response.headers.get('x-model-card-version') || '';
        setSchemaVersion(schemaHeader);

        const payload = (await response.json()) as ModelCardResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || payload.error || 'Unable to load model card');
        }

        setModelCard(payload.data.model_card);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model details');
        setModelCard(null);
      } finally {
        setLoading(false);
      }
    };

    fetchModelCard();
  }, [agentId, baseUrl, isOpen]);

  if (!isOpen) return null;

  const selectedOption = AGENT_OPTIONS.find(option => option.id === agentId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="flex items-start justify-between p-4 border-b border-gray-200">
          <div>
            <p className="text-sm text-gray-500">Model Transparency</p>
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedOption?.label || 'Agent Model Info'}
            </h2>
            {schemaVersion && (
              <p className="text-xs text-gray-500 mt-1">Schema version: {schemaVersion}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700"
            aria-label="Close model info"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="model-agent-selector">
              Agent workflow
            </label>
            <select
              id="model-agent-selector"
              value={agentId}
              onChange={(e) => onAgentChange?.(e.target.value)}
              className="w-full sm:w-60 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AGENT_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="flex items-center space-x-2 text-gray-600">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Loading model details…</p>
            </div>
          )}

          {error && (
            <div className="flex items-start space-x-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium">Unable to load model card</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {modelCard && !loading && !error && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <p className="text-xs uppercase text-gray-500">Model version</p>
                  <p className="text-base font-semibold text-gray-900">{modelCard.model_version}</p>
                  <p className="text-xs text-gray-500 mt-1">Training cutoff: {modelCard.training_cutoff}</p>
                </div>
                <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                  <p className="text-xs uppercase text-blue-700 flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4" /> Prompt contract hash
                  </p>
                  <p className="text-xs font-mono text-blue-900 break-all mt-1">{modelCard.prompt_contract_hash}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Safety constraints</p>
                <ul className="space-y-2">
                  {modelCard.safety_constraints.map((constraint, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-sm text-gray-700">
                      <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5" />
                      <span>{constraint}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Known limitations</p>
                <ul className="space-y-2">
                  {modelCard.known_limitations.map((limitation, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-sm text-gray-700">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
