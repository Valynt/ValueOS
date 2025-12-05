import React, { useState } from 'react';
import { Plus, Search, Filter, MoreVertical, FolderOpen, Calendar, Tag } from 'lucide-react';
import { Case } from '../types';

interface LibraryViewProps {
  onOpenCase: (caseId: string) => void;
  onCreateNew: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onOpenCase, onCreateNew }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'review' | 'published'>('all');

  const mockCases: Case[] = [
    {
      id: '1',
      name: 'Acme Corp - SaaS ROI Analysis',
      description: 'Comprehensive ROI analysis for SaaS implementation including cost breakdown and payback period',
      created_at: new Date('2024-01-15'),
      updated_at: new Date('2024-01-20'),
      components_count: 8,
      tags: ['roi', 'saas', 'enterprise'],
      status: 'draft'
    },
    {
      id: '2',
      name: 'TechStart - Cloud Migration Business Case',
      description: 'Analysis of cloud migration costs, benefits, and timeline',
      created_at: new Date('2024-01-10'),
      updated_at: new Date('2024-01-18'),
      components_count: 12,
      tags: ['cloud', 'migration', 'cost-analysis'],
      status: 'review'
    },
    {
      id: '3',
      name: 'Global Retail - Digital Transformation',
      description: 'Digital transformation roadmap with KPIs and success metrics',
      created_at: new Date('2024-01-05'),
      updated_at: new Date('2024-01-15'),
      components_count: 15,
      tags: ['digital', 'transformation', 'retail'],
      status: 'published'
    }
  ];

  const filteredCases = mockCases.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: Case['status']) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      review: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800'
    };
    return styles[status];
  };

  return (
    <div className="flex-1 bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Value Case Library</h1>
            <p className="text-gray-600 mt-1">Manage and organize your business intelligence analyses</p>
          </div>
          <button
            onClick={onCreateNew}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
          >
            <Plus className="h-5 w-5" />
            <span>New Analysis</span>
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search analyses by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2 border border-gray-300 rounded-lg p-1 bg-white">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filterStatus === 'all' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('draft')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filterStatus === 'draft' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => setFilterStatus('review')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filterStatus === 'review' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setFilterStatus('published')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filterStatus === 'published' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Published
            </button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {filteredCases.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No analyses found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery ? 'Try adjusting your search terms' : 'Get started by creating your first analysis'}
            </p>
            {!searchQuery && (
              <button
                onClick={onCreateNew}
                className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Create New Analysis</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCases.map((case_) => (
              <div
                key={case_.id}
                onClick={() => onOpenCase(case_.id)}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
                      {case_.name}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(case_.status)}`}>
                      {case_.status}
                    </span>
                  </div>
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                    <MoreVertical className="h-5 w-5 text-gray-400" />
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {case_.description}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-xs text-gray-500">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    Updated {case_.updated_at.toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-xs text-gray-500">
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                    {case_.components_count} components
                  </div>
                </div>

                {case_.tags && case_.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {case_.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
