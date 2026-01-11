import React, { useEffect, useMemo, useState } from 'react';
import { BUSINESS_WORKFLOW_STAGES } from './config';
import type { WorkflowStage } from './types';
import { JsonViewer } from '../SDUI/JsonViewer';
import {
  extractGroundTruthPayload,
  GroundTruthPayload,
  stripGroundTruthFields,
} from './groundTruth';

interface StageContentProps {
  stage: WorkflowStage;
  data: unknown;
  onUpdate: (data: unknown) => void;
  onInvokeAgent: () => void;
}

const CONFIDENCE_PERCENT_MULTIPLIER = 100;

const buildBenchmarkRows = (benchmarks: GroundTruthPayload['benchmarks']) => {
  if (!benchmarks) return [];

  if (Array.isArray(benchmarks)) {
    return benchmarks.map((item, index) => ({
      id: `benchmark-${index}`,
      ...((item as Record<string, unknown>) || {}),
    }));
  }

  return Object.entries(benchmarks).map(([metricId, payload]) => ({
    id: metricId,
    metricId,
    ...(payload as Record<string, unknown>),
  }));
};

const buildValidationRows = (validations: GroundTruthPayload['validations']) => {
  if (!validations) return [];

  if (Array.isArray(validations)) {
    return validations.map((item, index) => ({
      id: `validation-${index}`,
      ...((item as Record<string, unknown>) || {}),
    }));
  }

  return Object.entries(validations).map(([metricId, payload]) => ({
    id: metricId,
    metricId,
    ...(payload as Record<string, unknown>),
  }));
};

export const StageContent: React.FC<StageContentProps> = ({
  stage,
  data,
  onUpdate,
  onInvokeAgent,
}) => {
  const stageConfig = BUSINESS_WORKFLOW_STAGES.find((s) => s.id === stage);
  const groundTruth = extractGroundTruthPayload(data);
  const cleanedData = useMemo(() => stripGroundTruthFields(data), [data]);
  const [notes, setNotes] = useState('');

  const benchmarkRows = buildBenchmarkRows(groundTruth?.benchmarks);
  const validationRows = buildValidationRows(groundTruth?.validations);

  useEffect(() => {
    if (typeof cleanedData === 'object' && cleanedData !== null && !Array.isArray(cleanedData)) {
      setNotes(String((cleanedData as Record<string, unknown>).notes ?? ''));
      return;
    }

    setNotes('');
  }, [cleanedData]);

  const handleSaveNotes = () => {
    const notesValue = notes.trim();
    if (typeof cleanedData === 'object' && cleanedData !== null && !Array.isArray(cleanedData)) {
      onUpdate({
        ...(cleanedData as Record<string, unknown>),
        notes: notesValue,
        ...(groundTruth ? { groundTruth } : {}),
      });
      return;
    }

    onUpdate({
      value: cleanedData,
      notes: notesValue,
      ...(groundTruth ? { groundTruth } : {}),
    });
  };

  const notesId = `stage-notes-${stage}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {stageConfig?.label ?? 'Workflow Stage'}
          </h2>
          {stageConfig?.description && (
            <p className="text-sm text-gray-600 mt-1">{stageConfig.description}</p>
          )}
        </div>
        <button
          onClick={onInvokeAgent}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Run {stageConfig?.agentType ?? 'agent'}
        </button>
      </div>

      {!data && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
          No output yet. Run the agent to generate analysis for this stage.
        </div>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Stage Output
            </h3>
            <JsonViewer data={cleanedData} title="Agent Response" />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
              Ground Truth Evidence
            </h3>
            {groundTruth ? (
              <div className="space-y-4">
                {typeof groundTruth.overallConfidence === 'number' && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    Overall confidence:{' '}
                    <span className="font-semibold">
                      {(groundTruth.overallConfidence * CONFIDENCE_PERCENT_MULTIPLIER).toFixed(0)}%
                    </span>
                  </div>
                )}

                {benchmarkRows.length > 0 && (
                  <JsonViewer data={benchmarkRows} title="Benchmarks" />
                )}

                {validationRows.length > 0 && (
                  <JsonViewer data={validationRows} title="Validations" />
                )}

                {groundTruth.sources && groundTruth.sources.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Sources
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-gray-700">
                      {groundTruth.sources.map((source, index) => (
                        <li key={`${source}-${index}`} className="break-words">
                          {source}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!benchmarkRows.length &&
                  !validationRows.length &&
                  !(groundTruth.sources && groundTruth.sources.length > 0) && (
                    <JsonViewer data={groundTruth} title="Ground Truth Payload" />
                  )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                No ground truth payload detected for this stage.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <label htmlFor={notesId} className="text-sm font-semibold text-gray-800">
          Analyst Notes
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Capture notes or adjustments for this stage..."
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          rows={3}
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSaveNotes}
            className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
};
