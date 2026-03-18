/**
 * InputsPanel Component - Editable inputs for value nodes
 */

import { useState } from 'react';
import { useStateGating } from '../../hooks/useStateGating';
import { ValueNode } from '../../types/graph.types';

interface InputsPanelProps {
  node?: ValueNode | null;
  onInputChange?: (inputId: string, value: number) => void;
}

export function InputsPanel({ node, onInputChange }: InputsPanelProps) {
  const { canEdit } = useStateGating();
  const [editingValues, setEditingValues] = useState<Record<string, string | undefined>>({});

  if (!node) {
    return (
      <div className="p-4">
        <h4 className="text-sm font-semibold text-neutral-900 mb-2">Inputs</h4>
        <p className="text-sm text-neutral-500">Select a node to view inputs</p>
      </div>
    );
  }

  const isInputNode = node.type === 'input';

  return (
    <div className="p-4 border-t border-neutral-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-neutral-900">Inputs</h4>
        {!canEdit && (
          <span className="text-xs px-2 py-1 bg-neutral-100 text-neutral-500 rounded">
            Read-only
          </span>
        )}
      </div>

      {isInputNode ? (
        <div className="space-y-3">
          <InputRow
            label={node.label}
            value={node.value || 0}
            unit={node.unit}
            editable={canEdit && !node.metadata?.locked}
            onChange={(value) => onInputChange?.(node.id, value)}
            editingValue={editingValues[node.id]}
            onEditingChange={(val) =>
              setEditingValues((prev) => {
                const next = { ...prev };
                if (val === undefined) {
                  delete next[node.id];
                } else {
                  next[node.id] = val;
                }
                return next;
              })
            }
          />
        </div>
      ) : node.inputs && node.inputs.length > 0 ? (
        <div className="space-y-2">
          {node.inputs.map((inputId) => (
            <div key={inputId} className="flex items-center justify-between p-2 bg-neutral-50 rounded">
              <span className="text-sm text-neutral-600">{inputId}</span>
              <span className="text-sm font-medium">Input reference</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No inputs defined</p>
      )}
    </div>
  );
}

interface InputRowProps {
  label: string;
  value: number;
  unit?: string;
  editable: boolean;
  onChange: (value: number) => void;
  editingValue: string | undefined;
  onEditingChange: (value: string | undefined) => void;
}

function InputRow({
  label,
  value,
  unit,
  editable,
  onChange,
  editingValue,
  onEditingChange,
}: InputRowProps) {
  const isEditing = editingValue !== undefined;
  const displayValue = isEditing ? editingValue : value.toString();

  const handleBlur = () => {
    if (isEditing) {
      const numValue = parseFloat(editingValue);
      if (!isNaN(numValue)) {
        onChange(numValue);
      }
      onEditingChange(undefined);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      onEditingChange(undefined);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded">
      <div>
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        {unit && <div className="text-xs text-neutral-500">{unit}</div>}
      </div>

      {editable ? (
        <input
          type="number"
          value={displayValue}
          onChange={(e) => onEditingChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-32 px-2 py-1 text-right border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <div className="text-sm font-medium tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <span className="ml-1 text-neutral-500">{unit}</span>}
        </div>
      )}
    </div>
  );
}
