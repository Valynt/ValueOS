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
      draft: 'bg-muted text-muted-foreground',
      review: 'bg-amber-100 text-amber-800',
      published: 'bg-emerald-100 text-emerald-800'
    };
    return styles[status];
  };

  return (
    <div className="flex-1 bg-background">
      <div className="bg-card border-b border-border px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Value Case Library</h1>
            <p className="text-muted-foreground mt-1">Manage and organize your business intelligence analyses</p>
          </div>
          <button
            onClick={onCreateNew}
            className="flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-light-blue-sm font-medium"
          >
            <Plus className="h-5 w-5" />
            <span>New Analysis</span>
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search analyses by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2 border border-border rounded-lg p-1 bg-card">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filterStatus === 'all' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('draft')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filterStatus === 'draft' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => setFilterStatus('review')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filterStatus === 'review' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setFilterStatus('published')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                filterStatus === 'published' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent'
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
            <FolderOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No analyses found</h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery ? 'Try adjusting your search terms' : 'Get started by creating your first analysis'}
            </p>
            {!searchQuery && (
              <button
                onClick={onCreateNew}
                className="inline-flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-light-blue-sm"
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
                className="bg-card border border-border rounded-xl p-6 hover:shadow-beautiful-lg transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                      {case_.name}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(case_.status)}`}>
                      {case_.status}
                    </span>
                  </div>
                  <button className="p-1 hover:bg-accent rounded transition-colors">
                    <MoreVertical className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {case_.description}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    Updated {case_.updated_at.toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                    {case_.components_count} components
                  </div>
                </div>

                {case_.tags && case_.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {case_.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"
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
