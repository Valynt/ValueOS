import React, { useState, useEffect } from 'react';
import { CanvasComponent, AgentMessage } from '../../types';
import { Bot, TrendingUp, FileText, Activity, Lightbulb, ChevronRight, X } from 'lucide-react';

interface AgentInsightPanelProps {
  onAddComponent: (component: Omit<CanvasComponent, 'id'>) => void;
  onAgentQuery: (query: string) => Promise<void>;
}

export const AgentInsightPanel: React.FC<AgentInsightPanelProps> = ({ 
  onAddComponent, 
  onAgentQuery 
}) => {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: '1',
      type: 'activity',
      timestamp: new Date(Date.now() - 300000),
      agent: 'Orchestrator',
      title: 'Business case initialized',
      content: 'Template selected: SaaS ROI Analysis for Enterprise Client'
    },
    {
      id: '2',
      type: 'activity',
      timestamp: new Date(Date.now() - 240000),
      agent: 'Assumption Agent',
      title: 'Salesforce data imported',
      content: 'User count (750), contract value ($250k), and implementation timeline (Q2 2024) loaded from Acme Corp opportunity.'
    }
  ]);

  const [currentSuggestion, setCurrentSuggestion] = useState<AgentMessage>({
    id: 'suggestion-1',
    type: 'suggestion',
    timestamp: new Date(),
    agent: 'Calculation Agent',
    title: 'High-impact cost driver detected',
    content: 'Your "Implementation Timeline" assumption significantly impacts ROI. Consider creating best/worst case scenarios.',
    actions: [
      { label: 'Create Scenarios', action: 'create-scenarios' },
      { label: 'Dismiss', action: 'dismiss' }
    ]
  });

  const [narrative, setNarrative] = useState<string>(
    'This analysis projects a **245% return on investment** over three years from implementing the SaaS solution. The primary value drivers include a 15% increase in operational efficiency and 5% reduction in material waste...'
  );

  const handleSuggestionAction = (action: string) => {
    if (action === 'create-scenarios') {
      onAgentQuery('create scenario analysis for ROI');

      // Add activity message
      setMessages(prev => [...prev, {
        id: `activity-${Date.now()}`,
        type: 'activity',
        timestamp: new Date(),
        agent: 'Calculation Agent',
        title: 'Scenario analysis created',
        content: 'Added Conservative (180% ROI), Likely (245% ROI), and Optimistic (320% ROI) scenarios to canvas.'
      }]);

      // Clear suggestion
      setCurrentSuggestion(null as any);
    } else if (action === 'dismiss') {
      setCurrentSuggestion(null as any);
    }
  };

  // Simulate periodic agent activity
  useEffect(() => {
    const interval = setInterval(() => {
      const agentActivities = [
        {
          agent: 'Visualization Agent',
          title: 'Chart data updated',
          content: 'Refreshed benchmark data from industry database.'
        },
        {
          agent: 'Narrative Agent',
          title: 'Executive summary refined',
          content: 'Updated value proposition based on latest assumptions.'
        }
      ];

      const randomActivity = agentActivities[Math.floor(Math.random() * agentActivities.length)];
      
      setMessages(prev => [...prev, {
        id: `activity-${Date.now()}`,
        type: 'activity',
        timestamp: new Date(),
        ...randomActivity
      }]);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'cost-breakdown':
        await onAgentQuery('show cost breakdown analysis');
        break;
      case 'assumptions-table':
        await onAgentQuery('create assumptions table with benchmarks');
        break;
      case 'scenario-analysis':
        await onAgentQuery('generate scenario comparison');
        break;
      default:
        break;
    }
  };

  const getAgentIcon = (agent: string) => {
    const icons: Record<string, any> = {
      'Orchestrator': Bot,
      'Calculation Agent': TrendingUp,
      'Narrative Agent': FileText,
      'Assumption Agent': Activity,
      'Visualization Agent': Lightbulb
    };
    return icons[agent] || Bot;
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Agent Insights</h2>
        <div className="flex items-center text-sm text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
          <span>5 agents active</span>
        </div>
      </div>

      {/* Current Suggestion */}
      {currentSuggestion && (
        <div className="p-6 border-b border-gray-200 bg-blue-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <Lightbulb className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{currentSuggestion.title}</h3>
                <p className="text-xs text-blue-600">{currentSuggestion.agent}</p>
              </div>
            </div>
            <button
              onClick={() => handleSuggestionAction('dismiss')}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <p className="text-sm text-gray-700 mb-4">{currentSuggestion.content}</p>
          
          {currentSuggestion.actions && (
            <div className="flex space-x-2">
              {currentSuggestion.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionAction(action.action)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    index === 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Activity Timeline</h3>
          <div className="space-y-4">
            {messages.slice().reverse().map((message, index) => {
              const IconComponent = getAgentIcon(message.agent);
              return (
                <div key={message.id} className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <IconComponent className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{message.title}</p>
                      <span className="text-xs text-gray-500">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{message.agent}</p>
                    <p className="text-sm text-gray-700">{message.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Narrative Preview */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 mb-6">
            <button 
              onClick={() => handleQuickAction('cost-breakdown')}
              className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors"
            >
              📊 Cost Breakdown
            </button>
            <button 
              onClick={() => handleQuickAction('assumptions-table')}
              className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors"
            >
              📋 Assumptions Table
            </button>
          </div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Executive Summary</h3>
            <div className="flex items-center text-xs text-gray-500">
              <FileText className="h-3 w-3 mr-1" />
              <span>Auto-updating</span>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700 leading-relaxed">
              {narrative}
            </p>
            <button className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center">
              Add to canvas
              <ChevronRight className="h-3 w-3 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};