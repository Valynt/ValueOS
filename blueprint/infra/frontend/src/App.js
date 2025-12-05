import React from 'react';
import ValueFlowGraph from './components/ValueFlowGraph';
import Legend from './components/Legend';
import './index.css';

function App() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">Value Operating System Dashboard</h1>
      <p className="mb-4">Interactive visualization of the multi-agent architecture.</p>
      <Legend />
      <ValueFlowGraph />
    </div>
  );
}

export default App;