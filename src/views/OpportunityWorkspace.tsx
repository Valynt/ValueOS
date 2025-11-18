import React, { useState } from 'react';
import { Search, Plus, Target, TrendingUp, AlertCircle, Lightbulb, Users, DollarSign } from 'lucide-react';
import { MetricCard } from '../components/Components/MetricCard';
import { NarrativeBlock } from '../components/Components/NarrativeBlock';
import type { BusinessObjective, Capability } from '../types/vos';
import { sanitizeUserInput } from '../utils/security';

export const OpportunityWorkspace: React.FC = () => {
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [discoveryNotes, setDiscoveryNotes] = useState('');
  const [objectives, setObjectives] = useState<Partial<BusinessObjective>[]>([
    { name: 'Reduce operational costs', priority: 1 as const, description: 'Streamline manual processes' },
    { name: 'Improve customer satisfaction', priority: 2 as const, description: 'Enhance service delivery speed' }
  ]);

  const mockCapabilities: Partial<Capability>[] = [
    { id: '1', name: 'Process Automation', category: 'Efficiency', tags: ['automation', 'workflow'] },
    { id: '2', name: 'Real-time Analytics', category: 'Insights', tags: ['analytics', 'reporting'] },
    { id: '3', name: 'Customer Portal', category: 'Experience', tags: ['self-service', 'portal'] },
    { id: '4', name: 'Integration Hub', category: 'Connectivity', tags: ['integration', 'api'] }
  ];

  const toggleCapability = (id: string) => {
    setSelectedCapabilities(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const addObjective = () => {
    setObjectives([...objectives, { name: '', description: '', priority: 3 as const }]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Opportunity Discovery</h1>
              <p className="text-gray-600 mt-2">Identify customer needs and map capabilities to value outcomes</p>
            </div>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
              Analyze Opportunity
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Persona Fit Score"
            value="85%"
            trend="up"
            change="+12% vs avg"
          />
          <MetricCard
            title="Pain Points"
            value="7"
            trend="neutral"
            change="High severity"
          />
          <MetricCard
            title="Est. Annual Value"
            value="$245K"
            trend="up"
            change="Preliminary"
          />
          <MetricCard
            title="Confidence Level"
            value="Medium"
            trend="up"
            change="68% certain"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900">Discovery Notes</h2>
              </div>
              <textarea
                value={discoveryNotes}
                onChange={(e) => setDiscoveryNotes(sanitizeUserInput(e.target.value, 1200))}
                placeholder="Enter discovery call notes, email transcripts, or meeting summaries here..."
                className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-500">{discoveryNotes.length} characters</span>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Import from transcript
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Business Objectives</h2>
                </div>
                <button
                  onClick={addObjective}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {objectives.map((obj, idx) => (
                  <div key={idx} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">
                      {obj.priority}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={obj.name}
                        placeholder="Objective name"
                        className="w-full font-medium text-gray-900 bg-transparent border-none focus:outline-none mb-1"
                        readOnly
                      />
                      <p className="text-sm text-gray-600">{obj.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <NarrativeBlock
              title="Opportunity Summary"
              content="This mid-market SaaS company is experiencing significant manual overhead in their customer onboarding process. **Key pain point**: 15 hours per customer at $45/hour = $675 per onboarding. With 50 new customers per month, this represents **$405,000 annual cost**. They've expressed strong interest in automation capabilities that could reduce this by 70%."
              isEditable={true}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <Search className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Solution Capabilities</h2>
              </div>
              <input
                type="text"
                placeholder="Search capabilities..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm mb-4"
              />
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {mockCapabilities.map(cap => (
                  <div
                    key={cap.id}
                    onClick={() => toggleCapability(cap.id!)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedCapabilities.includes(cap.id!)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 text-sm">{cap.name}</h3>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">{cap.category}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cap.tags?.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {selectedCapabilities.length} capabilities selected
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900">Pain Points</h2>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-red-900">Manual Processes</span>
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">High</span>
                  </div>
                  <p className="text-xs text-red-700">$405K annual cost</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-amber-900">Slow Onboarding</span>
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">Med</span>
                  </div>
                  <p className="text-xs text-amber-700">Customer churn risk</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center space-x-2 mb-3">
                <DollarSign className="h-5 w-5 text-blue-700" />
                <h3 className="font-semibold text-blue-900">Value Hypothesis</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-900">Cost Savings</span>
                  <span className="font-bold text-blue-900">$283K</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-900">Revenue Impact</span>
                  <span className="font-bold text-blue-900">$120K</span>
                </div>
                <div className="pt-2 border-t border-blue-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-blue-900">Total Value</span>
                    <span className="text-lg font-bold text-blue-900">$403K</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
