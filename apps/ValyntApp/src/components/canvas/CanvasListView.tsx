/**
 * CanvasListView — Accessible list view alternative to canvas graph
 *
 * Provides a sortable table view of all nodes for screen reader users
 * and keyboard navigation. Critical for WCAG 2.1 AA compliance.
 *
 * Phase 4: Hardening - 4.2.5 Canvas alternative views
 */

import { useState, useCallback } from 'react';
import type { WarmthState } from '@shared/domain/Warmth';

interface CanvasNode {
  id: string;
  name: string;
  value: number;
  confidence: number;
  warmth: WarmthState;
  type: 'input' | 'driver' | 'metric' | 'output' | 'assumption';
  metadata?: {
    owner?: string;
    lastModified?: string;
  };
}

interface CanvasListViewProps {
  nodes: CanvasNode[];
  /** Callback when node is selected */
  onSelectNode?: (nodeId: string) => void;
  /** Callback when node is edited */
  onEditNode?: (nodeId: string) => void;
  /** Callback when node is deleted */
  onDeleteNode?: (nodeId: string) => void;
  /** Show compact view */
  compact?: boolean;
}

type SortKey = keyof Pick<CanvasNode, 'name' | 'value' | 'confidence' | 'warmth'>;
type SortDirection = 'asc' | 'desc';

export function CanvasListView({
  nodes,
  onSelectNode,
  onEditNode,
  onDeleteNode,
  compact = false,
}: CanvasListViewProps): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
    },
    [sortKey, sortDirection]
  );

  const sortedNodes = [...nodes].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  const handleRowClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    onSelectNode?.(nodeId);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value);
  };

  const getWarmthBadge = (warmth: WarmthState): JSX.Element => {
    const colors = {
      forming: 'bg-amber-100 text-amber-800 border-amber-200',
      firm: 'bg-blue-100 text-blue-800 border-blue-200',
      verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[warmth]}`}
      >
        {warmth}
      </span>
    );
  };

  const SortHeader = ({ label, sortKeyValue }: { label: string; sortKeyValue: SortKey }) => (
    <button
      onClick={() => handleSort(sortKeyValue)}
      className="flex items-center gap-1 font-medium hover:text-blue-600"
      aria-sort={sortKey === sortKeyValue ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      {sortKey === sortKeyValue && (
        <span aria-hidden="true">{sortDirection === 'asc' ? '▲' : '▼'}</span>
      )}
    </button>
  );

  if (compact) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white" role="region" aria-label="Canvas list view">
        <ul className="divide-y divide-gray-200">
          {sortedNodes.map((node) => (
            <li
              key={node.id}
              className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${
                selectedNodeId === node.id ? 'bg-blue-50' : ''
              }`}
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(node.id)}
              onKeyDown={(e) => e.key === 'Enter' && handleRowClick(node.id)}
              aria-selected={selectedNodeId === node.id}
            >
              <div className="flex flex-col">
                <span className="font-medium">{node.name}</span>
                <span className="text-sm text-gray-500">{formatCurrency(node.value)}</span>
              </div>
              <div className="flex items-center gap-2">
                {getWarmthBadge(node.warmth)}
                <span className="text-sm text-gray-500">{Math.round(node.confidence * 100)}%</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white" role="region" aria-label="Canvas nodes table">
      <table className="w-full text-left text-sm" role="grid">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3" scope="col">
              <SortHeader label="Name" sortKeyValue="name" />
            </th>
            <th className="px-4 py-3" scope="col">
              <SortHeader label="Type" sortKeyValue="name" />
            </th>
            <th className="px-4 py-3" scope="col">
              <SortHeader label="Value" sortKeyValue="value" />
            </th>
            <th className="px-4 py-3" scope="col">
              <SortHeader label="Confidence" sortKeyValue="confidence" />
            </th>
            <th className="px-4 py-3" scope="col">
              <SortHeader label="Warmth" sortKeyValue="warmth" />
            </th>
            <th className="px-4 py-3" scope="col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedNodes.map((node) => (
            <tr
              key={node.id}
              className={`hover:bg-gray-50 ${selectedNodeId === node.id ? 'bg-blue-50' : ''}`}
              role="row"
              aria-selected={selectedNodeId === node.id}
            >
              <td className="px-4 py-3">
                <button
                  onClick={() => handleRowClick(node.id)}
                  className="font-medium text-blue-600 hover:text-blue-800"
                  aria-label={`${node.name}, ${formatCurrency(node.value)}, ${Math.round(node.confidence * 100)}% confidence, ${node.warmth} state`}
                >
                  {node.name}
                </button>
              </td>
              <td className="px-4 py-3 capitalize">{node.type}</td>
              <td className="px-4 py-3 font-medium">{formatCurrency(node.value)}</td>
              <td className="px-4 py-3">{Math.round(node.confidence * 100)}%</td>
              <td className="px-4 py-3">{getWarmthBadge(node.warmth)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditNode?.(node.id)}
                    className="rounded px-2 py-1 text-xs hover:bg-gray-100"
                    aria-label={`Edit ${node.name}`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteNode?.(node.id)}
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${node.name}`}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Toggle between canvas and list view
interface CanvasViewToggleProps {
  currentView: 'canvas' | 'list';
  onChange: (view: 'canvas' | 'list') => void;
  /** Disabled state */
  disabled?: boolean;
}

export function CanvasViewToggle({
  currentView,
  onChange,
  disabled = false,
}: CanvasViewToggleProps): JSX.Element {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-white p-1" role="group" aria-label="View toggle">
      <button
        onClick={() => onChange('canvas')}
        disabled={disabled || currentView === 'canvas'}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          currentView === 'canvas'
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        aria-pressed={currentView === 'canvas'}
      >
        Canvas
      </button>
      <button
        onClick={() => onChange('list')}
        disabled={disabled || currentView === 'list'}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          currentView === 'list'
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        aria-pressed={currentView === 'list'}
      >
        List View
      </button>
    </div>
  );
}
