/**
 * AES (Agentic Experience System) Workspace
 * 
 * Main layout implementing the five AES experiential layers:
 * 1. Intent Layer - Conversational inputs and goal parsing
 * 2. Orchestration UX - Live workflow and reasoning visualization
 * 3. Reflection Layer - Outcomes, rationale, and metrics
 * 4. Trust & Identity - Authorization and security context
 * 5. Co-Presence Layer - Live presence of humans and agents
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Activity, 
  Shield, 
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { IntentPanel } from './IntentPanel';
import { OrchestrationCanvas } from './OrchestrationCanvas';
import { ReflectionPanel } from './ReflectionPanel';
import { useAESRealtime } from '../../hooks/useAESRealtime';
import { featureFlags } from '../../config/featureFlags';

interface AESWorkspaceProps {
  workflowId?: string;
  userId: string;
  organizationId?: string;
}

export function AESWorkspace({ 
  workflowId, 
  userId, 
  organizationId 
}: AESWorkspaceProps) {
  // Panel visibility state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Real-time connections
  const { 
    workflowState, 
    presence, 
    metrics, 
    trustGraph 
  } = useAESRealtime(workflowId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // ⌘/Ctrl + B: Toggle left panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setLeftPanelCollapsed(prev => !prev);
      }
      // ⌘/Ctrl + R: Toggle right panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        setRightPanelCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Left Panel - Intent Layer */}
      <aside 
        className={`
          border-r border-slate-800 transition-all duration-300 ease-in-out
          ${leftPanelCollapsed ? 'w-0' : 'w-72'}
        `}
      >
        {!leftPanelCollapsed && (
          <IntentPanel 
            userId={userId}
            organizationId={organizationId}
            presence={presence}
          />
        )}
      </aside>

      {/* Left Panel Toggle */}
      <button
        onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
        className="
          absolute left-0 top-1/2 -translate-y-1/2 z-10
          bg-slate-800 hover:bg-slate-700 
          border border-slate-700 rounded-r-lg
          p-1.5 transition-all
        "
        style={{ left: leftPanelCollapsed ? '0' : '288px' }}
        title={leftPanelCollapsed ? 'Show Intent Panel (⌘B)' : 'Hide Intent Panel (⌘B)'}
      >
        {leftPanelCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Center Canvas - Orchestration Layer */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* AES Layer Indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800 bg-slate-900/50">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium">Agentic Experience System</span>
          
          {/* Layer indicators */}
          <div className="ml-auto flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-slate-400">Intent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-slate-400">Orchestration</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-slate-400">Reflection</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-400">Trust</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="text-slate-400">Co-Presence</span>
            </div>
          </div>
        </div>

        {/* Orchestration Canvas */}
        <OrchestrationCanvas 
          workflowId={workflowId}
          workflowState={workflowState}
          presence={presence}
        />
      </main>

      {/* Right Panel Toggle */}
      <button
        onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
        className="
          absolute right-0 top-1/2 -translate-y-1/2 z-10
          bg-slate-800 hover:bg-slate-700 
          border border-slate-700 rounded-l-lg
          p-1.5 transition-all
        "
        style={{ right: rightPanelCollapsed ? '0' : '320px' }}
        title={rightPanelCollapsed ? 'Show Reflection Panel (⌘R)' : 'Hide Reflection Panel (⌘R)'}
      >
        {rightPanelCollapsed ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Right Panel - Reflection Layer */}
      <aside 
        className={`
          border-l border-slate-800 transition-all duration-300 ease-in-out
          ${rightPanelCollapsed ? 'w-0' : 'w-80'}
        `}
      >
        {!rightPanelCollapsed && (
          <ReflectionPanel 
            workflowId={workflowId}
            metrics={metrics}
            trustGraph={trustGraph}
          />
        )}
      </aside>
    </div>
  );
}

/**
 * Feature flag wrapper for gradual rollout
 */
export function AESWorkspaceWrapper(props: AESWorkspaceProps) {
  // Check if AES UI is enabled
  if (!featureFlags.ENABLE_AES_UI) {
    // Fallback to legacy ChatCanvasLayout
    const { ChatCanvasLayout } = require('../ChatCanvas/ChatCanvasLayout');
    return <ChatCanvasLayout />;
  }

  return <AESWorkspace {...props} />;
}
