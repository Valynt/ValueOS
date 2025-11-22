import React, { useState, useEffect } from 'react';
import { History, Clock, User, Bot, X } from 'lucide-react';
import { persistenceService, HistoryEntry } from '../../services/PersistenceService';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  componentId?: string;
  onHighlightComponent?: (componentId: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  caseId,
  componentId,
  onHighlightComponent
}) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, caseId, componentId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const entries = componentId
        ? await persistenceService.getComponentHistory(componentId)
        : await persistenceService.getGlobalHistory(caseId);
      setHistory(entries);
    } catch (error) {
      logger.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getActionIcon = (actionType: string) => {
    const iconClass = "h-4 w-4";
    switch (actionType) {
      case 'created':
        return <span className={`${iconClass} text-green-600`}>+</span>;
      case 'updated':
        return <span className={`${iconClass} text-blue-600`}>✎</span>;
      case 'deleted':
        return <span className={`${iconClass} text-red-600`}>−</span>;
      case 'moved':
        return <span className={`${iconClass} text-purple-600`}>⤳</span>;
      case 'resized':
        return <span className={`${iconClass} text-orange-600`}>⇔</span>;
      default:
        return <Clock className={`${iconClass} text-gray-600`} />;
    }
  };

  const getActorIcon = (actor: string) => {
    return actor === 'user' ? (
      <User className="h-3 w-3" />
    ) : (
      <Bot className="h-3 w-3" />
    );
  };

  const getChangesSummary = (entry: HistoryEntry) => {
    const changes = entry.changes;
    if (!changes || typeof changes !== 'object') return null;

    const summaryParts: string[] = [];

    if (changes.position) {
      summaryParts.push(`Moved to (${changes.position.x}, ${changes.position.y})`);
    }
    if (changes.size) {
      summaryParts.push(`Resized to ${changes.size.width}×${changes.size.height}`);
    }
    if (changes.props) {
      const propKeys = Object.keys(changes.props);
      if (propKeys.length > 0) {
        summaryParts.push(`Updated ${propKeys.join(', ')}`);
      }
    }
    if (changes.type) {
      summaryParts.push(`Type: ${changes.type}`);
    }

    return summaryParts.length > 0 ? summaryParts.join(' • ') : 'No details';
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <History className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                {componentId ? 'Component History' : 'All Changes'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <p className="text-sm text-gray-500">
            {componentId
              ? 'View all changes made to this component'
              : 'Chronological timeline of all canvas changes'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer"
                  onMouseEnter={() => {
                    if (onHighlightComponent && entry.component_id) {
                      onHighlightComponent(entry.component_id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        {getActionIcon(entry.action_type)}
                      </div>
                      <span className="font-medium text-sm text-gray-900 capitalize">
                        {entry.action_type}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>

                  <div className="ml-8 space-y-1">
                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                      <div className="flex items-center space-x-1">
                        {getActorIcon(entry.actor)}
                        <span className="capitalize">{entry.actor}</span>
                      </div>
                    </div>

                    <p className="text-sm text-gray-700">
                      {getChangesSummary(entry)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{history.length} changes recorded</span>
            <button
              onClick={loadHistory}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
