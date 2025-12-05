/**
 * Stateful Value Tree Card
 * 
 * Example of integrating SDUIStateManager with an SDUI component
 */

import React from 'react';
import { ValueTreeCard, ValueTreeCardProps } from './ValueTreeCard';
import { useSDUIState } from '../../lib/state';

/**
 * Props for StatefulValueTreeCard
 */
export interface StatefulValueTreeCardProps extends Omit<ValueTreeCardProps, 'nodes'> {
  /** State key for storing nodes */
  stateKey: string;
  /** Initial nodes if state doesn't exist */
  initialNodes?: string[];
  /** Callback when nodes change */
  onNodesChange?: (nodes: string[]) => void;
}

/**
 * Stateful Value Tree Card Component
 * 
 * Manages its own state using SDUIStateManager
 */
export const StatefulValueTreeCard: React.FC<StatefulValueTreeCardProps> = ({
  stateKey,
  initialNodes = [],
  onNodesChange,
  ...props
}) => {
  const [nodes, setNodes, loading] = useSDUIState<string[]>(
    stateKey,
    initialNodes
  );

  // Notify parent of changes
  React.useEffect(() => {
    if (nodes && onNodesChange) {
      onNodesChange(nodes);
    }
  }, [nodes, onNodesChange]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return <ValueTreeCard {...props} nodes={nodes || []} />;
};
