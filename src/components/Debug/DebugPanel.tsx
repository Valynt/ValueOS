/**
 * Debug Panel Component
 *
 * Visual debugging interface for pipeline inspection and monitoring.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  Download,
  Upload,
  Trash2,
  Bug,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  Database,
  Globe,
  Layers,
} from 'lucide-react';
import { usePipelineDebugger, DebugEvent, DebugSession } from '../lib/debugging/PipelineDebugger';

interface DebugPanelProps {
  enabled?: boolean;
  className?: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  enabled = false,
  className = ''
}) => {
  const {
    currentSession,
    insights,
    startSession,
    endSession,
    logEvent,
    exportSession,
    getAllSessions,
    clearSessions,
  } = usePipelineDebugger(enabled);

  const [activeTab, setActiveTab] = useState<'events' | 'metrics' | 'insights' | 'sessions'>('events');
  const [selectedEvent, setSelectedEvent] = useState<DebugEvent | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    if (!currentSession) return [];

    return currentSession.events.filter(event => {
      const matchesSearch = !filter ||
        event.title.toLowerCase().includes(filter.toLowerCase()) ||
        event.description.toLowerCase().includes(filter.toLowerCase());

      const matchesType = eventFilter === 'all' || event.type === eventFilter;

      return matchesSearch && matchesType;
    });
  }, [currentSession, filter, eventFilter]);

  const handleExportSession = useCallback(() => {
    const data = exportSession();
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-session-${currentSession?.id || 'unknown'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [exportSession, currentSession]);

  const handleImportSession = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          // Import session logic would go here
          console.log('Imported session:', content);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'command': return <Zap className="w-4 h-4" />;
      case 'render': return <Layers className="w-4 h-4" />;
      case 'network': return <Globe className="w-4 h-4" />;
      case 'state': return <Database className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'performance': return <Activity className="w-4 h-4" />;
      default: return <Bug className="w-4 h-4" />;
    }
  };

  const getStatusColor = (type: string, success?: boolean) => {
    switch (type) {
      case 'error': return 'text-red-500';
      case 'command': return success ? 'text-green-500' : 'text-red-500';
      case 'network': return success ? 'text-green-500' : 'text-red-500';
      default: return 'text-blue-500';
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 w-96 h-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-blue-400" />
          <span className="text-white font-medium">Debug Panel</span>
          {currentSession && (
            <span className="text-xs text-gray-400">
              {currentSession.events.length} events
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentSession?.isActive ? (
            <button
              onClick={() => endSession()}
              className="p-1 hover:bg-gray-800 rounded"
              title="End Session"
            >
              <Square className="w-4 h-4 text-red-400" />
            </button>
          ) : (
            <button
              onClick={() => startSession()}
              className="p-1 hover:bg-gray-800 rounded"
              title="Start Session"
            >
              <Play className="w-4 h-4 text-green-400" />
            </button>
          )}

          <button
            onClick={handleExportSession}
            disabled={!currentSession}
            className="p-1 hover:bg-gray-800 rounded disabled:opacity-50"
            title="Export Session"
          >
            <Download className="w-4 h-4 text-blue-400" />
          </button>

          <button
            onClick={handleImportSession}
            className="p-1 hover:bg-gray-800 rounded"
            title="Import Session"
          >
            <Upload className="w-4 h-4 text-blue-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {(['events', 'metrics', 'insights', 'sessions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm capitalize ${
              activeTab === tab
                ? 'text-blue-400 border-b border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'events' && (
          <div className="h-full flex flex-col">
            {/* Filters */}
            <div className="p-2 border-b border-gray-700">
              <input
                type="text"
                placeholder="Filter events..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-2 py-1 bg-gray-800 text-white rounded text-sm"
              />

              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full mt-1 px-2 py-1 bg-gray-800 text-white rounded text-sm"
              >
                <option value="all">All Types</option>
                <option value="command">Commands</option>
                <option value="render">Renders</option>
                <option value="network">Network</option>
                <option value="state">State</option>
                <option value="error">Errors</option>
                <option value="performance">Performance</option>
              </select>
            </div>

            {/* Events List */}
            <div className="flex-1 overflow-y-auto">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`p-2 border-b border-gray-800 hover:bg-gray-800 cursor-pointer ${
                    selectedEvent?.id === event.id ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getEventIcon(event.type)}
                    <span className={`text-xs ${getStatusColor(event.type, event.data.success)}`}>
                      {event.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    {event.duration && (
                      <span className="text-xs text-gray-500">
                        {event.duration.toFixed(2)}ms
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white mt-1">{event.title}</div>
                  <div className="text-xs text-gray-400 truncate">{event.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'metrics' && currentSession && (
          <div className="p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Session Metrics</h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Commands</span>
                <span className="text-white">{currentSession.metrics.totalCommands}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Success Rate</span>
                <span className="text-white">
                  {currentSession.metrics.totalCommands > 0
                    ? `${((currentSession.metrics.successfulCommands / currentSession.metrics.totalCommands) * 100).toFixed(1)}%`
                    : 'N/A'
                  }
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Avg Command Time</span>
                <span className="text-white">
                  {currentSession.metrics.averageCommandTime.toFixed(2)}ms
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Total Renders</span>
                <span className="text-white">{currentSession.metrics.totalRenders}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Avg Render Time</span>
                <span className="text-white">
                  {currentSession.metrics.averageRenderTime.toFixed(2)}ms
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Network Requests</span>
                <span className="text-white">{currentSession.metrics.networkRequests}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Failed Requests</span>
                <span className="text-white">{currentSession.metrics.failedNetworkRequests}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">State Transitions</span>
                <span className="text-white">{currentSession.metrics.stateTransitions}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-400">Errors</span>
                <span className="text-white">{currentSession.metrics.errorCount}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="p-4 overflow-y-auto">
            <h3 className="text-white font-medium mb-4">Performance Insights</h3>

            {/* Slowest Commands */}
            <div className="mb-6">
              <h4 className="text-gray-400 text-sm mb-2">Slowest Commands</h4>
              {insights.slowestCommands.map((cmd, index) => (
                <div key={index} className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{cmd.name}</span>
                  <span className="text-white">{cmd.duration.toFixed(2)}ms</span>
                </div>
              ))}
            </div>

            {/* Error Patterns */}
            <div className="mb-6">
              <h4 className="text-gray-400 text-sm mb-2">Error Patterns</h4>
              {insights.errorPatterns.map((pattern, index) => (
                <div key={index} className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{pattern.type}</span>
                  <span className="text-red-400">{pattern.count}</span>
                </div>
              ))}
            </div>

            {/* Network Issues */}
            <div className="mb-6">
              <h4 className="text-gray-400 text-sm mb-2">Network Issues</h4>
              {insights.networkIssues.map((issue, index) => (
                <div key={index} className="mb-2">
                  <div className="text-sm text-gray-300 truncate">{issue.url}</div>
                  <div className="text-xs text-red-400">{issue.error}</div>
                </div>
              ))}
            </div>

            {/* State Transitions */}
            <div>
              <h4 className="text-gray-400 text-sm mb-2">State Transitions</h4>
              {insights.stateTransitions.map((transition, index) => (
                <div key={index} className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">
                    {transition.from} → {transition.to}
                  </span>
                  <span className="text-blue-400">{transition.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-medium">All Sessions</h3>
              <button
                onClick={clearSessions}
                className="p-1 hover:bg-gray-800 rounded"
                title="Clear All Sessions"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>

            {getAllSessions().map((session) => (
              <div
                key={session.id}
                className={`p-3 border border-gray-700 rounded mb-2 ${
                  session.id === currentSession?.id ? 'border-blue-500' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-white text-sm font-medium">
                      {session.id}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {new Date(session.startTime).toLocaleString()}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {session.events.length} events
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {session.isActive ? (
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                    ) : (
                      <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-4 max-w-md w-full">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-white font-medium">Event Details</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Type:</span>
                <span className="text-white ml-2">{selectedEvent.type}</span>
              </div>

              <div>
                <span className="text-gray-400">Category:</span>
                <span className="text-white ml-2">{selectedEvent.category}</span>
              </div>

              <div>
                <span className="text-gray-400">Time:</span>
                <span className="text-white ml-2">
                  {new Date(selectedEvent.timestamp).toLocaleString()}
                </span>
              </div>

              {selectedEvent.duration && (
                <div>
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white ml-2">
                    {selectedEvent.duration.toFixed(2)}ms
                  </span>
                </div>
              )}

              <div>
                <span className="text-gray-400">Title:</span>
                <span className="text-white ml-2">{selectedEvent.title}</span>
              </div>

              <div>
                <span className="text-gray-400">Description:</span>
                <span className="text-white ml-2">{selectedEvent.description}</span>
              </div>

              {selectedEvent.stackTrace && (
                <div>
                  <span className="text-gray-400">Stack Trace:</span>
                  <pre className="text-red-400 text-xs mt-1 bg-gray-900 p-2 rounded overflow-auto">
                    {selectedEvent.stackTrace}
                  </pre>
                </div>
              )}

              {selectedEvent.data && (
                <div>
                  <span className="text-gray-400">Data:</span>
                  <pre className="text-blue-400 text-xs mt-1 bg-gray-900 p-2 rounded overflow-auto">
                    {JSON.stringify(selectedEvent.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
