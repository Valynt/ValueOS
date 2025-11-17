import React from 'react';
import ValueFlowGraph from './ValueFlowGraph';
import Legend from './Legend';

function ValueFlowPage() {
  return (
    <div style={{ padding: '16px' }}>
      <h2>Value Operating System – Agent Architecture</h2>
      <p>This interactive diagram illustrates how agents communicate within the Value Operating System. Hover over nodes and edges for details. Use the mini map and controls to navigate.</p>
      <Legend />
      <ValueFlowGraph />
    </div>
  );
}

export default ValueFlowPage;